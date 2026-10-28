import { navigate } from '../router.js';

export function mountMenu(root) {
  root.innerHTML = `
    <div class="screen menu">
      <h1 class="title">НОЧНОЙ ГОСТЬ</h1>
      <div class="buttons">
        <button data-to="difficulty">Играть</button>
        <button data-to="leaderboard">Лидеры</button>
        <button data-to="settings">Настройки</button>
      </div>
    </div>`;
  root.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.to))
  );
}
