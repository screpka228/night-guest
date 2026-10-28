import { navigate } from '../router.js';
import { mountConfirm } from './confirm.js';

export function mountMenu(root) {
  root.innerHTML = `
    <div class="screen menu">
      <h1 class="title">НОЧНОЙ ГОСТЬ</h1>
      <div class="buttons">
        <button data-to="difficulty">Играть</button>
        <button data-to="leaderboard">Лидеры</button>
        <button data-to="settings">Настройки</button>
      </div>
      <button class="reset-btn" data-reset>Новая игра (Сброс прогресса)</button>
      <div class="menu-msg" hidden></div>
    </div>`;
  root.querySelectorAll('[data-to]').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.to))
  );

  const msg = root.querySelector('.menu-msg');
  let modal = null;
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (modal) return;
    modal = mountConfirm(root, {
      onYes: () => {
        // сброс: ночь, попытки, рекорды и настройки
        try {
          localStorage.clear();
          localStorage.setItem('ng_night', '1');
        } catch {}
        modal.destroy();
        modal = null;
        msg.textContent = 'Прогресс сброшен. Ночь 1.';
        msg.hidden = false;
      },
      onNo: () => {
        modal.destroy();
        modal = null;
      }
    });
  });
  return () => modal?.destroy();
}
