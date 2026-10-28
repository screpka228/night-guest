const KEYS = {
  sensitivity: 'ng_sensitivity',
  joystickSize: 'ng_joystick_size',
  controlsSide: 'ng_controls_side'
};

export const JOYSTICK_SIZES = { small: 100, medium: 120, large: 140 };

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

export function getSensitivity() {
  const v = parseFloat(read(KEYS.sensitivity));
  return Number.isFinite(v) ? Math.min(4, Math.max(1, v)) : 2;
}

export function setSensitivity(v) {
  write(KEYS.sensitivity, v);
}

export function getJoystickSize() {
  const v = parseInt(read(KEYS.joystickSize), 10);
  return Object.values(JOYSTICK_SIZES).includes(v) ? v : JOYSTICK_SIZES.medium;
}

export function setJoystickSize(px) {
  write(KEYS.joystickSize, px);
  applySettingsVars();
}

export function getControlsSide() {
  return read(KEYS.controlsSide) === 'right' ? 'right' : 'left';
}

export function setControlsSide(side) {
  write(KEYS.controlsSide, side);
  applySettingsVars();
}

// CSS-переменные для HUD (используются на шаге 5)
export function applySettingsVars() {
  const app = document.getElementById('app');
  if (!app) return;
  app.style.setProperty('--joystick-size', getJoystickSize() + 'px');
  app.style.setProperty('--controls-side', getControlsSide());
}
