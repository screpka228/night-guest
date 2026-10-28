import { emitNoise } from './noise.js';
import { startRingtone } from './sfx.js';

const RING_WINDOW = 3; // секунд на «Сбросить»

const nextDelay = () => 60 + Math.random() * 30;

// Звонящий телефон: вспышка, рингтон, кнопка «Сбросить»; не успел — шум 3 на позиции игрока
export function createPhone({ container, difficulty }) {
  const enabled = difficulty.phoneEnabled;
  let timer = nextDelay();
  let ringing = false;
  let ringTimer = 0;
  let stopTone = null;
  let flash = null;

  const btn = document.createElement('button');
  btn.className = 'phone-btn';
  btn.textContent = 'Сбросить';
  btn.hidden = true;
  container.appendChild(btn);

  function stop() {
    ringing = false;
    btn.hidden = true;
    stopTone?.();
    stopTone = null;
    timer = nextDelay();
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (ringing) stop(); // успел — тишина
  });

  function ring() {
    ringing = true;
    ringTimer = RING_WINDOW;
    btn.hidden = false;
    stopTone = startRingtone();
    flash?.remove();
    flash = document.createElement('div');
    flash.className = 'phone-flash';
    container.appendChild(flash);
    flash.addEventListener('animationend', () => {
      flash?.remove();
      flash = null;
    });
  }

  function update(dt, player) {
    if (!enabled) return;
    if (ringing) {
      ringTimer -= dt;
      if (ringTimer <= 0) {
        emitNoise(player.x, player.z, 3, { force: true });
        stop();
      }
    } else {
      timer -= dt;
      if (timer <= 0) ring();
    }
  }

  function dispose() {
    stopTone?.();
    stopTone = null;
    btn.remove();
    flash?.remove();
  }

  return { update, dispose, ring, get ringing() { return ringing; } };
}
