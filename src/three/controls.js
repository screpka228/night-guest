import { isBlocked } from './collision.js';
import { getSensitivity, getJoystickSize, getControlsSide } from '../data/settings.js';

const MODES = {
  walk:   { speed: 1.5, noise: 1,   eye: 1.6 },
  run:    { speed: 3.0, noise: 3,   eye: 1.6 },
  crouch: { speed: 0.6, noise: 0.3, eye: 1.2 } // камера ниже на 0.4 м
};
const LOOK_FACTOR = 0.006;
const DOUBLE_TAP_MS = 300;
const PLAYER_RADIUS = 0.3;
const THUMB_MAX = 40;
const PITCH_LIMIT = Math.PI / 3;
const HIDE_YAW = Math.PI / 6; // ±30° из шкафа
const HIDE_EYE = 1.5;

export function initControls(camera, canvas, { colliders, dynamicColliders = [], container, onModeChange }) {
  let sensitivity = getSensitivity();
  let side = getControlsSide();

  const base = document.createElement('div');
  base.className = 'joystick';
  const thumb = document.createElement('div');
  thumb.className = 'joystick-thumb';
  base.appendChild(thumb);
  container.appendChild(base);

  // --- режимы движения ---
  let mode = 'walk';
  let eye = MODES.walk.eye;

  const buttons = document.createElement('div');
  buttons.className = 'mode-buttons';
  buttons.innerHTML = '<button class="mode-btn" data-mode="run">Бег</button><button class="mode-btn" data-mode="crouch">Присесть</button>';
  container.appendChild(buttons);

  function setMode(next) {
    mode = mode === next ? 'walk' : next; // повторное нажатие возвращает шаг
    buttons.querySelectorAll('.mode-btn').forEach((b) => {
      b.className = 'mode-btn' + (b.dataset.mode === mode ? ' active-' + mode : '');
    });
    onModeChange?.(mode, MODES[mode]);
  }
  // pointerdown надёжнее click при мультитаче (пальцы на джойстике и камере)
  buttons.querySelectorAll('.mode-btn').forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setMode(b.dataset.mode);
    })
  );

  function applyLayout() {
    sensitivity = getSensitivity();
    side = getControlsSide();
    const size = getJoystickSize();
    base.style.width = base.style.height = size + 'px';
    base.style.left = side === 'left' ? 'calc(24px + env(safe-area-inset-left))' : 'auto';
    base.style.right = side === 'right' ? 'calc(24px + env(safe-area-inset-right))' : 'auto';
    // кнопки режимов — на противоположной стороне от джойстика
    buttons.style.left = side === 'right' ? 'calc(24px + env(safe-area-inset-left))' : 'auto';
    buttons.style.right = side === 'left' ? 'calc(24px + env(safe-area-inset-right))' : 'auto';
  }
  applyLayout();

  // --- джойстик ---
  let stickId = null;
  let lastTap = 0;
  let center = { x: 0, y: 0 };
  const stick = { x: 0, y: 0 }; // -1..1, y вниз по экрану

  function setThumb(dx, dy) {
    thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function moveStick(e) {
    let dx = e.clientX - center.x;
    let dy = e.clientY - center.y;
    const len = Math.hypot(dx, dy);
    if (len > THUMB_MAX) {
      dx = (dx / len) * THUMB_MAX;
      dy = (dy / len) * THUMB_MAX;
    }
    stick.x = dx / THUMB_MAX;
    stick.y = dy / THUMB_MAX;
    setThumb(dx, dy);
  }
  function endStick() {
    stickId = null;
    stick.x = stick.y = 0;
    setThumb(0, 0);
  }
  base.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      setMode('run'); // двойной тап по джойстику
      lastTap = 0;
    } else {
      lastTap = now;
    }
    stickId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    moveStick(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  const stickUp = (e) => {
    if (e.pointerId === stickId) endStick();
  };
  base.addEventListener('pointerup', stickUp);
  base.addEventListener('pointercancel', stickUp);
  base.addEventListener('lostpointercapture', stickUp);

  // --- поворот камеры ---
  let lookId = null;
  let last = { x: 0, y: 0 };
  let hidden = null; // {base} пока сидим в шкафу
  let saved = null;

  function applyLook(dx, dy) {
    camera.rotation.y -= dx * sensitivity * LOOK_FACTOR;
    camera.rotation.x -= dy * sensitivity * LOOK_FACTOR;
    if (hidden) {
      camera.rotation.y = Math.max(hidden.base - HIDE_YAW, Math.min(hidden.base + HIDE_YAW, camera.rotation.y));
      camera.rotation.x = Math.max(-0.35, Math.min(0.35, camera.rotation.x));
    } else {
      camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x));
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (lookId !== null) return;
    const onRight = e.clientX >= window.innerWidth / 2;
    if (onRight !== (side === 'left')) return; // джойстик слева → крутим правой половиной
    lookId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    applyLook(dx, dy);
  });
  const lookUp = (e) => {
    if (e.pointerId === lookId) lookId = null;
  };
  canvas.addEventListener('pointerup', lookUp);
  canvas.addEventListener('pointercancel', lookUp);
  canvas.addEventListener('lostpointercapture', lookUp);

  // палец мог отпуститься вне элемента — сбрасываем глобально
  const globalUp = (e) => {
    if (e.pointerId === stickId) endStick();
    if (e.pointerId === lookId) lookId = null;
  };
  const resetAll = () => {
    endStick();
    lookId = null;
  };
  window.addEventListener('pointerup', globalUp);
  window.addEventListener('pointercancel', globalUp);
  window.addEventListener('blur', resetAll);
  document.addEventListener('visibilitychange', resetAll);

  // --- движение и коллизии ---
  const blocked = (x, z) =>
    isBlocked(colliders, x, z, PLAYER_RADIUS) || isBlocked(dynamicColliders, x, z, PLAYER_RADIUS);

  function update(dt) {
    if (hidden) {
      camera.position.y = HIDE_EYE;
      return;
    }
    const mag = Math.min(1, Math.hypot(stick.x, stick.y));
    if (mag > 0.05) {
      // вперёд = вверх по экрану; та же формула, что yaw + atan2(y, x), в явном виде
      const yaw = camera.rotation.y;
      const fwd = -stick.y;
      const right = stick.x;
      const dirX = -Math.sin(yaw) * fwd + Math.cos(yaw) * right;
      const dirZ = -Math.cos(yaw) * fwd - Math.sin(yaw) * right;
      const len = Math.hypot(dirX, dirZ) || 1;
      const step = MODES[mode].speed * mag * dt;
      const nx = camera.position.x + (dirX / len) * step;
      const nz = camera.position.z + (dirZ / len) * step;
      // скольжение вдоль стен: оси проверяются отдельно
      if (!blocked(nx, camera.position.z)) camera.position.x = nx;
      if (!blocked(camera.position.x, nz)) camera.position.z = nz;
    }
    eye += (MODES[mode].eye - eye) * Math.min(1, dt * 10);
    camera.position.y = eye;
  }

  // текущее состояние для шума и HUD
  function getState() {
    const moving = Math.hypot(stick.x, stick.y) > 0.05;
    return { mode, noise: moving ? MODES[mode].noise : 0, moving };
  }

  function reset() {
    endStick();
    lookId = null;
  }

  function hide({ x, z, yaw }) {
    saved = { x: camera.position.x, z: camera.position.z, yaw: camera.rotation.y, pitch: camera.rotation.x };
    reset();
    hidden = { base: yaw };
    camera.position.set(x, HIDE_EYE, z);
    camera.rotation.set(0, yaw, 0);
    base.style.display = 'none';
    buttons.style.display = 'none';
  }

  // возврат на позицию перед шкафом
  function show() {
    if (!hidden) return;
    hidden = null;
    camera.position.set(saved.x, MODES[mode].eye, saved.z);
    camera.rotation.set(saved.pitch, saved.yaw, 0);
    eye = MODES[mode].eye;
    base.style.display = '';
    buttons.style.display = '';
  }

  function dispose() {
    window.removeEventListener('pointerup', globalUp);
    window.removeEventListener('pointercancel', globalUp);
    window.removeEventListener('blur', resetAll);
    document.removeEventListener('visibilitychange', resetAll);
    base.remove();
    buttons.remove();
  }

  return { update, reset, applyLayout, getState, look: applyLook, hide, show, isHidden: () => !!hidden, dispose };
}
