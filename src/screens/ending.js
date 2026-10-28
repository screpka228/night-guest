import { navigate } from '../router.js';

export function mountEnding(root) {
  root.innerHTML = `
    <div class="screen ending">
      <h2>Финал</h2>
      <button data-back>В меню</button>
    </div>`;
  root.querySelector('[data-back]').addEventListener('click', () => navigate('menu'));
}
