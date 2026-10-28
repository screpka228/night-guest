const EMIT_INTERVAL = 0.5;
const NOISE_TTL = 2.0;

export const noiseEvents = [];
let timer = 0;

// Метки шума: каждые 0.5 с движения; гость будет читать noiseEvents позже
export function updateNoise(dt, { x, z, moving, noise }) {
  for (let i = noiseEvents.length - 1; i >= 0; i--) {
    noiseEvents[i].ttl -= dt;
    if (noiseEvents[i].ttl <= 0) noiseEvents.splice(i, 1);
  }
  if (!moving) {
    timer = EMIT_INTERVAL; // первая метка сразу при начале движения
    return;
  }
  timer += dt;
  if (timer >= EMIT_INTERVAL) {
    timer = 0;
    noiseEvents.push({ x, z, intensity: noise, ttl: NOISE_TTL });
  }
}

export function clearNoise() {
  noiseEvents.length = 0;
  timer = 0;
}

// 1 деление — тихо, 2 — средне, 3 — громко
export function noiseLevel(noise) {
  if (noise < 0.5) return 1;
  if (noise < 2) return 2;
  return 3;
}
