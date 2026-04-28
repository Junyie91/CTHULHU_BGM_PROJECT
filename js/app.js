// ── Scene & SFX Data ──────────────────────────────────────────────────────────
// BGM: each scene has 3 tracks. Add your mp3 paths when ready.
// Paths are relative to index.html, e.g. 'audio/01-arkham-street/track1.mp3'

const scenes = [
  {
    id: 'daily-street',
    name: '日常街道',
    emoji: '🏙️',
    tracks: [
      'audio/01-daily-street/track1.mp3',
      'audio/01-daily-street/track2.mp3',
      'audio/01-daily-street/track3.mp3',
    ],
  },
  {
    id: 'indoor-explore',
    name: '室內探索',
    emoji: '🕯️',
    tracks: [
      'audio/02-indoor-explore/track1.mp3',
      'audio/02-indoor-explore/track2.mp3',
      'audio/02-indoor-explore/track3.mp3',
    ],
  },
  {
    id: 'wilderness',
    name: '野外荒地',
    emoji: '🌿',
    tracks: [
      'audio/03-wilderness/track1.mp3',
      'audio/03-wilderness/track2.mp3',
      'audio/03-wilderness/track3.mp3',
    ],
  },
  {
    id: 'peaceful',
    name: '片刻安寧',
    emoji: '🌙',
    tracks: [
      'audio/04-peaceful/track1.mp3',
      'audio/04-peaceful/track2.mp3',
      'audio/04-peaceful/track3.mp3',
    ],
  },
  {
    id: 'combat-chase',
    name: '戰鬥追逐',
    emoji: '⚔️',
    tracks: [
      'audio/05-combat-chase/track1.mp3',
      'audio/05-combat-chase/track2.mp3',
      'audio/05-combat-chase/track3.mp3',
    ],
  },
  {
    id: 'dread',
    name: '恐懼逼近',
    emoji: '😰',
    tracks: [
      'audio/06-dread/track1.mp3',
      'audio/06-dread/track2.mp3',
      'audio/06-dread/track3.mp3',
    ],
  },
  {
    id: 'mythos',
    name: '神秘顯現',
    emoji: '🐙',
    tracks: [
      'audio/07-mythos/track1.mp3',
      'audio/07-mythos/track2.mp3',
      'audio/07-mythos/track3.mp3',
    ],
  },
];

const soundEffects = {
  environment: [
    { id: 'thunder',    name: '雷聲',   file: 'audio/sfx/thunder.mp3' },
    { id: 'heavy-rain', name: '大雨',   file: 'audio/sfx/heavy-rain.mp3' },
    { id: 'wind',       name: '風聲',   file: 'audio/sfx/wind.mp3' },
    { id: 'drip',       name: '滴水聲', file: 'audio/sfx/drip.mp3' },
    { id: 'fire',       name: '燃燒', file: 'audio/sfx/fire-burning.mp3' },
  ],
  indoor: [
    { id: 'door-open',  name: '開門聲',   file: 'audio/sfx/door-open.mp3' },
    { id: 'door-creak', name: '吱呀門聲', file: 'audio/sfx/door-creak.mp3' },
    { id: 'glass',      name: '玻璃破碎', file: 'audio/sfx/glass-break.mp3' },
    { id: 'book',       name: '翻書聲',   file: 'audio/sfx/book-flip.mp3' },
    { id: 'phone',      name: '老式電話鈴', file: 'audio/sfx/old-phone.mp3' },
  ],
  character: [
    { id: 'gunshot',    name: '槍聲',     file: 'audio/sfx/gunshot.mp3' },
    { id: 'footsteps',  name: '腳步聲',   file: 'audio/sfx/footsteps.mp3' },
    { id: 'heartbeat',  name: '心跳加速', file: 'audio/sfx/heartbeat.mp3' },
    { id: 'scream',     name: '尖叫聲',   file: 'audio/sfx/scream.mp3' },
  ],
  cthulhu: [
    { id: 'sting',      name: '神秘音效', file: 'audio/sfx/mystery-sting.mp3' },
    { id: 'madness',    name: '瘋狂笑聲', file: 'audio/sfx/mad-laugh.mp3' },
    { id: 'deep-drone', name: '深海低鳴', file: 'audio/sfx/deep-drone.mp3' },
  ],
};

// ── Audio Engine ──────────────────────────────────────────────────────────────

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

async function ensureCtx() {
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') await ctx.resume();
}

// BGM state
let bgmAudio = null;
let bgmGain = null;
let currentSceneData = null;    // full scene object for track cycling
let currentTrackIndex = 0;
let currentSceneId = null;
let isMuted = false;
let bgmTargetVolume = 0.7;  // 0–1, mirrors slider
let sfxTargetVolume = 0.8;

// Duck state
let duckTimer = null;
let activeSfxCount = 0;

function fadeBgmGain(targetVal, durationSec) {
  if (!bgmGain) return;
  const now = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
  bgmGain.gain.linearRampToValueAtTime(targetVal, now + durationSec);
}

// Build audio chain and start playing a single track
function startTrack(src) {
  if (!ctx) return;

  // Fade out and destroy old chain
  if (bgmAudio) {
    const oldAudio = bgmAudio;
    const oldGain = bgmGain;
    if (oldGain) {
      const now = ctx.currentTime;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + 1.5);
    }
    oldAudio.removeEventListener('ended', onBgmEnded);
    setTimeout(() => { oldAudio.pause(); oldAudio.src = ''; }, 1600);
  }

  const audio = new Audio(src);

  // Single track: built-in loop. Multi-track: ended → next.
  if (currentSceneData && currentSceneData.tracks.length === 1) {
    audio.loop = true;
  } else {
    audio.addEventListener('ended', onBgmEnded);
  }

  let source;
  try {
    source = ctx.createMediaElementSource(audio);
  } catch (err) {
    console.error('createMediaElementSource 失敗:', err);
    return;
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);

  bgmAudio = audio;
  bgmGain = gain;

  audio.play().catch(err => console.error('播放失败 (路径: ' + src + '):', err));

  const effectiveVol = isMuted ? 0 : (bgmTargetVolume * (activeSfxCount > 0 ? 0.3 : 1));
  fadeBgmGain(effectiveVol, 2);
}

// When a multi-track scene's current track ends, play the next one
function onBgmEnded() {
  if (!currentSceneData) return;
  const tracks = currentSceneData.tracks;

  if (tracks.length === 1) {
    // Fallback: seamless loop
    if (bgmAudio) {
      bgmAudio.currentTime = 0;
      bgmAudio.play().catch(err => console.error('循环播放失败:', err));
    }
    return;
  }

  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  startTrack(tracks[currentTrackIndex]);
}

async function playScene(scene) {
  try {
    await ensureCtx();
  } catch (err) {
    console.error('AudioContext 初始化失败:', err);
    return;
  }

  currentSceneData = scene;
  currentTrackIndex = 0;
  currentSceneId = scene.id;

  startTrack(scene.tracks[0]);
}

function startDuck() {
  activeSfxCount++;
  if (duckTimer) { clearTimeout(duckTimer); duckTimer = null; }
  if (!isMuted) fadeBgmGain(bgmTargetVolume * 0.15, 0.1);
}

function endDuck() {
  activeSfxCount = Math.max(0, activeSfxCount - 1);
  if (activeSfxCount === 0) {
    duckTimer = setTimeout(() => {
      if (!isMuted) fadeBgmGain(bgmTargetVolume, 1.5);
    }, 100);
  }
}

// ── SFX Engine (single active) ──────────────────────────────────────────────────

let sfxState = {
  activeWrap: null,     // DOM .btn-wrap currently active
  audio: null,          // Audio element (persisted for pause/resume)
  gain: null,           // GainNode
  paused: false,
  progressAnimId: null, // requestAnimationFrame id
};

function cleanupSfx(fullCleanup) {
  if (sfxState.progressAnimId) {
    cancelAnimationFrame(sfxState.progressAnimId);
    sfxState.progressAnimId = null;
  }
  if (sfxState.audio) {
    sfxState.audio.removeEventListener('ended', onSfxEnded);
    sfxState.audio.removeEventListener('error', onSfxEnded);
    sfxState.audio.pause();
    sfxState.audio.src = '';
    sfxState.audio = null;
  }
  if (sfxState.gain) {
    sfxState.gain.disconnect();
    sfxState.gain = null;
  }
  if (sfxState.activeWrap) {
    resetSfxUI(sfxState.activeWrap);
    sfxState.activeWrap = null;
  }
  sfxState.paused = false;
  if (fullCleanup !== false) endDuck();
}

function resetSfxUI(wrap) {
  const progress = wrap.querySelector('.sfx-progress');
  const pauseBtn  = wrap.querySelector('.sfx-pause');
  const stopBtn   = wrap.querySelector('.sfx-stop');
  if (progress) progress.style.transform = 'scaleX(0)';
  if (pauseBtn) {
    pauseBtn.classList.remove('visible');
    pauseBtn.textContent = '⏸'; // ⏸
  }
  if (stopBtn) stopBtn.classList.remove('visible');
}

function showSfxUI(wrap) {
  const pauseBtn = wrap.querySelector('.sfx-pause');
  const stopBtn  = wrap.querySelector('.sfx-stop');
  if (pauseBtn) pauseBtn.classList.add('visible');
  if (stopBtn)  stopBtn.classList.add('visible');
}

function updateProgress() {
  if (!sfxState.audio || sfxState.paused) {
    sfxState.progressAnimId = null;
    return;
  }
  const dur = sfxState.audio.duration;
  if (dur && isFinite(dur) && sfxState.activeWrap) {
    const pct = sfxState.audio.currentTime / dur;
    const bar = sfxState.activeWrap.querySelector('.sfx-progress');
    if (bar) bar.style.transform = `scaleX(${pct})`;
  }
  sfxState.progressAnimId = requestAnimationFrame(updateProgress);
}

function onSfxEnded() {
  cleanupSfx();
}

async function playSfx(sfxData, wrap) {
  try { await ensureCtx(); } catch (err) { console.error(err); return; }

  // Same button: toggle pause
  if (sfxState.activeWrap === wrap && sfxState.audio) {
    if (sfxState.paused) { resumeSfx(); }
    else                 { pauseSfx(); }
    return;
  }

  // Different button: stop old (keep BGM ducked for seamless switch)
  const wasPlaying = sfxState.audio && !sfxState.paused;
  cleanupSfx(false);

  // Build audio chain
  const audio = new Audio(sfxData.file);
  let source;
  try {
    source = ctx.createMediaElementSource(audio);
  } catch (err) {
    console.error('createMediaElementSource 失败:', err);
    return;
  }

  const gain = ctx.createGain();
  gain.gain.value = sfxTargetVolume;
  source.connect(gain);
  gain.connect(ctx.destination);

  sfxState.audio = audio;
  sfxState.gain = gain;
  sfxState.activeWrap = wrap;
  sfxState.paused = false;

  if (!wasPlaying) startDuck();

  audio.addEventListener('ended', onSfxEnded);
  audio.addEventListener('error', onSfxEnded);

  try {
    await audio.play();
  } catch (err) {
    console.error('音效播放失败:', err);
    cleanupSfx();
    return;
  }

  showSfxUI(wrap);
  updateProgress();
}

function pauseSfx() {
  if (!sfxState.audio || sfxState.paused) return;
  sfxState.audio.pause();
  sfxState.paused = true;
  endDuck();
  const btn = sfxState.activeWrap.querySelector('.sfx-pause');
  if (btn) btn.textContent = '▶'; // ▶
}

function resumeSfx() {
  if (!sfxState.audio || !sfxState.paused) return;
  sfxState.audio.play().catch(err => console.error('恢复失败:', err));
  sfxState.paused = false;
  startDuck();
  const btn = sfxState.activeWrap.querySelector('.sfx-pause');
  if (btn) btn.textContent = '⏸'; // ⏸
  updateProgress();
}

function stopSfx() {
  cleanupSfx();
}

function setMute(muted) {
  isMuted = muted;
  if (bgmGain) {
    fadeBgmGain(muted ? 0 : bgmTargetVolume, 0.3);
  }
}

function setBgmVolume(val) {
  bgmTargetVolume = val;
  if (bgmGain && !isMuted) {
    const target = activeSfxCount > 0 ? val * 0.3 : val;
    fadeBgmGain(target, 0.1);
  }
}

function setSfxVolume(val) {
  sfxTargetVolume = val;
  if (sfxState.gain) {
    sfxState.gain.gain.value = val;
  }
}

// ── UI Rendering ──────────────────────────────────────────────────────────────

const sceneTrigger  = document.getElementById('sceneTrigger');
const sceneTriggerLabel = document.getElementById('sceneTriggerLabel');
const sceneDropdown = document.getElementById('sceneDropdown');
const sceneList     = document.getElementById('sceneList');
const backdrop      = document.getElementById('backdrop');
const muteBtn       = document.getElementById('muteBtn');
const bgmVolumeSlider = document.getElementById('bgmVolume');
const bgmVolumeValue  = document.getElementById('bgmVolumeValue');
const sfxVolumeSlider = document.getElementById('sfxVolume');
const sfxVolumeValue  = document.getElementById('sfxVolumeValue');
const sfxTabs       = document.getElementById('sfxTabs');
const sfxGrid       = document.getElementById('sfxGrid');

// Build scene list
scenes.forEach((scene) => {
  const li = document.createElement('li');
  li.className = 'scene-item';
  li.dataset.id = scene.id;
  li.innerHTML = `
    <span class="scene-emoji">${scene.emoji}</span>
    <span class="scene-name">${scene.name}</span>
  `;
  li.addEventListener('click', () => selectScene(scene, li));
  sceneList.appendChild(li);
});

function selectScene(scene, li) {
  // Update active highlight
  sceneList.querySelectorAll('.scene-item').forEach(el => el.classList.remove('active'));
  li.classList.add('active');

  // Update trigger label
  sceneTriggerLabel.textContent = `當前場景：${scene.emoji} ${scene.name}`;

  closeDropdown();
  playScene(scene);
}

// Dropdown open/close
function openDropdown() {
  sceneDropdown.classList.add('open');
  sceneTrigger.classList.add('open');
  backdrop.classList.add('active');
  sceneDropdown.removeAttribute('aria-hidden');
}

function closeDropdown() {
  sceneDropdown.classList.remove('open');
  sceneTrigger.classList.remove('open');
  backdrop.classList.remove('active');
  sceneDropdown.setAttribute('aria-hidden', 'true');
}

sceneTrigger.addEventListener('click', () => {
  sceneDropdown.classList.contains('open') ? closeDropdown() : openDropdown();
});

backdrop.addEventListener('click', closeDropdown);

// Mute
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  setMute(isMuted);
  muteBtn.classList.toggle('muted', isMuted);
  muteBtn.querySelector('.mute-icon').src = isMuted ? 'image/decorate/volume-off.png' : 'image/decorate/volume-on.png';
});

// Volume sliders
function updateSliderFill(slider) {
  slider.style.setProperty('--val', slider.value + '%');
}

bgmVolumeSlider.addEventListener('input', () => {
  const val = bgmVolumeSlider.value / 100;
  bgmVolumeValue.textContent = bgmVolumeSlider.value + '%';
  updateSliderFill(bgmVolumeSlider);
  setBgmVolume(val);
});

sfxVolumeSlider.addEventListener('input', () => {
  const val = sfxVolumeSlider.value / 100;
  sfxVolumeValue.textContent = sfxVolumeSlider.value + '%';
  updateSliderFill(sfxVolumeSlider);
  setSfxVolume(val);
});

// Init slider fills
updateSliderFill(bgmVolumeSlider);
updateSliderFill(sfxVolumeSlider);

// SFX Tabs
let activeCategory = 'environment';

function renderSfxGrid(category) {
  cleanupSfx();
  sfxGrid.innerHTML = '';
  (soundEffects[category] || []).forEach(sfx => {
    const wrap = document.createElement('span');
    wrap.className = 'btn-wrap';
    wrap.innerHTML = `
      <button class="sfx-btn">
        <div class="sfx-progress"></div>
        <span class="sfx-name">${sfx.name}</span>
      </button>
      <button class="sfx-pause" title="暂停 / 继续">⏸</button>
      <button class="sfx-stop" title="停止">⏹</button>
    `;

    // Main button click → play / toggle pause
    wrap.querySelector('.sfx-btn').addEventListener('click', () => {
      playSfx(sfx, wrap);
    });

    // Pause / Resume
    wrap.querySelector('.sfx-pause').addEventListener('click', (e) => {
      e.stopPropagation();
      if (sfxState.activeWrap === wrap) {
        sfxState.paused ? resumeSfx() : pauseSfx();
      }
    });

    // Stop / Reset
    wrap.querySelector('.sfx-stop').addEventListener('click', (e) => {
      e.stopPropagation();
      if (sfxState.activeWrap === wrap) {
        stopSfx();
      }
    });

    sfxGrid.appendChild(wrap);
  });
}

sfxTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.sfx-tab');
  if (!tab) return;
  sfxTabs.querySelectorAll('.sfx-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeCategory = tab.dataset.category;
  renderSfxGrid(activeCategory);
});

// Initial render
renderSfxGrid(activeCategory);
