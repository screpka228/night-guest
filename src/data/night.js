export const MAX_NIGHT = 5;

export function getNight() {
  let v = 1;
  try {
    v = parseInt(localStorage.getItem('ng_night'), 10);
  } catch {}
  return Number.isFinite(v) && v >= 1 && v <= MAX_NIGHT ? v : 1;
}

// После концовки A или C: следующая ночь, а после 5-й — титры и сброс на первую
export function advanceNight() {
  const n = getNight();
  const next = n >= MAX_NIGHT ? 1 : n + 1;
  try {
    localStorage.setItem('ng_night', String(next));
  } catch {}
  return { next, credits: n >= MAX_NIGHT };
}
