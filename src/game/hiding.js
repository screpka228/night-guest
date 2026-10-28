import { emitNoise } from './noise.js';
import { startBreathSound } from './sfx.js';

const BASE_ZONE = 0.3;
const NEAR_ZONE = 0.15;
const NEAR_DIST = 3;
const DRIFT = 0.35; // доля ширины полоски в секунду
const TAP_PUSH = 0.15;
const SUFFOCATE_AFTER = 40;
const SUFFOCATE_STEP = 5;
const SUFFOCATE_SHRINK = 0.03;
const CAUGHT_DIST = 2.0;
const EMIT_INTERVAL = 0.5;

// Укрытие в шкафу: щель обзора, полоска дыхания, шум и поимка
export function createHiding({ container, camera, controls, onCaught }) {
  let ui = null;
  let stopBreath = null;
  const s = {
    active: false,
    closet: null,
    t: 0,
    marker: 0.5,
    vel: 0,
    target: 0,
    velTimer: 0,
    emitTimer: EMIT_INTERVAL
  };

  function buildUi() {
    const el = document.createElement('div');
    el.className = 'hide-ui';
    el.innerHTML = `
      <div class="hide-bar hide-bar-top"></div>
      <div class="hide-bar hide-bar-bottom"></div>
      <div class="hide-tap"></div>
      <div class="breath"><div class="breath-zone"></div><div class="breath-marker"></div></div>
      <button class="hide-exit">Выйти</button>`;
    container.appendChild(el);
    const tap = el.querySelector('.hide-tap');
    let pid = null;
    let last = null;
    tap.addEventListener('pointerdown', (e) => {
      if (pid === null) {
        pid = e.pointerId;
        last = { x: e.clientX, y: e.clientY };
        tap.setPointerCapture(pid);
      }
      // тап толкает маркер к центру
      const d = 0.5 - s.marker;
      s.marker += Math.sign(d) * Math.min(TAP_PUSH, Math.abs(d));
    });
    tap.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      controls.look(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
    });
    const up = (e) => {
      if (e.pointerId === pid) pid = null;
    };
    tap.addEventListener('pointerup', up);
    tap.addEventListener('pointercancel', up);
    el.querySelector('.hide-exit').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      exit(false);
    });
    return {
      el,
      breath: el.querySelector('.breath'),
      zone: el.querySelector('.breath-zone'),
      marker: el.querySelector('.breath-marker')
    };
  }

  function enter(closet) {
    if (s.active) return;
    s.active = true;
    s.closet = closet;
    s.t = 0;
    s.marker = 0.5;
    s.vel = s.target = s.velTimer = 0;
    s.emitTimer = EMIT_INTERVAL;
    const nx = Math.sin(closet.rotationY);
    const nz = Math.cos(closet.rotationY);
    controls.hide({
      x: closet.x + nx * 0.15,
      z: closet.z + nz * 0.15,
      yaw: closet.rotationY + Math.PI // смотрим наружу
    });
    ui = buildUi();
  }

  function exit(forced) {
    if (!s.active) return;
    s.active = false;
    if (forced) emitNoise(s.closet.x, s.closet.z, 3); // вынужденный выход громкий
    stopBreath?.();
    stopBreath = null;
    ui?.el.remove();
    ui = null;
    controls.show();
  }

  function update(dt, ghost) {
    if (!s.active) return;
    s.t += dt;
    const gd = Math.hypot(ghost.pos.x - s.closet.x, ghost.pos.z - s.closet.z);
    const near = gd < NEAR_DIST;
    if (near && !stopBreath) stopBreath = startBreathSound();
    if (!near && stopBreath) {
      stopBreath();
      stopBreath = null;
    }

    const shrink = s.t > SUFFOCATE_AFTER ? SUFFOCATE_SHRINK * Math.floor((s.t - SUFFOCATE_AFTER) / SUFFOCATE_STEP) : 0;
    const width = Math.max(0, (near ? NEAR_ZONE : BASE_ZONE) - shrink);
    if (width <= 0) {
      exit(true);
      return;
    }

    // случайный дрейф маркера
    const speed = DRIFT * (near ? 1.5 : 1);
    s.velTimer -= dt;
    if (s.velTimer <= 0) {
      s.velTimer = 0.4 + Math.random() * 0.8;
      s.target = (Math.random() * 2 - 1) * speed;
    }
    s.vel += (s.target - s.vel) * Math.min(1, dt * 4);
    s.marker = Math.min(1, Math.max(0, s.marker + s.vel * dt));

    const green = Math.abs(s.marker - 0.5) <= width / 2;
    if (green) {
      s.emitTimer = EMIT_INTERVAL; // следующий выход в красное сразу даст метку
    } else {
      s.emitTimer += dt;
      if (s.emitTimer >= EMIT_INTERVAL) {
        s.emitTimer = 0;
        if (ghost.getState() === 'search' && gd < CAUGHT_DIST) {
          onCaught(); // гость стоит рядом, а игрок снова выдал себя
          return;
        }
        emitNoise(s.closet.x, s.closet.z, 2, { closet: true });
      }
    }

    if (ui) {
      ui.zone.style.left = (0.5 - width / 2) * 100 + '%';
      ui.zone.style.width = width * 100 + '%';
      ui.marker.style.left = s.marker * 100 + '%';
      ui.breath.classList.toggle('red', !green);
    }
  }

  function dispose() {
    stopBreath?.();
    stopBreath = null;
    ui?.el.remove();
    ui = null;
    s.active = false;
  }

  return {
    enter,
    exit,
    update,
    dispose,
    get active() {
      return s.active;
    },
    debugSetTime: (t) => {
      s.t = t;
    }
  };
}
