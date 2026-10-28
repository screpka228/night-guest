import * as THREE from 'three';
import { loadTextures } from '../three/textures.js';
import { loadSound, registerSample } from './audio.js';

const BASE = import.meta.env.BASE_URL;

// имя семпла → файл (звуки из haunted-house, MIT/CC0; лежат в public/assets/audio)
const SOUNDS = {
  scream: 'scream_2.wav',
  creak: 'creak.wav',
  footsteps: 'footsteps.wav',
  whisper: 'whisper.wav',
  ambience: 'ambience.wav',
  hit: 'hit_bass.wav'
};

export const assets = { textures: null };
let pending = null;

// Единая загрузка: игра стартует только когда всё готово. Ошибки не фатальны (останется заливка и синтез).
export function preloadAssets(onProgress = () => {}) {
  if (pending) return pending;
  const total = 1 + Object.keys(SOUNDS).length;
  let done = 0;
  const tick = () => onProgress(++done / total);

  const manager = new THREE.LoadingManager();
  const textures = loadTextures(manager).then((t) => {
    assets.textures = t;
    tick();
  });
  const sounds = Object.entries(SOUNDS).map(([name, file]) =>
    loadSound(BASE + 'assets/audio/' + file)
      .then((buf) => registerSample(name, buf))
      .catch(() => {}) // нет файла — работает синтез
      .then(tick)
  );
  pending = Promise.all([textures, ...sounds]);
  return pending;
}
