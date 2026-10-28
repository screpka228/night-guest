import * as THREE from 'three';
import { isBlocked } from '../three/collision.js';

// Сетка поиска пути: центры клеток кратны 0.2 м, поэтому лежат ровно на линиях дверей (x = ±3, z = ±1 и т.д.)
const CELL = 0.2;
const X0 = -7.5;
const Z0 = -3.5;
const NX = 75;
const NZ = 45;
const GHOST_R = 0.28;
const SEARCH_TIME = 10;
// Порог слышимости: шаг (1) слышен везде, кроме практики; присед (0.3) не слышен
const HEAR_STEP = 0.9;
const HEAR_PRACTICE = 1.5;
const RUN_NOISE = 3; // только бег переводит в погоню напрямую
const REACTION_TIME = 1.0; // гость прислушивается, прежде чем идти на звук
const SOUND_SPREAD = 1.5; // погрешность точки, куда он идёт на шаг (±м)
const CLOSE_CHASE = 1.5; // investigate: игрок ближе — погоня

const SPEED = { patrol: 1.0, investigate: 1.2, chase: 2.0, search: 1.0 };

class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function createGhost({ scene, colliders, rooms, difficulty, practice = false }) {
  // --- сетка проходимости: внутри комнат и не в стенах/мебели ---
  const free = new Uint8Array(NX * NZ);
  const cellX = (i) => X0 + (i + 0.5) * CELL;
  const cellZ = (j) => Z0 + (j + 0.5) * CELL;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = cellX(i);
      const z = cellZ(j);
      // границы включительно: клетки проёмов лежат на общей границе комнат
      const inRoom = rooms.some((r) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
      free[j * NX + i] = inRoom && !isBlocked(colliders, x, z, GHOST_R) ? 1 : 0;
    }
  }
  const isFree = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && free[j * NX + i] === 1;
  const toCell = (x, z) => [
    Math.min(NX - 1, Math.max(0, Math.floor((x - X0) / CELL))),
    Math.min(NZ - 1, Math.max(0, Math.floor((z - Z0) / CELL)))
  ];
  function nearestFree(i, j) {
    if (isFree(i, j)) return [i, j];
    for (let r = 1; r < 15; r++) {
      let best = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !isFree(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function findPath(sx, sz, tx, tz) {
    const s = nearestFree(...toCell(sx, sz));
    const t = nearestFree(...toCell(tx, tz));
    if (!s || !t) return [];
    const start = s[1] * NX + s[0];
    const goal = t[1] * NX + t[0];
    const g = new Float32Array(NX * NZ).fill(Infinity);
    const from = new Int32Array(NX * NZ).fill(-1);
    const closed = new Uint8Array(NX * NZ);
    const h = (i, j) => {
      const dx = Math.abs(i - t[0]);
      const dy = Math.abs(j - t[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const open = new MinHeap();
    g[start] = 0;
    open.push({ idx: start, f: h(s[0], s[1]) });
    while (open.size) {
      const { idx } = open.pop();
      if (closed[idx]) continue;
      closed[idx] = 1;
      if (idx === goal) break;
      const ci = idx % NX;
      const cj = (idx / NX) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (!isFree(ni, nj)) continue;
          if (di && dj && (!isFree(ci + di, cj) || !isFree(ci, cj + dj))) continue; // не режем углы
          const n = nj * NX + ni;
          const cost = g[idx] + (di && dj ? 1.414 : 1);
          if (cost < g[n]) {
            g[n] = cost;
            from[n] = idx;
            open.push({ idx: n, f: cost + h(ni, nj) });
          }
        }
      }
    }
    if (from[goal] === -1 && goal !== start) return [];
    const path = [];
    for (let n = goal; n !== start; n = from[n]) {
      path.push({ x: cellX(n % NX), z: cellZ((n / NX) | 0) });
    }
    return path.reverse();
  }

  function randomFreePoint() {
    for (let k = 0; k < 100; k++) {
      const i = (Math.random() * NX) | 0;
      const j = (Math.random() * NZ) | 0;
      if (isFree(i, j)) return { x: cellX(i), z: cellZ(j) };
    }
    return { x: 0, z: 0 };
  }

  // --- модель: чёрный силуэт и тёмный круг под ним ---
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  body.position.y = 1.0;
  group.add(body);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);
  scene.add(group);

  // --- состояние ---
  const pos = { x: -1.0, z: 2.0 }; // гостиная
  group.position.set(pos.x, 0, pos.z);
  // динамический коллайдер для игрока (в общий список не добавляем: гость бы блокировал сам себя)
  const collider = { x: pos.x, z: pos.z, w: 0.6, d: 0.6 };
  let state = 'patrol';
  let path = [];
  let idx = 0;
  let wait = 0;
  let stuck = 0;
  let searchTimer = 0;
  let searchCenter = null;
  let lastHeard = null;
  let goal = null;
  let listenTimer = 0;
  let pendingTarget = null;
  let goalTimer = 0;
  let searchRoom = null;

  function goTo(x, z) {
    goal = { x, z };
    goalTimer = 0;
    path = findPath(pos.x, pos.z, x, z);
    idx = 0;
    stuck = 0;
  }

  const roomAt = (p) =>
    rooms.find((r) => p.x >= r.x1 && p.x <= r.x2 && p.z >= r.z1 && p.z <= r.z2) || null;
  function setState(next, target) {
    state = next;
    if (target) goTo(target.x, target.z);
  }

  function hear(events) {
    let best = null;
    let bestDist = 0;
    for (const e of events) {
      if (e.intensity <= (practice ? HEAR_PRACTICE : HEAR_STEP)) continue;
      const d = Math.hypot(e.x - pos.x, e.z - pos.z);
      if (d > difficulty.hearingRadius) continue;
      if (!best || e.ttl > best.ttl) {
        best = e;
        bestDist = d;
      }
    }
    if (!best || best === lastHeard) return;
    lastHeard = best;
    searchCenter = { x: best.x, z: best.z };
    searchRoom = roomAt(searchCenter);
    const next = best.intensity >= RUN_NOISE ? 'chase' : 'investigate';
    const idle = state === 'patrol' || state === 'search';
    if (!idle && !(state === 'chase' && next === 'investigate')) state = next;
    if (idle) state = next;
    // погоня идёт точно за звуком, проверка шага — в точку с погрешностью
    const target =
      state === 'chase'
        ? { x: best.x, z: best.z }
        : {
            x: best.x + (Math.random() * 2 - 1) * SOUND_SPREAD,
            z: best.z + (Math.random() * 2 - 1) * SOUND_SPREAD
          };
    if (idle) {
      // остановился и прислушивается
      listenTimer = REACTION_TIME;
      pendingTarget = target;
      path = [];
      idx = 0;
    } else if (listenTimer > 0) {
      pendingTarget = target;
    } else {
      goTo(target.x, target.z);
    }
  }

  function move(dt, speed) {
    const wp = path[idx];
    const dx = wp.x - pos.x;
    const dz = wp.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      idx++;
      return;
    }
    const step = Math.min(speed * dt, dist);
    const bx = pos.x;
    const bz = pos.z;
    const nx = pos.x + (dx / dist) * step;
    const nz = pos.z + (dz / dist) * step;
    let moved = false;
    if (!isBlocked(colliders, nx, pos.z, GHOST_R)) {
      pos.x = nx;
      moved = true;
    }
    if (!isBlocked(colliders, pos.x, nz, GHOST_R)) {
      pos.z = nz;
      moved = true;
    }
    const progress = Math.hypot(pos.x - bx, pos.z - bz);
    stuck = moved && progress >= step * 0.3 ? 0 : stuck + dt;
  }

  // Обход комнаты, где была метка: случайные точки по всей комнате
  function wander() {
    if (searchRoom) {
      const m = 0.5;
      goTo(
        searchRoom.x1 + m + Math.random() * (searchRoom.x2 - searchRoom.x1 - 2 * m),
        searchRoom.z1 + m + Math.random() * (searchRoom.z2 - searchRoom.z1 - 2 * m)
      );
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 2;
      goTo(searchCenter.x + Math.cos(a) * r, searchCenter.z + Math.sin(a) * r);
    }
  }

  function newPatrolPoint() {
    const p = randomFreePoint();
    goTo(p.x, p.z);
  }

  // Выталкивание: встали на месте — привязываемся к ближайшей свободной клетке и перестраиваем путь
  function unstick() {
    const c = nearestFree(...toCell(pos.x, pos.z));
    if (c) {
      pos.x = cellX(c[0]);
      pos.z = cellZ(c[1]);
    }
    if (state === 'patrol' || !goal) newPatrolPoint();
    else goTo(goal.x, goal.z);
  }

  function update(dt, events, player) {
    hear(events);
    if (listenTimer > 0) {
      listenTimer -= dt;
      if (listenTimer <= 0) goTo(pendingTarget.x, pendingTarget.z);
      return;
    }
    if (state === 'investigate' && player && Math.hypot(player.x - pos.x, player.z - pos.z) < CLOSE_CHASE) {
      state = 'chase';
      goTo(player.x, player.z);
    }
    if (state === 'search') {
      searchTimer -= dt;
      if (searchTimer <= 0) {
        setState('patrol');
        wait = 0;
        path = [];
      }
    }

    if (idx < path.length) {
      move(dt, SPEED[state] * difficulty.ghostSpeed);
      goalTimer += dt;
      if (stuck > 0.5) {
        unstick();
      } else if (state === 'patrol' && goalTimer > 5) {
        newPatrolPoint(); // не дошёл за 5 секунд — другая точка
      }
    } else {
      // дошли до цели
      if (state === 'investigate' || state === 'chase') {
        state = 'search';
        searchTimer = SEARCH_TIME;
        wait = 0;
        wander();
      } else if (state === 'search') {
        wait -= dt;
        if (wait <= 0) {
          wait = 0.3 + Math.random() * 0.5;
          wander();
        }
      } else {
        wait -= dt;
        if (wait <= 0) {
          wait = 0.5 + Math.random();
          newPatrolPoint();
        }
      }
    }
    group.position.set(pos.x, 0, pos.z);
    collider.x = pos.x;
    collider.z = pos.z;
  }

  return { update, pos, collider, getState: () => state, isListening: () => listenTimer > 0 };
}
