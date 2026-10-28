import { navigate } from '../router.js';
import { applySettingsVars } from '../data/settings.js';
import { createGameState, resetGameState, pauseGame, resumeGame } from '../data/game-state.js';
import { mountPause } from './pause.js';

export function mountGame(root) {
  createGameState();
  applySettingsVars();

  root.innerHTML = `
    <div class="screen game">
      <canvas id="game-canvas"></canvas>
      <button class="pause-btn" data-pause aria-label="Пауза">⏸</button>
    </div>`;
  const screen = root.querySelector('.game');
  const canvas = root.querySelector('canvas');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  let pause = null;
  const closePause = () => {
    if (!pause) return;
    pause.destroy();
    pause = null;
    resumeGame();
  };
  const openPause = () => {
    if (pause) return;
    pauseGame();
    pause = mountPause(screen, {
      onResume: closePause,
      onExit: () => {
        resetGameState();
        navigate('#menu');
      }
    });
  };
  root.querySelector('[data-pause]').addEventListener('click', openPause);

  return () => {
    window.removeEventListener('resize', resize);
    pause?.destroy();
    resetGameState();
  };
}
