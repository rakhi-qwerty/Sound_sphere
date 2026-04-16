

const songs = [
  {
    title: "Mangle bhawan",
    artist: "manoranjen",
    image: "images/Shape_Of_You.png",
    audio: "songs/english/shape of you.mp3"
  },
  {
    title: "Believer",
    artist: "Imagine Dragons",
    image: "images/wanna be yours.jpg",
    audio: "songs/english/wanna be yours.mp3"
  },
  {
    title: "Faded",
    artist: "Alan Walker",
    image: "images/chahu me ya na.jpg",
    audio: "songs/hindi/chahun main ya naa.mp3"
  },
   {
    title: "Faded",
    artist: "Alan Walker",
    image: "images/i think they call this love.jpg",
    audio: "songs/english/i think they call this love.mp3"
  },
  {
    title: "Faded",
    artist: "Alan Walker",
    image: "images/harleys in huwaii.jpg",
    audio: "songs/english/Harleys in huwaii.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/Dooron-Dooron.jpg",
    audio:"songs/panjabi/Dooron Dooron.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/For a reason.jpg",
    audio:"songs/panjabi/For a reason.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/pal pal dil ke pass.jpg",
    audio:"songs/hindi/pal pal Dil ke paas.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/udaariya.jpg",
    audio:"songs/panjabi/udaarian.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/life goes on.jpg",
    audio:"songs/korean/BTS 'life goes on'.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/stay with me.jpg",
    audio:"songs/korean/punch - stay with me.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/Kabhi-Jo-Badal-Barse.jpg",
    audio:"songs/hindi/Kabhi Jo Badal Barse.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/DOPAMINE-punjabi.jpg",
    audio:"songs/panjabi/GURU RANDHAWA - DOPAMINE.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/Everytime.jpg",
    audio:"songs/korean/[MV] CHEN- Everytime.mp3"
  },
  {title: "Faded",
    artist: "Alan Walker",
    image: "images/love me like you do.jpg",
    audio:"songs/english/love me like you do.mp3"
  }

];

const container = document.getElementById("songs-container");


songs.forEach((song, index) => {
  const card = `
    <div class="song-card">
      
      <div class="img-box">
        <img src="${song.image}">
        <div class="play-btn" onclick="playSong(${index})">▶</div>
      </div>

      <h4>${song.title}</h4>
      <p>${song.artist}</p>

    </div>
  `;

  container.innerHTML += card;
});


let currentAudio = null;
let currentIndex = null;

function playSong(index) {
  const song = songs[index];

  if (currentIndex === index && currentAudio) {
    if (currentAudio.paused) {
      currentAudio.play();
    } else {
      currentAudio.pause();
    }
    return;
  }

  // stop previous
  if (currentAudio) {
    currentAudio.pause();
  }

  // play new
  const audio = new Audio(song.audio);
  audio.play();

  currentAudio = audio;
  currentIndex = index;
}





