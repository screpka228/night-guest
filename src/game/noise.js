const EMIT_INTERVAL = 0.5;
const NOISE_TTL = 2.0;

export const noiseEvents = [];
let timer = 0;
let quietTimer = 0; // после шкафа игрок молчит, метки не создаются

export const startQuiet = (sec) => {
  quietTimer = sec;
};
export const quietLeft = () => quietTimer;

// Метки шума: каждые 0.5 с движения; гость будет читать noiseEvents позже
export function updateNoise(dt, { x, z, moving, noise }) {
  if (quietTimer > 0) quietTimer = Math.max(0, quietTimer - dt);
  for (let i = noiseEvents.length - 1; i >= 0; i--) {
    noiseEvents[i].ttl -= dt;
    if (noiseEvents[i].ttl <= 0) noiseEvents.splice(i, 1);
  }
  if (!moving || quietTimer > 0) {
    timer = EMIT_INTERVAL; // первая метка сразу при начале движения
    return;
  }
  timer += dt;
  if (timer >= EMIT_INTERVAL) {
    timer = 0;
    noiseEvents.push({ x, z, intensity: noise, ttl: NOISE_TTL });
  }
}

// Разовая метка шума (укрытие в шкафу, вынужденный выход)
export function emitNoise(x, z, intensity, extra = {}) {
  if (quietTimer > 0 && !extra.force) return;
  noiseEvents.push({ x, z, intensity, ttl: NOISE_TTL, ...extra });
}

export function clearNoise() {
  noiseEvents.length = 0;
  timer = 0;
  quietTimer = 0;
}

// 0 — стоим, 1 деление — тихо, 2 — средне, 3 — громко
export function noiseLevel(noise) {
  if (noise <= 0) return 0;
  if (noise < 0.5) return 1;
  if (noise < 2) return 2;
  return 3;
}
