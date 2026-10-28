import { navigate } from '../router.js';

export function mountGame(root) {
  root.innerHTML = `
    <div class="screen game">
      <canvas id="game-canvas"></canvas>
      <button class="game-back" data-back>←</button>
    </div>`;
  const canvas = root.querySelector('canvas');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  root.querySelector('[data-back]').addEventListener('click', () => navigate('menu'));
  return () => window.removeEventListener('resize', resize);
}
