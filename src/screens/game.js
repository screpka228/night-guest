import { navigate } from '../router.js';
import { applySettingsVars } from '../data/settings.js';
import { getDifficulty, getAttemptsLeft } from '../data/difficulty.js';
import { createGameState, resetGameState, pauseGame, resumeGame } from '../data/game-state.js';
import { initScene, resizeScene, disposeScene } from '../three/scene.js';
import { initControls } from '../three/controls.js';
import { createLoop } from '../three/render.js';
import { mountPause } from './pause.js';

export function mountGame(root) {
  createGameState();
  applySettingsVars();

  const attempts = getAttemptsLeft();
  root.innerHTML = `
    <div class="screen game">
      <canvas id="game-canvas"></canvas>
      <div class="hud">${getDifficulty().name} · Попытки: ${attempts === Infinity ? '∞' : attempts}</div>
      <button class="pause-btn" data-pause aria-label="Пауза">⏸</button>
    </div>`;
  const screen = root.querySelector('.game');
  const canvas = root.querySelector('canvas');

  let three = null;
  let controls = null;
  let loop = null;
  try {
    three = initScene(canvas);
    controls = initControls(three.camera, canvas, { colliders: three.colliders, container: screen });
    loop = createLoop({
      renderer: three.renderer,
      scene: three.scene,
      camera: three.camera,
      controls,
      container: screen,
      debug: new URLSearchParams(location.search).has('debug')
    });
    loop.start();
  } catch (err) {
    console.error(err);
    screen.insertAdjacentHTML('beforeend', '<div class="hud-error">WebGL недоступен</div>');
  }

  const onResize = () => three && resizeScene(three);
  window.addEventListener('resize', onResize);

  let pause = null;
  const closePause = () => {
    if (!pause) return;
    pause.destroy();
    pause = null;
    resumeGame();
    controls?.applyLayout(); // настройки из паузы применяются сразу
    loop?.start();
  };
  const openPause = () => {
    if (pause) return;
    pauseGame();
    loop?.stop();
    controls?.reset();
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
    window.removeEventListener('resize', onResize);
    pause?.destroy();
    loop?.dispose();
    controls?.dispose();
    if (three) disposeScene(three);
    resetGameState();
  };
}
