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

export function initControls(camera, canvas, { colliders, container, onModeChange }) {
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
  buttons.querySelectorAll('.mode-btn').forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.mode))
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

  // --- поворот камеры ---
  let lookId = null;
  let last = { x: 0, y: 0 };
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
    camera.rotation.y -= dx * sensitivity * LOOK_FACTOR;
    camera.rotation.x -= dy * sensitivity * LOOK_FACTOR;
    camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x));
  });
  const lookUp = (e) => {
    if (e.pointerId === lookId) lookId = null;
  };
  canvas.addEventListener('pointerup', lookUp);
  canvas.addEventListener('pointercancel', lookUp);

  // --- движение и коллизии ---
  function blocked(x, z) {
    for (const c of colliders) {
      if (
        Math.abs(x - c.x) < c.w / 2 + PLAYER_RADIUS &&
        Math.abs(z - c.z) < c.d / 2 + PLAYER_RADIUS
      ) {
        return true;
      }
    }
    return false;
  }

  function update(dt) {
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
    return { mode, noise: MODES[mode].noise, moving: Math.hypot(stick.x, stick.y) > 0.05 };
  }

  function reset() {
    endStick();
    lookId = null;
  }

  function dispose() {
    base.remove();
    buttons.remove();
  }

  return { update, reset, applyLayout, getState, dispose };
}
