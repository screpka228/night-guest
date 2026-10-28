export const DIFFICULTIES = {
  practice:  { name: 'Практика',  attempts: Infinity, desc: 'Без стресса, фиксированный спавн' },
  easy:      { name: 'Легко',     attempts: 3,        desc: 'Гость медленный, галлюцинаций мало' },
  normal:    { name: 'Нормально', attempts: 3,        desc: 'Стандартный баланс' },
  hard:      { name: 'Сложно',    attempts: 1,        desc: 'Гость слышит почти всё' },
  extreme:   { name: 'Экстрим',   attempts: 1,        desc: 'Ложный гость преследует' },
  challenge: { name: 'Челлендж',  attempts: 1,        desc: 'Реальность почти неотличима' }
};

export function getDifficulty() {
  let key = null;
  try {
    key = localStorage.getItem('ng_difficulty');
  } catch {}
  return DIFFICULTIES[key] ? key : 'normal';
}
