const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const nodeFetch  = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db  = require('./db');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const JWT_SECRET = process.env.JWT_SECRET || 'soundsphere_secret_key_2024';
const SAAVN_BASE = 'https://saavn.sumit.co';

// ── HELPERS ──────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Pick best quality URL from downloadUrl array
function getBestAudioUrl(downloadUrl, quality = '160kbps') {
  if (!downloadUrl || !downloadUrl.length) return null;
  const match = downloadUrl.find(d => d.quality === quality);
  return (match || downloadUrl[downloadUrl.length - 1]).url;
}

// Normalize a song object from Saavn API
function normalizeSong(song) {
  const img = song.image && song.image[2]
    ? (song.image[2].url || song.image[2].link)
    : (song.image && song.image[1] ? (song.image[1].url || song.image[1].link) : '');

  const artists = song.primaryArtists
    || (song.artists && song.artists.primary
        ? (typeof song.artists.primary === 'string'
            ? song.artists.primary
            : song.artists.primary.map(a => a.name).join(', '))
        : 'Unknown Artist');

  return {
    id:          song.id,
    name:        song.name,
    artist_name: artists,
    album_name:  song.album ? song.album.name : '',
    duration:    song.duration || 0,
    image:       img,
    audio:       `/api/stream/${song.id}`,
    _downloadUrl: song.downloadUrl   // keep for stream route
  };
}

// ── AUTH ROUTES ──────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)').run(fullname, email, hashed);
    const token  = jwt.sign({ id: result.lastInsertRowid, email, fullname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, fullname, email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const user  = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)  return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, email: user.email, fullname: user.fullname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, fullname: user.fullname, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, fullname, email, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ── MUSIC ROUTES (JioSaavn) ──────────────────────────────────

// GET TRENDING / SEARCH TRACKS
app.get('/api/tracks', async (req, res) => {
  const { limit = 20, search = 'trending hindi', genre = '' } = req.query;
  const query = genre || search || 'trending hits';
  const url   = `${SAAVN_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=0`;
  try {
    const data = await nodeFetch(url).then(r => r.json());
    if (!data.success) return res.status(500).json({ error: 'Saavn API error' });
    const results = (data.data.results || []).map(normalizeSong);
    res.json({ results, total: data.data.total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ARTISTS (search by name)
app.get('/api/artists', async (req, res) => {
  const { search = 'Arijit Singh' } = req.query;
  const url = `${SAAVN_BASE}/api/search/artists?query=${encodeURIComponent(search)}&limit=12`;
  try {
    const data = await nodeFetch(url).then(r => r.json());
    if (!data.success) return res.json({ results: [] });
    const results = (data.data.results || []).map(a => ({
      id:    a.id,
      name:  a.name,
      image: a.image && a.image[2] ? (a.image[2].url || a.image[2].link) : ''
    }));
    res.json({ results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ALBUMS
app.get('/api/albums', async (req, res) => {
  const { search = 'best hindi albums' } = req.query;
  const url = `${SAAVN_BASE}/api/search/albums?query=${encodeURIComponent(search)}&limit=12`;
  try {
    const data = await nodeFetch(url).then(r => r.json());
    if (!data.success) return res.json({ results: [] });
    const results = (data.data.results || []).map(a => ({
      id:          a.id,
      name:        a.name,
      artist_name: a.primaryArtists || '',
      image:       a.image && a.image[2] ? (a.image[2].url || a.image[2].link) : ''
    }));
    res.json({ results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// STREAM — proxy audio bytes to browser
app.get('/api/stream/:id', async (req, res) => {
  try {
    const quality  = req.query.quality || '160kbps';
    // Saavn needs 'ids' not 'id'
    const songUrl  = `${SAAVN_BASE}/api/songs?ids=${req.params.id}`;
    const songData = await nodeFetch(songUrl).then(r => r.json());
    const song     = songData.success && songData.data && songData.data[0];
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const audioUrl = getBestAudioUrl(song.downloadUrl, quality);
    if (!audioUrl) return res.status(404).json({ error: 'No audio URL found' });

    const audioRes = await nodeFetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':    'https://www.jiosaavn.com/'
      }
    });

    if (!audioRes.ok) return res.status(audioRes.status).json({ error: 'Audio fetch failed' });

    const ct = audioRes.headers.get('content-type') || 'audio/mp4';
    res.setHeader('Content-Type', ct);
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const cl = audioRes.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    audioRes.body.pipe(res);
    req.on('close', () => audioRes.body.destroy());
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── LIKED SONGS ──────────────────────────────────────────────
app.get('/api/liked', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM liked_songs WHERE user_id = ? ORDER BY added_at DESC').all(req.user.id));
});

app.post('/api/liked', authMiddleware, (req, res) => {
  const { track_id, track_name, artist_name, image, audio, duration } = req.body;
  try {
    db.prepare('INSERT OR IGNORE INTO liked_songs (user_id, track_id, track_name, artist_name, image, audio, duration) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.user.id, track_id, track_name, artist_name, image, audio, duration);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/liked/:track_id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM liked_songs WHERE user_id = ? AND track_id = ?').run(req.user.id, req.params.track_id);
  res.json({ success: true });
});

// ── PLAYLISTS ─────────────────────────────────────────────────
app.get('/api/playlists', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM playlists WHERE user_id = ?').all(req.user.id));
});

app.post('/api/playlists', authMiddleware, (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(req.user.id, name);
  res.json({ id: result.lastInsertRowid, name });
});

app.post('/api/playlists/:id/songs', authMiddleware, (req, res) => {
  const { track_id, track_name, artist_name, image, audio, duration } = req.body;
  db.prepare('INSERT INTO playlist_songs (playlist_id, track_id, track_name, artist_name, image, audio, duration) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, track_id, track_name, artist_name, image, audio, duration);
  res.json({ success: true });
});

app.get('/api/playlists/:id/songs', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ?').all(req.params.id));
});

app.delete('/api/playlists/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(req.params.id);
  db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/playlists/:id/songs/:track_id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND track_id = ?').run(req.params.id, req.params.track_id);
  res.json({ success: true });
});

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SoundSphere running at http://localhost:${PORT}`));
