// --- Global Elements
const inputTextEl = document.getElementById("inputText");
const lyricsOut = document.getElementById("lyricsOut");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

// Tone.js analyser setup
const audioCtx = Tone.getContext().rawContext;
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const tapGain = audioCtx.createGain();
tapGain.gain.value = 0;
Tone.Destination.toAudioNode().connect(tapGain);
tapGain.connect(analyser);
tapGain.connect(audioCtx.destination);

// --- Dark Mode Toggle
document.getElementById("darkModeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// --- Save & Load Lyrics
document.getElementById("saveLyricsBtn").addEventListener("click", () => {
  localStorage.setItem("savedLyrics", lyricsOut.textContent);
  alert("Lyrics saved!");
});
document.getElementById("loadLyricsBtn").addEventListener("click", () => {
  const saved = localStorage.getItem("savedLyrics");
  if (saved) lyricsOut.textContent = saved;
  else alert("No lyrics saved yet.");
});

// --- Download Lyrics
document.getElementById("downloadLyricsBtn").addEventListener("click", () => {
  const lyrics = lyricsOut.textContent.trim();
  if (!lyrics) return alert("No lyrics to download!");
  const blob = new Blob([lyrics], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lyrics.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// --- File Upload
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    const text = await file.text();
    inputTextEl.value = text;
  }
});

// --- Drag & Drop Upload (desktop only)
const dropZone = document.getElementById("dropZone");
if (dropZone) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    const text = await file.text();
    inputTextEl.value = text;
  });
}

// --- Lyric Composition (simple demo)
function composeLyrics(text, lang) {
  const lines = text.split(/\n|\.|\?|!/).filter(Boolean).slice(0, 8);
  return lines.map((line, i) => `${lang.toUpperCase()} Line ${i + 1}: ${line.trim()}`).join("\n");
}
document.getElementById("composeLyricsBtn").addEventListener("click", () => {
  const text = inputTextEl.value.trim();
  const lang = document.getElementById("language").value;
  if (!text) return alert("Please enter text!");
  lyricsOut.textContent = composeLyrics(text, lang);
});

// --- Music Composition Demo
document.getElementById("composeMusicBtn").addEventListener("click", async () => {
  await Tone.start();
  const synth = new Tone.Synth().toDestination();
  const notes = ["C4", "E4", "G4", "B4", "C5"];
  let i = 0;
  const loop = new Tone.Loop((time) => {
    synth.triggerAttackRelease(notes[i % notes.length], "8n", time);
    i++;
  }, "4n").start(0);
  Tone.Transport.start();
  statusEl.textContent = "Music started 🎶";
});
document.getElementById("stopMusicBtn").addEventListener("click", () => {
  Tone.Transport.stop();
  statusEl.textContent = "Music stopped ⏹️";
});

// --- Recording Logic
let mediaRecorder;
let recordedChunks = [];
let progressInterval;
let recordingActive = false;
let previewBlob = null;

// Playlist state
const playlistEl = document.getElementById("playlist");
let playlist = [];
let currentTrackIndex = -1;
let currentAudio = null;
let loopMode = false;

// Volume + mute
const volumeControl = document.getElementById("volumeControl");
let currentVolume = 1;
let isMuted = false;
volumeControl.addEventListener("input", () => {
  currentVolume = parseFloat(volumeControl.value);
  if (!isMuted) statusEl.textContent = `Volume ${(currentVolume * 100).toFixed(0)}% 🔊`;
});
document.getElementById("muteBtn").addEventListener("click", () => {
  isMuted = !isMuted;
  document.getElementById("muteBtn").textContent = isMuted ? "🔊 Unmute" : "🔇 Mute";
  statusEl.textContent = isMuted ? "Muted 🔇" : `Unmuted, volume ${(currentVolume * 100).toFixed(0)}% 🔊`;
});

// --- Playback helpers
function playAudio(url, trackName = "Preview") {
  if (currentAudio) currentAudio.pause();
  const audio = new Audio(url);
  audio.volume = isMuted ? 0 : currentVolume;
  audio.play();
  currentAudio = audio;
  statusEl.textContent = `Playing ${trackName} 🎧 ${isMuted ? "(Muted)" : ""}`;
  attachProgressUpdater(audio);
  audio.onended = () => {
    currentAudio = null;
    document.getElementById("trackProgress").value = 0;
    statusEl.textContent = `${trackName} finished ✅`;
  };
}

// --- Pause/Resume
document.getElementById("pauseResumeBtn").addEventListener("click", () => {
  if (!currentAudio) return alert("No audio playing!");
  if (currentAudio.paused) {
    currentAudio.play();
    statusEl.textContent = "Resumed ▶️";
    document.getElementById("pauseResumeBtn").textContent = "⏸️ Pause";
  } else {
    currentAudio.pause();
    statusEl.textContent = "Paused ⏸️";
    document.getElementById("pauseResumeBtn").textContent = "▶️ Resume";
  }
});

// --- Track Progress + Seek
const trackProgress = document.getElementById("trackProgress");
function attachProgressUpdater(audio) {
  audio.addEventListener("timeupdate", () => {
    if (audio.duration > 0) {
      trackProgress.value = (audio.currentTime / audio.duration) * 100;
    }
  });
  audio.addEventListener("ended", () => {
    trackProgress.value = 0;
  });
}
trackProgress.addEventListener("input", () => {
  if (currentAudio && currentAudio.duration > 0) {
    const seekTime = (trackProgress.value / 100) * currentAudio.duration;
    currentAudio.currentTime = seekTime;
    statusEl.textContent = `Seeked to ${trackProgress.value}% ⏩`;
  }
});

// --- Recording to Playlist
document.getElementById("downloadMusicBtn").addEventListener("click", async () => {
  await Tone.start();
  const mediaDest = audioCtx.createMediaStreamDestination();
  Tone.Destination.toAudioNode().connect(mediaDest);
  mediaRecorder = new MediaRecorder(mediaDest.stream);
  recordedChunks = [];
  recordingActive = true;
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    clearInterval(progressInterval);
    document.getElementById("recordProgress").value = 0;
    recordingActive = false;
    if (recordedChunks.length > 0) {
      previewBlob = new Blob(recordedChunks, { type: "audio/webm" });
      addToPlaylist(previewBlob);
      statusEl.textContent = "Recording complete ✅";
    } else statusEl.textContent = "Recording cancelled ❌";
  };
  const length = parseInt(document.getElementById("recordLength").value) || 10;
  mediaRecorder.start();
  statusEl.textContent = `Recording for ${length} seconds...`;
  const progressBar = document.getElementById("recordProgress");
  let elapsed = 0;
  progressBar.value = 0;
  progressBar.max = length;
  progressInterval = setInterval(() => {
    if (!recordingActive) return;
    elapsed++;
    progressBar.value = elapsed;
    if (elapsed >= length) clearInterval(progressInterval);
  }, 1000);
  setTimeout(() => { if (recordingActive) mediaRecorder.stop(); }, length * 1000);
});

// Cancel Recording
document.getElementById("cancelRecordingBtn").addEventListener("click", () => {
  if (recordingActive && mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch (e) {
      // ignore if already stopped
    }
    recordingActive = false;
    clearInterval(progressInterval);
    const progressBar = document.getElementById("recordProgress");
    if (progressBar) {
      progressBar.value = 0;
    }
    statusEl.textContent = "Recording cancelled ❌";
  } else {
    statusEl.textContent = "No active recording to cancel.";
  }
});
