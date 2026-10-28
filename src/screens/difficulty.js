import { navigate } from '../router.js';
import { DIFFICULTIES, resetAttempts } from '../data/difficulty.js';

export function mountDifficulty(root) {
  const buttons = Object.entries(DIFFICULTIES)
    .map(
      ([key, d]) =>
        `<button data-key="${key}"><b>${d.name}</b><small>${d.desc}</small></button>`
    )
    .join('');
  root.innerHTML = `
    <div class="screen difficulty">
      <h2>Сложность</h2>
      <div class="grid">${buttons}</div>
      <button class="back" data-back>Назад</button>
    </div>`;
  root.querySelectorAll('[data-key]').forEach((b) =>
    b.addEventListener('click', () => {
      try {
        localStorage.setItem('ng_difficulty', b.dataset.key);
        resetAttempts(b.dataset.key);
      } catch {}
      navigate('game');
    })
  );
  root.querySelector('[data-back]').addEventListener('click', () => navigate('menu'));
}
