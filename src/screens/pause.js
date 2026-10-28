import { DIFFICULTIES } from '../data/difficulty.js';
import { gameState, getElapsedTime } from '../data/game-state.js';
import { mountSettingsPanel } from './settings-panel.js';
import { mountConfirm } from './confirm.js';

export function mountPause(parent, { onResume, onExit }) {
  const diffName = DIFFICULTIES[gameState?.difficulty]?.name ?? '';
  const el = document.createElement('div');
  el.className = 'overlay overlay-pause';
  el.innerHTML = `
    <div class="pause-menu">
      <div class="pause-info">
        <div>Сложность: ${diffName}</div>
        <div>Время: <span data-time>${getElapsedTime()}</span></div>
      </div>
      <button data-resume>Продолжить</button>
      <button data-settings>Настройки</button>
      <button data-exit>Выйти в меню</button>
    </div>`;
  parent.appendChild(el);

  const timeEl = el.querySelector('[data-time]');
  const timer = setInterval(() => {
    timeEl.textContent = getElapsedTime();
  }, 1000);

  let settings = null;
  let confirm = null;

  el.querySelector('[data-resume]').addEventListener('click', onResume);
  el.querySelector('[data-settings]').addEventListener('click', () => {
    if (settings) return;
    settings = mountSettingsPanel(parent, {
      onBack: () => {
        settings.destroy();
        settings = null;
      },
      onContinue: onResume
    });
  });
  el.querySelector('[data-exit]').addEventListener('click', () => {
    if (confirm) return;
    confirm = mountConfirm(parent, {
      onYes: onExit,
      onNo: () => {
        confirm.destroy();
        confirm = null;
      }
    });
  });

  return {
    destroy() {
      clearInterval(timer);
      settings?.destroy();
      confirm?.destroy();
      el.remove();
    }
  };
}
