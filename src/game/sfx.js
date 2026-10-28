let ctx = null;

// Скример: короткий громкий шум + падающий тон
export function playScream() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const dur = 1.2;
    const now = ctx.currentTime;

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + dur);

    noise.connect(gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    osc.start(now);
    osc.stop(now + dur);
  } catch {}
}

// Затаённое дыхание: тихий фильтрованный шум с медленной пульсацией; возвращает функцию остановки
export function startBreathSound() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.07;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    lfo.start();
    return () => {
      try {
        src.stop();
        lfo.stop();
        gain.disconnect();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

// Скрип двери: низкий пилообразный тон с дрожанием
export function playCreak() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.25);
    osc.frequency.linearRampToValueAtTime(140, now + 0.7);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  } catch {}
}

// Рингтон телефона: двойной писк, пока не остановят
export function startRingtone() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    let on = false;
    const tick = () => {
      on = !on;
      osc.frequency.value = on ? 1000 : 800;
      gain.gain.value = 0.5;
    };
    tick();
    const id = setInterval(() => {
      gain.gain.value = gain.gain.value > 0 ? 0 : 0.5;
      if (gain.gain.value > 0) osc.frequency.value = Math.random() < 0.5 ? 1000 : 800;
    }, 200);
    return () => {
      clearInterval(id);
      try {
        gain.gain.value = 0;
        osc.stop();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

// Удар брошенного предмета: короткий шум и низкий тон
export function playImpact() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const dur = 0.25;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + dur);
    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    osc.start(now);
    osc.stop(now + dur);
  } catch {}
}

// Тихий стук/скрип открываемого ящика
export function playKnock() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

// Ловушка: громкий грохот
export function playTrap() {
  playImpact();
  playImpact();
  playScream();
}
