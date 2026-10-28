import { navigate } from '../router.js';
import { applySettingsVars, applyBrightness } from '../data/settings.js';
import { getDifficulty, getDifficultyKey, getAttemptsLeft, spendAttempt } from '../data/difficulty.js';
import { createGameState, resetGameState, pauseGame, resumeGame } from '../data/game-state.js';
import { initScene, resizeScene, disposeScene } from '../three/scene.js';
import { initControls } from '../three/controls.js';
import { createLoop } from '../three/render.js';
import { createHiding } from '../game/hiding.js';
import { createDoors } from '../game/doors.js';
import { createItems } from '../game/items.js';
import { createPhone } from '../game/phone.js';
import { createVents } from '../game/vents.js';
import { updateNoise, clearNoise, noiseEvents, noiseLevel, quietLeft } from '../game/noise.js';
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
      <div class="quiet-hud" hidden>Тихо...</div>
      <button class="hide-btn" data-hide hidden>Спрятаться</button>
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
  let hiding = null;
  let doors = null;
  let items = null;
  let phone = null;
  let vents = null;
  let nearCloset = null;
  const hideBtn = root.querySelector('[data-hide]');
  const quietHud = root.querySelector('.quiet-hud');
  hideBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (nearCloset && !dead) hiding.enter(nearCloset);
  });

  const caught = () => {
    dead = true;
    loop?.stop();
    controls?.reset();
    hiding?.dispose();
    phone?.dispose();
    hideBtn.hidden = true;
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
    const practice = getDifficultyKey() === 'practice';
    ghost = createGhost({
      scene: three.scene,
      colliders: three.colliders,
      rooms: three.rooms,
      difficulty: getDifficulty(),
      practice,
      // практика: дальний угол гостиной и минута неподвижности
      start: practice ? { x: 1.2, z: 6.8 } : { x: -2, z: 3.2 },
      idleSeconds: practice ? 60 : 0
    });
    controls = initControls(three.camera, canvas, {
      colliders: three.colliders,
      dynamicColliders: [ghost.collider], // сквозь гостя не пройти
      container: screen
    });
    doors = createDoors({ scene: three.scene, doorways: three.doorways, enabled: !practice });
    items = createItems({
      scene: three.scene,
      camera: three.camera,
      colliders: three.colliders,
      buttons: controls.modeButtons,
      screen,
      doors,
      frontDoor: three.frontDoor
    });
    vents = createVents({ vents: three.vents, camera: three.camera, controls, container: screen });
    phone = createPhone({ container: screen, difficulty: getDifficulty() });
    hiding = createHiding({ container: screen, camera: three.camera, controls, onCaught: caught });
    if (debug) window.__ng = { camera: three.camera, ghost, colliders: three.colliders, noiseEvents, hiding, doors, items, phone, vents, difficulty: getDifficulty() };
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
        hiding.update(dt, ghost);
        if (!hiding.active) vents.update(dt);
        doors.update(dt, { x: p.x, z: p.z });
        items.update(dt, { x: p.x, z: p.z });
        phone.update(dt, { x: p.x, z: p.z });
        ghost.update(dt, noiseEvents, hiding.active ? null : { x: p.x, z: p.z });
        // поимка не зависит от состояния гостя: подошёл вплотную — поймал
        if (!dead && !hiding.active && Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z) < CATCH_DISTANCE) {
          caught();
          return;
        }
        // подсказка «Спрятаться»: шкаф в радиусе 1.5 м (от ближайшего края)
        nearCloset = null;
        if (!hiding.active && !dead) {
          for (const c of three.closets) {
            const dx = Math.max(Math.abs(p.x - c.x) - c.w / 2, 0);
            const dz = Math.max(Math.abs(p.z - c.z) - c.d / 2, 0);
            if (Math.hypot(dx, dz) <= 1.5) nearCloset = c;
          }
        }
        hideBtn.hidden = !nearCloset;
        if (nearCloset) hideBtn.textContent = nearCloset.type === 'bed' ? 'Под кровать' : 'Спрятаться';
        quietHud.hidden = quietLeft() <= 0;
        meter.dataset.level = noiseLevel(s.noise);
        if (devInfo) {
          const dist = Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z);
          const last = noiseEvents[noiseEvents.length - 1];
          devInfo.textContent =
            `Игрок: ${cap(s.mode)}\n${hiding.active ? 'В шкафу, ' : ''}Гость: ${cap(ghost.getState())}${ghost.isListening() ? ' (слушает)' : ''}  dist=${dist.toFixed(1)}` +
            `\nВ руках: ${items.state.heldItem ? items.state.heldItem.type : 'пусто'}` +
            `\nМетки шума: ${noiseEvents.length}` +
            `\nПоследняя метка: ${last ? `${last.x.toFixed(1)}, ${last.z.toFixed(1)}, ${last.intensity}` : '—'}`;
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
    hiding?.dispose();
    items?.dispose();
    vents?.dispose();
    phone?.dispose();
    loop?.dispose();
    controls?.dispose();
    if (three) disposeScene(three);
    clearNoise();
    resetGameState();
  };
}
