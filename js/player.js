/**
 * SoundSphere — Shared Player Engine
 * Handles: play/pause, prev/next, shuffle, repeat, queue,
 *          lyrics fetch, full-screen player, mini bar sync,
 *          recently played, play count tracking
 */

const _API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// ── STATE ─────────────────────────────────────────────────────
const audio      = new Audio();
let playlist     = [];
let currentIndex = -1;
let isLiked      = false;
let isShuffle    = false;
let repeatMode   = 0;   // 0=off 1=all 2=one
let shuffleOrder = [];

audio.volume = 0.8;

// ── INIT ──────────────────────────────────────────────────────
function initPlayer() {
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended',      onEnded);
  audio.addEventListener('play',       () => updatePlayIcons(false));
  audio.addEventListener('pause',      () => updatePlayIcons(true));

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Restore volume from settings
  const settings = JSON.parse(localStorage.getItem('ss_settings') || '{}');
  if (settings.volume !== undefined) {
    audio.volume = settings.volume;
    const vb = document.getElementById('volumeBar');
    const fv = document.getElementById('fpVolume');
    if (vb) vb.value = settings.volume * 100;
    if (fv) fv.value = settings.volume * 100;
  }
}

// ── PLAY ──────────────────────────────────────────────────────
async function playSong(index, tracks) {
  if (tracks) {
    playlist = tracks;
    if (isShuffle) buildShuffleOrder();
  }
  currentIndex = index;
  const song = playlist[index];
  if (!song) return;

  const trackId = song.id || song.track_id;

  // Show player bar
  const bar = document.getElementById('playerBar');
  if (bar) bar.style.display = 'flex';

  // Update mini bar
  _setEl('playerImg',    el => el.src = song.image || '');
  _setEl('playerTitle',  el => el.textContent = song.name || song.track_name || 'Unknown');
  _setEl('playerArtist', el => el.textContent = song.artist_name || 'Unknown');

  // Update full-screen player
  _setEl('fpImg',    el => el.src = song.image || '');
  _setEl('fpTitle',  el => el.textContent = song.name || song.track_name || 'Unknown');
  _setEl('fpArtist', el => el.textContent = song.artist_name || 'Unknown');

  // Blurred background
  _setEl('fpBg', el => el.style.backgroundImage = `url('${song.image}')`);

  // Spinner while loading
  updatePlayIcons(true, true);

  try {
    audio.pause();
    audio.src = `${_API}/api/stream/${trackId}`;
    audio.load();
    await audio.play();
    updatePlayIcons(false);
    checkLiked(trackId);
    updateQueue();
    trackRecentlyPlayed(song);
    incrementPlayCount();
    // Clear lyrics when new song starts
    _setEl('lyricsContent', el => el.textContent = 'Fetching lyrics...');
    const lp = document.getElementById('lyricsPanel');
    if (lp && lp.style.display !== 'none') fetchLyrics(song.name || song.track_name, song.artist_name);
  } catch (err) {
    console.error('Play error:', err);
    updatePlayIcons(true);
    _setEl('playerTitle', el => el.textContent = '⚠ Could not play');
  }
}

function togglePlay() {
  if (audio.paused) audio.play(); else audio.pause();
}

function prevSong() {
  if (currentIndex > 0) playSong(currentIndex - 1);
  else if (repeatMode === 1) playSong(playlist.length - 1);
}

function nextSong() {
  if (isShuffle && shuffleOrder.length) {
    const pos = shuffleOrder.indexOf(currentIndex);
    const next = shuffleOrder[(pos + 1) % shuffleOrder.length];
    playSong(next);
    return;
  }
  if (currentIndex < playlist.length - 1) {
    playSong(currentIndex + 1);
  } else if (repeatMode === 1) {
    playSong(0);
  }
}

function seekTo(val) {
  if (audio.duration) audio.currentTime = (val / 100) * audio.duration;
}

function setVolume(val) {
  audio.volume = val / 100;
  const settings = JSON.parse(localStorage.getItem('ss_settings') || '{}');
  settings.volume = val / 100;
  localStorage.setItem('ss_settings', JSON.stringify(settings));
}

// ── SHUFFLE ───────────────────────────────────────────────────
function toggleShuffle() {
  isShuffle = !isShuffle;
  if (isShuffle) buildShuffleOrder();
  const cls = 'active-control';
  ['shuffleBtn', 'barShuffleBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) isShuffle ? el.classList.add(cls) : el.classList.remove(cls);
  });
}

function buildShuffleOrder() {
  shuffleOrder = [...Array(playlist.length).keys()].sort(() => Math.random() - 0.5);
}

// ── REPEAT ────────────────────────────────────────────────────
function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const icons = { 0: 'fa-repeat', 1: 'fa-repeat', 2: 'fa-1' };
  const labels = { 0: '', 1: 'Repeat All', 2: 'Repeat One' };
  ['repeatBtn', 'barRepeatBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<i class="fa-solid ${icons[repeatMode]}"></i>`;
    el.title = labels[repeatMode];
    repeatMode > 0 ? el.classList.add('active-control') : el.classList.remove('active-control');
  });
  audio.loop = (repeatMode === 2);
}

// ── LIKE ──────────────────────────────────────────────────────
async function checkLiked(trackId) {
  const token = _getToken();
  if (!token) { setLikeIcons(false); return; }
  const liked = await fetch(`${_API}/api/liked`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json()).catch(() => []);
  isLiked = liked.some(s => s.track_id == trackId);
  setLikeIcons(isLiked);
}

function setLikeIcons(liked) {
  isLiked = liked;
  const html = liked
    ? '<i class="fa-solid fa-heart" style="color:#f87171"></i>'
    : '<i class="fa-regular fa-heart"></i>';
  ['likeBtn', 'fpLikeBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

async function toggleLike() {
  const token = _getToken();
  if (!token) { alert('Please sign in to like songs'); return; }
  const song = playlist[currentIndex];
  if (!song) return;
  const trackId = song.id || song.track_id;

  if (isLiked) {
    await fetch(`${_API}/api/liked/${trackId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setLikeIcons(false);
  } else {
    await fetch(`${_API}/api/liked`, {
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
    setLikeIcons(true);
  }
}

// ── FULL-SCREEN PLAYER ────────────────────────────────────────
function openFullPlayer() {
  const fp = document.getElementById('fullPlayer');
  if (fp) { fp.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeFullPlayer() {
  const fp = document.getElementById('fullPlayer');
  if (fp) { fp.style.display = 'none'; document.body.style.overflow = ''; }
}

// ── LYRICS ────────────────────────────────────────────────────
function toggleLyrics() {
  const lp = document.getElementById('lyricsPanel');
  const qp = document.getElementById('queuePanel');
  if (!lp) return;
  const showing = lp.style.display !== 'none';
  lp.style.display = showing ? 'none' : 'block';
  if (qp) qp.style.display = 'none';
  if (!showing) {
    const song = playlist[currentIndex];
    if (song) fetchLyrics(song.name || song.track_name, song.artist_name);
  }
}

async function fetchLyrics(title, artist) {
  const el = document.getElementById('lyricsContent');
  if (!el) return;
  el.textContent = 'Fetching lyrics...';
  try {
    const res  = await fetch(`https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist || '')}`);
    const data = await res.json();
    if (data.lyrics) {
      el.innerHTML = data.lyrics.replace(/\n/g, '<br>');
    } else {
      el.textContent = 'Lyrics not available for this song.';
    }
  } catch {
    el.textContent = 'Could not load lyrics. Try again later.';
  }
}

// ── QUEUE ─────────────────────────────────────────────────────
function toggleQueue() {
  const qp = document.getElementById('queuePanel');
  const lp = document.getElementById('lyricsPanel');
  if (!qp) return;
  const showing = qp.style.display !== 'none';
  qp.style.display = showing ? 'none' : 'block';
  if (lp) lp.style.display = 'none';
  if (!showing) updateQueue();
}

function updateQueue() {
  const el = document.getElementById('queueList');
  if (!el) return;
  const upcoming = playlist.slice(currentIndex + 1, currentIndex + 11);
  if (!upcoming.length) { el.innerHTML = '<p style="color:#555; font-size:13px;">No songs in queue.</p>'; return; }
  el.innerHTML = upcoming.map((s, i) => `
    <div class="queue-item" onclick="playSong(${currentIndex + 1 + i})">
      <img src="${s.image}" onerror="this.src='/images/logo_no_bg - Edited.png'" alt="">
      <div>
        <div class="queue-title">${s.name || s.track_name}</div>
        <div class="queue-artist">${s.artist_name}</div>
      </div>
    </div>`).join('');
}

// ── RECENTLY PLAYED ───────────────────────────────────────────
function trackRecentlyPlayed(song) {
  let recent = JSON.parse(localStorage.getItem('ss_recent') || '[]');
  const entry = { id: song.id || song.track_id, name: song.name || song.track_name, artist_name: song.artist_name, image: song.image, audio: song.audio, duration: song.duration };
  recent = recent.filter(s => s.id !== entry.id);
  recent.unshift(entry);
  recent = recent.slice(0, 20);
  localStorage.setItem('ss_recent', JSON.stringify(recent));
}

function incrementPlayCount() {
  const count = parseInt(localStorage.getItem('ss_songs_played') || '0') + 1;
  localStorage.setItem('ss_songs_played', count);
}

// ── TIME UPDATE ───────────────────────────────────────────────
function onTimeUpdate() {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  const cur = fmtTime(audio.currentTime);
  const tot = fmtTime(audio.duration);

  _setRange('progressBar',   pct);
  _setRange('fpProgressBar', pct);
  _setEl('currentTime',   el => el.textContent = cur);
  _setEl('totalTime',     el => el.textContent = tot);
  _setEl('fpCurrentTime', el => el.textContent = cur);
  _setEl('fpTotalTime',   el => el.textContent = tot);
}

function onEnded() {
  if (repeatMode === 2) { audio.play(); return; }
  nextSong();
}

// ── ICONS ─────────────────────────────────────────────────────
function updatePlayIcons(paused, loading = false) {
  const icon = loading
    ? '<i class="fa-solid fa-spinner fa-spin"></i>'
    : paused
      ? '<i class="fa-solid fa-play"></i>'
      : '<i class="fa-solid fa-pause"></i>';
  ['playPauseBtn', 'fpPlayBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = icon;
  });
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function onKeyDown(e) {
  // Don't fire when typing in inputs
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': e.preventDefault(); audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); break;
    case 'ArrowLeft':  e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 10); break;
    case 'ArrowUp':    e.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.1); break;
    case 'ArrowDown':  e.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.1); break;
    case 'KeyN':       nextSong(); break;
    case 'KeyP':       prevSong(); break;
    case 'KeyS':       toggleShuffle(); break;
    case 'KeyR':       toggleRepeat(); break;
    case 'KeyL':       toggleLyrics(); break;
    case 'Escape':     closeFullPlayer(); break;
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function _setEl(id, fn) {
  const el = document.getElementById(id);
  if (el) fn(el);
}

function _setRange(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function _getToken() { return localStorage.getItem('ss_token'); }
