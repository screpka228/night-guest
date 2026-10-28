import { navigate } from '../router.js';

export function mountLeaderboard(root) {
  root.innerHTML = `
    <div class="screen leaderboard">
      <h2>Лидеры</h2>
      <p>Загрузка...</p>
      <button data-back>Назад</button>
    </div>`;
  root.querySelector('[data-back]').addEventListener('click', () => navigate('menu'));
}
