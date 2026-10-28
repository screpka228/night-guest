import './styles/main.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { initRouter } from './router.js';

document.addEventListener(
  'pointerdown',
  () => {
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
  },
  { once: true }
);

initRouter();
