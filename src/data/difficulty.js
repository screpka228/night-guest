export const DIFFICULTIES = {
  practice:  { name: 'Практика',  attempts: Infinity, ghostSpeed: 0.5, hearingRadius: 1,  hallucinationRate: 0,   fakeGhost: false, fixedSpawn: true,  phoneEnabled: false },
  easy:      { name: 'Легко',     attempts: 3,        ghostSpeed: 0.7, hearingRadius: 3,  hallucinationRate: 0.3, fakeGhost: false, fixedSpawn: false, phoneEnabled: true },
  normal:    { name: 'Нормально', attempts: 3,        ghostSpeed: 1.0, hearingRadius: 5,  hallucinationRate: 0.6, fakeGhost: false, fixedSpawn: false, phoneEnabled: true },
  hard:      { name: 'Сложно',    attempts: 1,        ghostSpeed: 1.3, hearingRadius: 8,  hallucinationRate: 1.0, fakeGhost: true,  fixedSpawn: false, phoneEnabled: true },
  extreme:   { name: 'Экстрим',   attempts: 1,        ghostSpeed: 1.6, hearingRadius: 12, hallucinationRate: 1.5, fakeGhost: true,  fixedSpawn: false, phoneEnabled: true },
  challenge: { name: 'Челлендж',  attempts: 1,        ghostSpeed: 1.9, hearingRadius: 15, hallucinationRate: 2.0, fakeGhost: true,  fixedSpawn: false, phoneEnabled: true }
};

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const getDifficultyKey = () => {
  const key = read('ng_difficulty');
  return DIFFICULTIES[key] ? key : 'normal';
};
export const getDifficulty = () => DIFFICULTIES[getDifficultyKey()];

// Выбор сложности сбрасывает попытки до максимума для неё
export function resetAttempts(key) {
  try {
    localStorage.setItem('ng_attempts_left', String(DIFFICULTIES[key].attempts));
  } catch {}
}

export function getAttemptsLeft() {
  const v = Number(read('ng_attempts_left'));
  return read('ng_attempts_left') !== null && !Number.isNaN(v) ? v : getDifficulty().attempts;
}

// Списывает одну попытку (в практике они бесконечны); возвращает остаток
export function spendAttempt() {
  const left = getAttemptsLeft();
  if (left === Infinity) return Infinity;
  const next = Math.max(0, left - 1);
  try {
    localStorage.setItem('ng_attempts_left', String(next));
  } catch {}
  return next;
}
