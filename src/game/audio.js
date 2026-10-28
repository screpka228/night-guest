// Процедурный звук на Web Audio API: гул, сердцебиение, шёпот, шаги, скример. Без файлов.
let ctx = null;
let master = null;
let drone = null;
let heartTimer = 0;
let playerStepTimer = 0;
let ghostStepTimer = 0;
let noiseBuf = null;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

// Инициализация только после первого тапа (см. main.js)
export function initAudio() {
  try {
    const c = getAudioContext();
    if (c.state === 'suspended') c.resume();
  } catch {}
}

export function suspendAudio() {
  try {
    ctx?.suspend();
  } catch {}
}
export function resumeAudio() {
  try {
    ctx?.resume();
  } catch {}
}

function noiseBuffer() {
  const c = getAudioContext();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const out = () => {
  getAudioContext();
  return master;
};

// Фоновый гул: sawtooth 40 и 55 Гц → lowpass 150 Гц → gain 0.05, «дышит» от медленного LFO
export function startDrone() {
  try {
    if (drone) return;
    const c = getAudioContext();
    const g = c.createGain();
    g.gain.value = 0.05;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = o2.type = 'sawtooth';
    o1.frequency.value = 40;
    o2.frequency.value = 55;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    g.connect(out());
    o1.start();
    o2.start();
    lfo.start();
    drone = { o1, o2, lfo, g };
  } catch {}
}

export function stopAmbient() {
  try {
    if (drone) {
      drone.o1.stop();
      drone.o2.stop();
      drone.lfo.stop();
      drone.g.disconnect();
      drone = null;
    }
  } catch {}
  heartTimer = playerStepTimer = ghostStepTimer = 0;
}

// Один удар сердца: sine 60 Гц падает до 30 Гц за 0.1 с
function beat(at, vol) {
  const c = getAudioContext();
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(60, at);
  o.frequency.exponentialRampToValueAtTime(30, at + 0.1);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
  o.connect(g);
  g.connect(out());
  o.start(at);
  o.stop(at + 0.2);
}

// Шаг: шум 0.05 с через lowpass; у гостя ниже, громче и с эхом (DelayNode)
export function step({ ghost = false, volume = 0.3, pan = 0 } = {}) {
  try {
    const c = getAudioContext();
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = ghost ? 120 : 200;
    const g = c.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(f);
    f.connect(g);
    let tail = g;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(out());
    if (ghost) {
      const delay = c.createDelay(0.5);
      delay.delayTime.value = 0.18;
      const fb = c.createGain();
      fb.gain.value = 0.35;
      tail.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(out());
    }
    src.start(now, Math.random() * 1.5, 0.05);
  } catch {}
}

// Шёпот: белый шум → bandpass 1000 Гц, Q=5 → панорама влево/вправо
export function whisper() {
  try {
    const c = getAudioContext();
    const now = c.currentTime;
    const dur = 0.9;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1000, now);
    f.frequency.linearRampToValueAtTime(1000 + (Math.random() * 600 - 300), now + dur);
    f.Q.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.35, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f);
    f.connect(g);
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.random() < 0.5 ? -0.8 : 0.8;
      g.connect(p);
      p.connect(out());
    } else {
      g.connect(out());
    }
    src.start(now, Math.random(), dur);
  } catch {}
}

// Скример при поимке: square 800 → 100 Гц за 0.5 с и всплеск белого шума
export function scream() {
  try {
    const c = getAudioContext();
    if (c.state === 'suspended') c.resume();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(800, now);
    o.frequency.exponentialRampToValueAtTime(100, now + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    o.connect(g);
    g.connect(out());
    o.start(now);
    o.stop(now + 0.65);
    const n = c.createBufferSource();
    n.buffer = noiseBuffer();
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.8, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    n.connect(ng);
    ng.connect(out());
    n.start(now, 0, 0.5);
  } catch {}
}

const STEP_INTERVAL = { walk: 0.55, run: 0.3, crouch: 0.9 };
const STEP_VOLUME = { walk: 0.25, run: 0.45, crouch: 0.08 };

// Вызывать каждый кадр: сердцебиение (от стресса и близости гостя), шаги игрока и гостя
export function updateAudio(dt, { heartK = 0, moving, mode, ghostMoving, ghostSpeed, ghostDist, ghostPan }) {
  if (!ctx || ctx.state !== 'running') return;
  // сердцебиение: каждые 1.5 с два удара, чем выше стресс — тем чаще и громче
  heartTimer -= dt;
  if (heartTimer <= 0) {
    heartTimer = 1.5 - 0.9 * heartK;
    const vol = 0.12 + 0.55 * heartK;
    const now = ctx.currentTime;
    beat(now, vol);
    beat(now + 0.22, vol * 0.8);
  }
  if (moving) {
    playerStepTimer -= dt;
    if (playerStepTimer <= 0) {
      playerStepTimer = STEP_INTERVAL[mode] || 0.55;
      step({ volume: STEP_VOLUME[mode] ?? 0.25, pan: 0 });
    }
  } else {
    playerStepTimer = 0;
  }
  if (ghostMoving && ghostDist < 18) {
    ghostStepTimer -= dt;
    if (ghostStepTimer <= 0) {
      ghostStepTimer = Math.max(0.25, 0.7 / Math.max(ghostSpeed, 0.5));
      step({ ghost: true, volume: Math.max(0.05, 0.7 * (1 - ghostDist / 18)), pan: ghostPan });
    }
  }
}
