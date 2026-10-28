import { navigate } from '../router.js';
import { applySettingsVars, applyBrightness } from '../data/settings.js';
import { getDifficulty, getDifficultyKey, getAttemptsLeft, spendAttempt } from '../data/difficulty.js';
import { createGameState, resetGameState, pauseGame, resumeGame, getElapsedTime, getElapsedSeconds, gameState } from '../data/game-state.js';
import { getNight, advanceNight } from '../data/night.js';
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
import { playHeartbeat, playLock } from '../game/sfx.js';
import { startDrone, stopAmbient, updateAudio, scream, whisper, suspendAudio, resumeAudio } from '../game/audio.js';
import { isBlocked } from '../three/collision.js';
import { mountPause } from './pause.js';
import { mountEndingD, mountEndingA, mountEndingC, mountCredits } from './gameover.js';
import { spawnContents } from '../game/spawn.js';
import { createSpots } from '../game/spots.js';
import { createHallucinations } from '../game/hallucinations.js';

const CATCH_DISTANCE = 1.2;
const NIGHT_LENGTH = 300; // 5 минут игрового времени (без пауз)
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function mountGame(root) {
  createGameState();
  applySettingsVars();

  const night = getNight();
  const attempts = getAttemptsLeft();
  root.innerHTML = `
    <div class="screen game">
      <canvas id="game-canvas"></canvas>
      <div class="hud">${getDifficulty().name} · Попытки: ${attempts === Infinity ? '∞' : attempts} · Ночь ${night}</div>
      <div class="fx-vignette"></div>
      <div class="fx-grain"></div>
      <div class="fx-stress"></div>
      <div class="goal-hud">Обыщи квартиру</div>
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
  let lastGhost = { x: 0, z: 0 };
  let lookT = 0;
  let whisperT = 0;
  let rippleT = 0;
  const fxStress = root.querySelector('.fx-stress');
  let dead = false;
  let gameOver = null;
  let hiding = null;
  let doors = null;
  let items = null;
  let phone = null;
  let vents = null;
  let spots = null;
  let halluc = null;
  let keysSpot = null;
  const goalHud = root.querySelector('.goal-hud');
  let nearCloset = null;
  const hideBtn = root.querySelector('[data-hide]');
  const quietHud = root.querySelector('.quiet-hud');
  hideBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (nearCloset && !dead) hiding.enter(nearCloset);
  });

  // общая остановка игры перед экраном концовки
  const stopAll = () => {
    stopAmbient();
    dead = true; // пауза, поимка и таймеры отключены
    endCard();
    loop?.stop();
    controls?.reset();
    hiding?.dispose();
    phone?.dispose();
    halluc?.dispose();
    hideBtn.hidden = true;
  };

  const timeouts = [];
  const later = (fn, ms) => timeouts.push(setTimeout(fn, ms));

  // Концовки A (побег) и C (рассвет); после 5-й ночи — титры
  const finishEnding = (kind) => {
    if (dead) return;
    const time = getElapsedTime();
    stopAll();
    const { next, credits } = advanceNight();
    gameOver = credits
      ? mountCredits(screen)
      : (kind === 'A' ? mountEndingA : mountEndingC)(screen, { time, nextNight: next });
  };

  const caught = () => {
    stopAll();
    scream();
    navigator.vibrate?.([200, 100, 200]);
    gameOver = mountEndingD(screen, { attemptsLeft: spendAttempt() });
  };

  // кат-сцена / карточка: затемнение и текст по центру; тап пропускает; управление заблокировано
  let card = null;
  function endCard() {
    if (!card) return;
    card.el.remove();
    card = null;
    controls?.setBlocked(false);
  }
  const showCard = (text, dur, heart) => {
    endCard();
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = text;
    el.addEventListener('pointerdown', endCard);
    screen.appendChild(el);
    card = { el, t: 0, dur };
    controls.setBlocked(true);
    if (heart) playHeartbeat();
  };

  let dawn = null;
  const startDawn = () => {
    dawn = { t: 0 };
    ghost.disable(); // гость исчезает
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
    const spawned = spawnContents(three.spots);
    keysSpot = spawned.keysSpot;
    halluc = createHallucinations({
      scene: three.scene,
      camera: three.camera,
      colliders: three.colliders,
      rooms: three.rooms,
      container: screen,
      canvas,
      difficulty: getDifficulty(),
      night
    });
    ghost.setSpeedMul(1 + 0.1 * (night - 1)); // с каждой ночью гость быстрее на 10%
    spots = createSpots({
      scene: three.scene,
      camera: three.camera,
      spots: three.spots,
      contents: spawned.contents,
      buttons: controls.modeButtons,
      items,
      frontDoor: three.frontDoor,
      notify: items.showToast,
      onKeys: () => {
        // твист: кат-сцена 5 с, гость замирает на 10 с и становится в 1.5 раза быстрее
        showCard('На столе лежит фотография. Это ты. Но не сегодня.', 5, true);
        ghost.freeze(10, 1.5);
      },
      onEscape: () => {
        // белая вспышка, звук замка, затем концовка A
        const flash = document.createElement('div');
        flash.className = 'white-flash';
        screen.appendChild(flash);
        playLock();
        dead = true; // управление и поимка отключены на время вспышки
        controls.reset();
        controls.setBlocked(true);
        later(() => {
          dead = false;
          flash.remove();
          finishEnding('A');
        }, 1200);
      }
    });
    vents = createVents({ vents: three.vents, camera: three.camera, controls, container: screen });
    phone = createPhone({ container: screen, difficulty: getDifficulty() });
    hiding = createHiding({ container: screen, camera: three.camera, controls, onCaught: caught });
    if (debug) window.__ng = { camera: three.camera, ghost, colliders: three.colliders, noiseEvents, hiding, doors, items, phone, vents, spots, halluc, spawned, difficulty: getDifficulty(), gs: () => gameState };
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
        if (card) {
          card.t += dt;
          if (card.t >= card.dur) endCard();
        }
        // таймер ночи: ключей нет за 5 минут — гость исчезает, рассвет, концовка C
        if (!dead && !dawn && !spots.state.keysFound && getElapsedSeconds() >= NIGHT_LENGTH) startDawn();
        if (dawn && !dead) {
          dawn.t += dt;
          const k = Math.min(1, dawn.t / 3);
          three.ambient.color.setRGB(0.13 + 0.87 * k, 0.13 + 0.56 * k, 0.2 + 0.24 * k);
          three.ambient.intensity = 0.6 + 1.2 * k;
          if (dawn.t >= 4) {
            finishEnding('C');
            return;
          }
        }
        updateNoise(dt, { x: p.x, z: p.z, moving: s.moving, noise: s.noise });
        hiding.update(dt, ghost);
        if (!hiding.active) vents.update(dt);
        doors.update(dt, { x: p.x, z: p.z });
        items.update(dt, { x: p.x, z: p.z });
        spots.update({ x: p.x, z: p.z });
        halluc.update(dt, { player: { x: p.x, z: p.z }, ghost, hidingActive: hiding.active, phoneRinging: phone.ringing });
        goalHud.textContent = spots.state.keysFound ? 'Беги к выходу!' : 'Обыщи квартиру';
        phone.update(dt, { x: p.x, z: p.z });
        ghost.update(dt, noiseEvents, hiding.active ? null : { x: p.x, z: p.z });
        // поимка не зависит от состояния гостя: подошёл вплотную — поймал
        if (!dead && !ghost.disabled && !hiding.active && Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z) < CATCH_DISTANCE) {
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

        // --- звук и пост-эффекты ---
        const gdx = ghost.pos.x - p.x;
        const gdz = ghost.pos.z - p.z;
        const gdist = Math.hypot(gdx, gdz);
        const ghostSpeed = Math.hypot(ghost.pos.x - lastGhost.x, ghost.pos.z - lastGhost.z) / Math.max(dt, 0.001);
        lastGhost = { x: ghost.pos.x, z: ghost.pos.z };
        const yaw = three.camera.rotation.y;
        const heartK = Math.max(halluc.stress / 100, ghost.disabled ? 0 : Math.max(0, 1 - gdist / 8));
        updateAudio(dt, {
          heartK,
          moving: s.moving && !hiding.active,
          mode: s.mode,
          ghostMoving: !ghost.disabled && ghostSpeed > 0.2,
          ghostSpeed,
          ghostDist: gdist,
          ghostPan: gdist > 0.01 ? Math.max(-1, Math.min(1, (gdx * Math.cos(yaw) - gdz * Math.sin(yaw)) / gdist)) : 0
        });
        fxStress.classList.toggle('on', halluc.stress > 60);

        // долго смотришь на гостя — шёпот и рябь
        let seen = false;
        if (!ghost.disabled && gdist < 12 && gdist > 0.01) {
          const fx = -Math.sin(yaw);
          const fz = -Math.cos(yaw);
          const dot = (fx * gdx + fz * gdz) / gdist;
          seen = dot > 0.9 && !isBlocked(three.colliders, (p.x + ghost.pos.x) / 2, (p.z + ghost.pos.z) / 2, 0.05);
        }
        lookT = seen ? lookT + dt : Math.max(0, lookT - dt * 2);
        if (lookT > 3) {
          whisperT -= dt;
          if (whisperT <= 0) {
            whisperT = 2.5;
            whisper();
          }
          rippleT -= dt;
          if (rippleT <= 0) {
            rippleT = 6;
            halluc.triggerDistort();
          }
        }
        if (devInfo) {
          const dist = Math.hypot(ghost.pos.x - p.x, ghost.pos.z - p.z);
          const last = noiseEvents[noiseEvents.length - 1];
          devInfo.textContent =
            `Игрок: ${cap(s.mode)}\n${hiding.active ? 'В шкафу, ' : ''}Гость: ${cap(ghost.getState())}${ghost.isListening() ? ' (слушает)' : ''}  dist=${dist.toFixed(1)}` +
            `\nСтресс: ${Math.round(halluc.stress)}/100` +
            `\nГаллюцинации: ${halluc.active ? 'Вкл' : 'Выкл'}` +
            `\nКлючи: точка #${keysSpot.id} (${keysSpot.room})` +
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
    startDrone();
    if (night > 1) {
      showCard(`Ночь ${night}. Ты снова здесь. Ты не помнишь, как уснул.`, 3, false);
      ghost.freeze(3, 1);
    }
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
    resumeAudio();
    controls?.applyLayout(); // настройки из паузы применяются сразу
    loop?.start();
  };
  const openPause = () => {
    if (pause || dead) return;
    pauseGame();
    suspendAudio();
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
    stopAmbient();
    resumeAudio();
    gameOver?.destroy();
    timeouts.forEach(clearTimeout);
    card?.el.remove();
    hiding?.dispose();
    items?.dispose();
    spots?.dispose();
    halluc?.dispose();
    vents?.dispose();
    phone?.dispose();
    loop?.dispose();
    controls?.dispose();
    if (three) disposeScene(three);
    clearNoise();
    resetGameState();
  };
}
