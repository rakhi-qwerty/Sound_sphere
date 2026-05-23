// Auto-detect API base
const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// ── AUTH ─────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ss_token'); }
function getUser()  { return JSON.parse(localStorage.getItem('ss_user') || 'null'); }

function logout() {
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
  window.location.reload();
}

function updateAuthUI() {
  const user        = getUser();
  const authButtons = document.getElementById('authButtons');
  const userMenu    = document.getElementById('userMenu');
  const userName    = document.getElementById('userName');
  if (!authButtons) return;
  if (user) {
    authButtons.style.display = 'none';
    userMenu.style.display    = 'flex';
    userName.textContent      = `Hi, ${user.fullname.split(' ')[0]} 👋`;
  } else {
    authButtons.style.display = 'flex';
    userMenu.style.display    = 'none';
  }
}

// ── PLAYER ───────────────────────────────────────────────────
const audio      = new Audio();
let playlist     = [];
let currentIndex = -1;
let isLiked      = false;

audio.volume = 0.8;

audio.addEventListener('timeupdate', () => {
  const bar = document.getElementById('progressBar');
  const cur = document.getElementById('currentTime');
  const tot = document.getElementById('totalTime');
  if (!bar || !audio.duration) return;
  bar.value = (audio.currentTime / audio.duration) * 100;
  cur.textContent = fmtTime(audio.currentTime);
  tot.textContent = fmtTime(audio.duration);
});

audio.addEventListener('ended', () => nextSong());

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

async function playSong(index, tracks) {
  if (tracks) playlist = tracks;
  currentIndex = index;
  const song = playlist[index];
  if (!song) return;

  const trackId = song.id || song.track_id;

  // Show player bar immediately
  document.getElementById('playerBar').style.display  = 'flex';
  document.getElementById('playerImg').src             = song.image || '';
  document.getElementById('playerTitle').textContent   = song.name || song.track_name || 'Unknown';
  document.getElementById('playerArtist').textContent  = song.artist_name || 'Unknown';

  const btn = document.getElementById('playPauseBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    audio.pause();
    audio.src = `${API}/api/stream/${trackId}`;
    audio.load();
    await audio.play();
    updatePlayIcon();
    checkLiked(trackId);
  } catch (err) {
    console.error('Play error:', err);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    document.getElementById('playerTitle').textContent = '⚠ Could not play — try another song';
  }
}

function togglePlay() {
  if (audio.paused) { audio.play(); } else { audio.pause(); }
  updatePlayIcon();
}

function updatePlayIcon() {
  const btn = document.getElementById('playPauseBtn');
  if (!btn) return;
  btn.innerHTML = audio.paused
    ? '<i class="fa-solid fa-play"></i>'
    : '<i class="fa-solid fa-pause"></i>';
}

function prevSong() {
  if (currentIndex > 0) playSong(currentIndex - 1);
}

function nextSong() {
  if (currentIndex < playlist.length - 1) playSong(currentIndex + 1);
}

function seekTo(val) {
  if (audio.duration) audio.currentTime = (val / 100) * audio.duration;
}

function setVolume(val) { audio.volume = val / 100; }

// ── LIKE ─────────────────────────────────────────────────────
async function checkLiked(trackId) {
  const token = getToken();
  if (!token) { setLikeIcon(false); return; }
  const liked = await fetch(`${API}/api/liked`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json()).catch(() => []);
  isLiked = liked.some(s => s.track_id == trackId);
  setLikeIcon(isLiked);
}

function setLikeIcon(liked) {
  const btn = document.getElementById('likeBtn');
  if (!btn) return;
  btn.innerHTML = liked
    ? '<i class="fa-solid fa-heart" style="color:#f87171"></i>'
    : '<i class="fa-regular fa-heart"></i>';
}

async function toggleLike() {
  const token = getToken();
  if (!token) { alert('Please sign in to like songs'); return; }
  const song = playlist[currentIndex];
  if (!song) return;
  const trackId = song.id || song.track_id;

  if (isLiked) {
    await fetch(`${API}/api/liked/${trackId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    isLiked = false;
  } else {
    await fetch(`${API}/api/liked`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id:    trackId,
        track_name:  song.name || song.track_name,
        artist_name: song.artist_name,
        image:       song.image,
        audio:       `/api/stream/${trackId}`,
        duration:    song.duration
      })
    });
    isLiked = true;
  }
  setLikeIcon(isLiked);
}

// ── LOAD TRACKS ───────────────────────────────────────────────
async function loadTracks(genre = '', search = '') {
  const container = document.getElementById('songs-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  let url = `${API}/api/tracks?limit=20`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (genre)  url += `&genre=${encodeURIComponent(genre)}`;

  try {
    const data   = await fetch(url).then(r => r.json());
    const tracks = data.results || [];
    playlist     = tracks;

    if (!tracks.length) {
      container.innerHTML = '<p style="color:#888; padding:20px;">No songs found.</p>';
      return;
    }

    container.innerHTML = tracks.map((song, i) => `
      <div class="song-card" onclick="playSong(${i})">
        <div class="img-box">
          <img src="${song.image}" alt="${song.name}" loading="lazy"
               onerror="this.src='images/logo_no_bg - Edited.png'">
          <div class="play-btn"><i class="fa-solid fa-play"></i></div>
        </div>
        <h4>${song.name}</h4>
        <p>${song.artist_name}</p>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color:#f87171; padding:20px;">Failed to load songs. Is the server running?</p>';
  }
}

// ── LOAD ARTISTS ──────────────────────────────────────────────
async function loadArtists() {
  const container = document.getElementById('artist-container');
  if (!container) return;

  // Use exact filenames from images/artist/ folder
  const artists = [
    { name: 'Arijit Singh',   img: 'images/artist/arjit singh.jpg',       query: 'Arijit Singh' },
    { name: 'Shreya Ghoshal', img: 'images/artist/shreya ghoshal.jpg',    query: 'Shreya Ghoshal' },
    { name: 'Armaan Malik',   img: 'images/artist/arman malik.jpg',       query: 'Armaan Malik' },
    { name: 'Diljit Dosanjh', img: 'images/artist/daljit dosanjih.jpg',   query: 'Diljit Dosanjh' },
    { name: 'Justin Bieber',  img: 'images/artist/Justin bieber.webp',    query: 'Justin Bieber' },
    { name: 'Taylor Swift',   img: 'images/artist/taylor swift.jpg',      query: 'Taylor Swift' },
    { name: 'Lisa',           img: 'images/artist/lisa.webp',             query: 'Lisa Blackpink' },
    { name: 'Kim Taehyung',   img: 'images/artist/kim taehyung.jpg',      query: 'BTS V Taehyung' },
    { name: 'Yo Yo Honey Singh', img: 'images/artist/yo yo honey singh.jpg', query: 'Yo Yo Honey Singh' },
  ];

  container.innerHTML = artists.map(a => `
    <a href="#" onclick="searchArtist('${a.query}'); return false;">
      <img src="${a.img}"
           onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=1a1a2e&color=fff&size=120&bold=true'"
           alt="${a.name}" loading="lazy">
      <h4>${a.name}</h4>
    </a>
  `).join('');
}

// ── LOAD ALBUMS ───────────────────────────────────────────────
async function loadAlbums() {
  const container = document.getElementById('album-container');
  if (!container) return;

  try {
    const data   = await fetch(`${API}/api/albums?search=best hindi 2024`).then(r => r.json());
    const albums = data.results || [];

    if (!albums.length) { container.innerHTML = '<p style="color:#888">No albums found.</p>'; return; }

    container.innerHTML = albums.map(a => `
      <div class="album-card" onclick="searchArtist('${a.name.replace(/'/g,"\\'")}')">
        <img src="${a.image}" alt="${a.name}" loading="lazy"
             onerror="this.src='images/logo_no_bg - Edited.png'">
        <h4>${a.name}</h4>
        <p style="font-size:12px;color:#777">${a.artist_name}</p>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p style="color:#888">Could not load albums.</p>';
  }
}

// ── SEARCH ────────────────────────────────────────────────────
function handleSearch(e) {
  if (e.key === 'Enter') {
    const val = document.getElementById('searchInput').value.trim();
    if (val) loadTracks('', val);
  }
}

function filterGenre(genre) {
  // Map genre button to a good search query
  const genreMap = {
    pop:        'pop hits',
    rock:       'rock songs',
    ambient:    'relaxing music',
    country:    'country music',
    hiphop:     'hip hop rap',
    acoustic:   'acoustic songs',
    jazz:       'jazz music',
    electronic: 'electronic dance music',
    bollywood:  'bollywood hits',
    punjabi:    'punjabi songs',
    romantic:   'romantic hindi songs',
    party:      'party songs'
  };
  loadTracks('', genreMap[genre] || genre);
  document.getElementById('songs-container').scrollIntoView({ behavior: 'smooth' });
}

function searchArtist(name) {
  const input = document.getElementById('searchInput');
  if (input) input.value = name;
  loadTracks('', name);
  document.getElementById('songs-container').scrollIntoView({ behavior: 'smooth' });
}

function toggleSearchBox() {
  const box = document.getElementById('searchBox');
  if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

// ── INIT ──────────────────────────────────────────────────────
updateAuthUI();

// Handle ?search= from library redirect
const urlParams   = new URLSearchParams(window.location.search);
const searchQuery = urlParams.get('search');
if (searchQuery) {
  const input = document.getElementById('searchInput');
  if (input) input.value = searchQuery;
  loadTracks('', searchQuery);
} else {
  loadTracks('', 'trending hindi hits 2024');
}

loadArtists();
loadAlbums();
