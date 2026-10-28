import './styles/main.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { initRouter } from './router.js';
import { initAudio } from './game/audio.js';

document.addEventListener(
  'pointerdown',
  () => {
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
    initAudio(); // звук создаётся только после первого тапа
  },
  { once: true }
);

initRouter();
