// Раскладка содержимого по точкам: ключи, ложные тайники, ловушка, масло, 3 метательных предмета
const LAST_KEY_ROOM = 'ng_last_key_room';

const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// spots: [{ id, room, ... }] → { contents: { [spotId]: { type } }, keysSpot }
export function spawnContents(spots) {
  let lastRoom = null;
  try {
    lastRoom = localStorage.getItem(LAST_KEY_ROOM);
  } catch {}

  // ключи: не в спальне (старт) и не в комнате прошлой игры
  let candidates = spots.filter((s) => s.room !== 'bedroom' && s.room !== lastRoom);
  if (!candidates.length) candidates = spots.filter((s) => s.room !== 'bedroom');
  const keysSpot = candidates[(Math.random() * candidates.length) | 0];
  try {
    localStorage.setItem(LAST_KEY_ROOM, keysSpot.room);
  } catch {}

  const contents = { [keysSpot.id]: { type: 'keys' } };
  const rest = shuffle(spots.filter((s) => s !== keysSpot));
  const types = ['decoyCan', 'decoyNote', 'trap', 'oil', 'bottle', 'can', 'carkeys'];
  types.forEach((type, i) => {
    if (rest[i]) contents[rest[i].id] = { type };
  });
  return { contents, keysSpot };
}
