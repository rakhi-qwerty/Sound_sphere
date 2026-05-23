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
    if (userName) userName.textContent = `Hi, ${user.fullname.split(' ')[0]} 👋`;
  } else {
    authButtons.style.display = 'flex';
    userMenu.style.display    = 'none';
  }
}

// ── RECENTLY PLAYED ───────────────────────────────────────────
function loadRecentlyPlayed() {
  const container = document.getElementById('recently-played-container');
  if (!container) return;
  const recent = JSON.parse(localStorage.getItem('ss_recent') || '[]');
  if (!recent.length) {
    container.closest('.recently-played-section').style.display = 'none';
    return;
  }
  container.closest('.recently-played-section').style.display = 'block';
  container.innerHTML = recent.slice(0, 10).map((song, i) => `
    <div class="song-card" onclick="playSong(${i}, JSON.parse(localStorage.getItem('ss_recent') || '[]'))">
      <div class="img-box">
        <img src="${song.image}" alt="${song.name}" loading="lazy"
             onerror="this.src='images/logo_no_bg - Edited.png'">
        <div class="play-btn"><i class="fa-solid fa-play"></i></div>
      </div>
      <h4>${song.name}</h4>
      <p>${song.artist_name}</p>
    </div>
  `).join('');
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
    window._homePlaylist = tracks;

    if (!tracks.length) {
      container.innerHTML = '<p style="color:#888; padding:20px;">No songs found.</p>';
      return;
    }

    container.innerHTML = tracks.map((song, i) => `
      <div class="song-card" onclick="playSong(${i}, window._homePlaylist)">
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

  const artists = [
    { name: 'Arijit Singh',      img: 'images/artist/arjit singh.jpg',        query: 'Arijit Singh' },
    { name: 'Shreya Ghoshal',    img: 'images/artist/shreya ghoshal.jpg',     query: 'Shreya Ghoshal' },
    { name: 'Armaan Malik',      img: 'images/artist/arman malik.jpg',        query: 'Armaan Malik' },
    { name: 'Diljit Dosanjh',    img: 'images/artist/daljit dosanjih.jpg',    query: 'Diljit Dosanjh' },
    { name: 'Justin Bieber',     img: 'images/artist/Justin bieber.webp',     query: 'Justin Bieber' },
    { name: 'Taylor Swift',      img: 'images/artist/taylor swift.jpg',       query: 'Taylor Swift' },
    { name: 'Lisa',              img: 'images/artist/lisa.webp',              query: 'Lisa Blackpink' },
    { name: 'Kim Taehyung',      img: 'images/artist/kim taehyung.jpg',       query: 'BTS V Taehyung' },
    { name: 'Yo Yo Honey Singh', img: 'images/artist/yo yo honey singh.jpg',  query: 'Yo Yo Honey Singh' },
  ];

  container.innerHTML = artists.map(a => `
    <a href="html/artist.html?name=${encodeURIComponent(a.query)}" class="artist-link">
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
      <a href="html/album.html?id=${a.id}&name=${encodeURIComponent(a.name)}" class="album-card">
        <img src="${a.image}" alt="${a.name}" loading="lazy"
             onerror="this.src='images/logo_no_bg - Edited.png'">
        <h4>${a.name}</h4>
        <p style="font-size:12px;color:#777">${a.artist_name}</p>
      </a>
    `).join('');
  } catch {
    container.innerHTML = '<p style="color:#888">Could not load albums.</p>';
  }
}

// ── SEARCH ────────────────────────────────────────────────────
function handleSearch(e) {
  if (e.key === 'Enter') {
    const val = document.getElementById('searchInput').value.trim();
    if (val) window.location.href = `html/search.html?q=${encodeURIComponent(val)}`;
  }
}

function filterGenre(genre) {
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
  window.location.href = `html/artist.html?name=${encodeURIComponent(name)}`;
}

function toggleSearchBox() {
  const box = document.getElementById('searchBox');
  if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

// ── INIT ──────────────────────────────────────────────────────
updateAuthUI();
initPlayer();

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
loadRecentlyPlayed();
