import { navigate } from '../router.js';
import { applySettingsVars, applyBrightness } from '../data/settings.js';
import { getDifficulty, getDifficultyKey, getAttemptsLeft, spendAttempt } from '../data/difficulty.js';
import { createGameState, resetGameState, pauseGame, resumeGame } from '../data/game-state.js';
import { initScene, resizeScene, disposeScene } from '../three/scene.js';
import { initControls } from '../three/controls.js';
import { createLoop } from '../three/render.js';
import { updateNoise, clearNoise, noiseEvents, noiseLevel } from '../game/noise.js';
import { createGhost } from '../game/ghost.js';
import { playScream } from '../game/sfx.js';
import { mountPause } from './pause.js';
import { mountGameOver } from './gameover.js';

const CATCH_DISTANCE = 1.2;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function mountGame(root) {
  createGameState();
  applySettingsVars();

  const attempts = getAttemptsLeft();
  root.innerHTML = `
    <div class="screen game">
      <canvas id="game-canvas"></canvas>
      <div class="hud">${getDifficulty().name} · Попытки: ${attempts === Infinity ? '∞' : attempts}</div>
      <div class="noise-meter" data-level="0"><i></i><i></i><i></i></div>
      <button class="pause-btn" data-pause aria-label="Пауза">⏸</button>
    </div>`;
  const screen = root.querySelector('.game');
  const canvas = root.querySelector('canvas');
  applyBrightness();

  const meter = root.querySelector('.noise-meter');
  clearNoise();
  const debug = new URLSearchParams(location.search).has('debug');
  const devInfo = debug ? document.createElement('div') : null;
  if (devInfo) {
    devInfo.className = 'dev-info';
    screen.appendChild(devInfo);
  }
  let logAcc = 0;
  let dead = false;
  let gameOver = null;

  const caught = () => {
    dead = true;
    loop?.stop();
    controls?.reset();
    playScream();
    navigator.vibrate?.([200, 100, 200]);
    gameOver = mountGameOver(screen, { attemptsLeft: spendAttempt() });
  };

  let three = null;
  let controls = null;
  let ghost = null;
  let loop = null;
  try {
    three = initScene(canvas);
    ghost = createGhost({
      scene: three.scene,
      colliders: three.colliders,
      rooms: three.rooms,
      difficulty: getDifficulty(),
      practice: getDifficultyKey() === 'practice'
    });
    controls = initControls(three.camera, canvas, {
      colliders: three.colliders,
      dynamicColliders: [ghost.collider], // сквозь гостя не пройти
      container: screen
    });
    if (debug) window.__ng = { camera: three.camera, ghost, colliders: three.colliders, noiseEvents };
    loop = createLoop({
      renderer: three.renderer,
      scene: three.scene,
      camera: three.camera,
      controls,
      container: screen,
      debug,
      onFrame: (dt) => {
        const s = controls.getState();
        const p = three.camera.position;
        updateNoise(dt, { x: p.x, z: p.z, moving: s.moving, noise: s.noise });
        ghost.update(dt, noiseEvents);
        // поимка не зависит от состояния гостя: подошёл вплотную — поймал
        if (!dead && Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z) < CATCH_DISTANCE) {
          caught();
          return;
        }
        meter.dataset.level = noiseLevel(s.noise);
        if (devInfo) {
          const dist = Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z);
          devInfo.textContent = `Игрок: ${cap(s.mode)}\nГость: ${cap(ghost.getState())}  dist=${dist.toFixed(1)}`;
          logAcc += dt;
          if (logAcc >= 1) {
            logAcc = 0;
            console.log('noise events:', noiseEvents.length);
          }
        }
      },
      debugText: () => `noise=${noiseEvents.length}`
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
    if (pause || dead) return;
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
    gameOver?.destroy();
    loop?.dispose();
    controls?.dispose();
    if (three) disposeScene(three);
    clearNoise();
    resetGameState();
  };
}
