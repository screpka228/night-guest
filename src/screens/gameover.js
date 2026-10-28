import { navigate } from '../router.js';

// Экран после поимки: «Продолжить» (есть попытки) или «Вы проиграли»
export function mountGameOver(parent, { attemptsLeft }) {
  const lost = attemptsLeft <= 0;
  const el = document.createElement('div');
  el.className = 'overlay overlay-dead';
  el.innerHTML = `
    <div class="dead-box">
      <h2>${lost ? 'Вы проиграли' : 'Вас поймали'}</h2>
      ${lost ? '' : `<p>Попыток: ${attemptsLeft === Infinity ? '∞' : attemptsLeft}</p>`}
      <button data-act>${lost ? 'В главное меню' : 'Продолжить'}</button>
    </div>`;
  el.querySelector('[data-act]').addEventListener('click', () => navigate(lost ? 'menu' : 'game'));
  parent.appendChild(el);
  return { destroy: () => el.remove() };
}
