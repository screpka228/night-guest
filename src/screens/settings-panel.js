import {
  JOYSTICK_SIZES,
  getSensitivity,
  setSensitivity,
  getJoystickSize,
  setJoystickSize,
  getControlsSide,
  setControlsSide
} from '../data/settings.js';

const SIZE_LABELS = { small: 'Маленький', medium: 'Средний', large: 'Большой' };
const SIDE_LABELS = { left: 'Слева', right: 'Справа' };

// onContinue необязателен: кнопка «Продолжить» показывается только в паузе
export function mountSettingsPanel(parent, { onBack, onContinue }) {
  const sens = getSensitivity();
  const size = getJoystickSize();
  const side = getControlsSide();

  const el = document.createElement('div');
  el.className = 'overlay overlay-settings';
  el.innerHTML = `
    <button class="back-btn" data-back>← Назад</button>
    <div class="panel">
      <h2>Настройки</h2>
      <div class="field">
        <label>Чувствительность камеры: <span data-sens-val>${sens.toFixed(1)}</span></label>
        <input type="range" min="1" max="4" step="0.1" value="${sens}" data-sens />
      </div>
      <div class="field">
        <label>Размер джойстика</label>
        <div class="toggle-group" data-group="size">
          ${Object.entries(JOYSTICK_SIZES)
            .map(([k, px]) => `<button data-px="${px}" class="${px === size ? 'active' : ''}">${SIZE_LABELS[k]}</button>`)
            .join('')}
        </div>
      </div>
      <div class="field">
        <label>Расположение кнопок (джойстик)</label>
        <div class="toggle-group" data-group="side">
          ${Object.entries(SIDE_LABELS)
            .map(([k, t]) => `<button data-side="${k}" class="${k === side ? 'active' : ''}">${t}</button>`)
            .join('')}
        </div>
      </div>
      ${onContinue ? '<button data-continue>Продолжить</button>' : ''}
    </div>`;

  const val = el.querySelector('[data-sens-val]');
  el.querySelector('[data-sens]').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    setSensitivity(v);
    val.textContent = v.toFixed(1);
  });

  const bindGroup = (group, attr, handler) => {
    const btns = el.querySelectorAll(`[data-group="${group}"] button`);
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        btns.forEach((x) => x.classList.toggle('active', x === b));
        handler(b.dataset[attr]);
      })
    );
  };
  bindGroup('size', 'px', (px) => setJoystickSize(parseInt(px, 10)));
  bindGroup('side', 'side', setControlsSide);

  el.querySelector('[data-back]').addEventListener('click', onBack);
  if (onContinue) el.querySelector('[data-continue]').addEventListener('click', onContinue);

  parent.appendChild(el);
  return { destroy: () => el.remove() };
}
