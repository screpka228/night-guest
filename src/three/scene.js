import * as THREE from 'three';
import { woodFloor, concreteWall, wallpaper } from './textures.js';

const WALL_T = 0.15;
const WALL_H = 2.7;
const DOOR_W = 1.0;
const DOOR_H = 2.1;
const VENT_Y1 = 0.2;
const VENT_Y2 = 1.0;

// Комнаты: прямоугольники в метрах (x → восток, z → юг)
const ROOM_DEFS = [
  { name: 'bedroom',  x1: -11,   z1: -2.5,  x2: -5, z2: 2.5,  floor: 0x4a3626 },
  { name: 'corridor', x1: -5,    z1: -1.25, x2: 5,  z2: 1.25, floor: 0x4d5254 },
  { name: 'kitchen',  x1: 5,     z1: -0.5,  x2: 11, z2: 3.5,  floor: 0x5a4330 },
  { name: 'bathroom', x1: -1.5,  z1: -4.25, x2: 1.5, z2: -1.25, floor: 0x6c7377 },
  { name: 'living',   x1: -5,    z1: 1.25,  x2: 2,  z2: 7.25, floor: 0x3f2d20 },
  { name: 'storage',  x1: 2,     z1: 1.25,  x2: 5,  z2: 4.25, floor: 0x3a3a38 }
];

// Стены: horizontal = вдоль x (z фиксирован), иначе вдоль z (x фиксирован); последний элемент — центры проёмов.
// Центры подобраны на сетку 0.2 м, чтобы проёмы были проходимы для гостя.
const WALLS = [
  [true, -2.5, -11, -5], [true, 2.5, -11, -5],
  [true, -1.25, -5, 5, [0]],
  [true, 1.25, -5, 5, [-1.4, 3.4]],
  [true, -4.25, -1.5, 1.5, [], [0]], // вентиляция из ванной (проём 1.0×0.8 на высоте 0.2)
  [true, 7.25, -5, 2],
  [true, 4.25, 2, 5, [], [3.5]], // вентиляция в кладовке
  [true, -0.5, 5, 11], [true, 3.5, 5, 11],
  [false, -11, -2.5, 2.5],
  [false, -5, -2.5, 7.25, [0, 1.8]],
  [false, 2, 1.25, 7.25, [2.8]],
  [false, 5, -1.25, 4.25, [0.2, 2.4]],
  [false, 11, -0.5, 3.5],
  [false, -1.5, -4.25, -1.25], [false, 1.5, -4.25, -1.25]
];

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // тени только от фонарика (shadow.mapSize = 512 для экономии)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.rotation.order = 'YXZ';
  camera.position.set(-7.4, 1.6, 0);
  camera.rotation.y = Math.PI / 2; // смотрим на запад: кровать, шкаф, окно
  scene.add(camera);

  const colliders = [];
  const matCache = new Map();
  const mat = (color) => {
    if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return matCache.get(color);
  };
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

  // --- освещение ---
  const ambient = new THREE.AmbientLight(0x222233, 0.6);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x2f4f99, 0.4); // холодный синий лунный свет
  moon.position.set(-10, 8, -10); // из окна спальни, с северо-запада
  scene.add(moon);

  const flashlight = new THREE.SpotLight(0xffffff, 2.5, 10, Math.PI / 4, 0.3, 1);
  flashlight.position.set(0, 0, 0);
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(512, 512);
  flashlight.shadow.camera.near = 0.2;
  flashlight.shadow.camera.far = 10;
  flashlight.shadow.bias = -0.0008;
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);

  // --- полы и потолки (процедурные текстуры) ---
  const floorTex = woodFloor();
  const wallTex = concreteWall();
  const ceilMat = new THREE.MeshLambertMaterial({ map: wallpaper(), color: 0x444444 });
  const rooms = ROOM_DEFS.map((r) => ({ ...r }));
  for (const r of rooms) {
    const w = r.x2 - r.x1;
    const d = r.z2 - r.z1;
    const cx = (r.x1 + r.x2) / 2;
    const cz = (r.z1 + r.z2) / 2;
    // доски на полу, оттенок комнаты — множитель к текстуре
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: floorTex, color: new THREE.Color(r.floor).multiplyScalar(2.2) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, WALL_H, cz);
    scene.add(ceiling);
  }

  // --- стены с проёмами ---
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, color: 0xb8b0a8 });
  function wallPiece(horizontal, fixed, t1, t2, y1, y2, collide) {
    const len = t2 - t1;
    const c = (t1 + t2) / 2;
    const w = horizontal ? len : WALL_T;
    const d = horizontal ? WALL_T : len;
    const x = horizontal ? c : fixed;
    const z = horizontal ? fixed : c;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, y2 - y1, d), wallMat);
    mesh.position.set(x, (y1 + y2) / 2, z);
    scene.add(mesh);
    if (collide) colliders.push({ x, z, w, d });
  }
  for (const [horizontal, fixed, a0, b0, doors = [], ventGaps = []] of WALLS) {
    const a = a0 - WALL_T / 2; // закрываем углы
    const b = b0 + WALL_T / 2;
    const gaps = [...doors.map((c) => ({ c, vent: false })), ...ventGaps.map((c) => ({ c, vent: true }))].sort(
      (p, q) => p.c - q.c
    );
    let cursor = a;
    for (const { c, vent } of gaps) {
      wallPiece(horizontal, fixed, cursor, c - DOOR_W / 2, 0, WALL_H, true);
      if (vent) {
        // над и под проёмом — стена без коллайдера (низкий лаз)
        wallPiece(horizontal, fixed, c - DOOR_W / 2, c + DOOR_W / 2, 0, VENT_Y1, false);
        wallPiece(horizontal, fixed, c - DOOR_W / 2, c + DOOR_W / 2, VENT_Y2, WALL_H, false);
      } else {
        wallPiece(horizontal, fixed, c - DOOR_W / 2, c + DOOR_W / 2, DOOR_H, WALL_H, false);
      }
      cursor = c + DOOR_W / 2;
    }
    wallPiece(horizontal, fixed, cursor, b, 0, WALL_H, true);
  }

  // Вентиляционные туннели 3 м: за стеной в пустоте; на конце игрока выносит в другую комнату
  const tunnelMat = mat(0x3a4044);
  const vents = [
    { id: 'bath', entry: { x: 0, z: -4.25 }, dir: { x: 0, z: -1 }, exit: { x: 3.5, z: 3.4 } },
    { id: 'storage', entry: { x: 3.5, z: 4.25 }, dir: { x: 0, z: 1 }, exit: { x: 0, z: -3.4 } }
  ];
  for (const v of vents) {
    const len = 3;
    const cz = v.entry.z + v.dir.z * (len / 2);
    const endZ = v.entry.z + v.dir.z * len;
    const part = (w, h, d, x, y, z, collide) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tunnelMat);
      m.position.set(x, y, z);
      scene.add(m);
      if (collide) colliders.push({ x, z, w, d });
    };
    part(1.1, 0.04, len, v.entry.x, VENT_Y1 - 0.02, cz, false); // пол
    part(1.1, 0.04, len, v.entry.x, VENT_Y2 + 0.02, cz, false); // потолок
    part(0.05, VENT_Y2 - VENT_Y1, len, v.entry.x - 0.525, (VENT_Y1 + VENT_Y2) / 2, cz, true);
    part(0.05, VENT_Y2 - VENT_Y1, len, v.entry.x + 0.525, (VENT_Y1 + VENT_Y2) / 2, cz, true);
    part(1.1, VENT_Y2 - VENT_Y1, 0.05, v.entry.x, (VENT_Y1 + VENT_Y2) / 2, endZ + v.dir.z * 0.025, true);
  }

  // --- мебель ---
  const shadowMat = basic(0x000000, { transparent: true, opacity: 0.5, depthWrite: false });
  function furn({ w, h, d, x, z, y = 0, color, collide = true, shadow = true, material }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || mat(color));
    mesh.position.set(x, y + h / 2, z);
    scene.add(mesh);
    if (collide) colliders.push({ x, z, w, d });
    if (shadow) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, d + 0.3), shadowMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.012, z);
      scene.add(s);
    }
    return mesh;
  }
  function plane(w, h, x, y, z, rotY, material) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
  }
  function cylinder(r, h, x, y, z, material) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), material);
    m.position.set(x, y + h / 2, z);
    scene.add(m);
  }

  // Спальня (x -11..-5, z -2.5..2.5)
  furn({ w: 2, h: 0.5, d: 2.2, x: -9.9, z: -1.3, color: 0x3d4a5c });
  furn({ w: 0.8, h: 0.15, d: 0.4, x: -9.9, z: -2.15, y: 0.5, color: 0xcfcfc8, collide: false, shadow: false });
  furn({ w: 2, h: 2, d: 0.6, x: -8, z: 2.15, color: 0x2e2118 });
  furn({ w: 0.5, h: 0.5, d: 0.4, x: -8.6, z: -2.2, color: 0x3a2a1c });
  cylinder(0.08, 0.3, -8.6, 0.5, -2.2, basic(0xc9a66b));

  furn({ w: 1, h: 0.8, d: 0.5, x: -6.3, z: -2.1, color: 0x3a2a1c }); // комод

  // Шкафы и кровати-укрытия: rotationY — куда открыто, наружная нормаль = (sin, cos)
  const closets = [
    { id: 'bedroom', x: -8, z: 2.15, rotationY: Math.PI, w: 2, d: 0.6 },
    { id: 'corridor', x: -3.2, z: -0.875, rotationY: 0, w: 1.2, d: 0.6 },
    { id: 'bed-bedroom', type: 'bed', x: -9.9, z: -1.3, rotationY: Math.PI / 2, w: 2, d: 2.2, eye: 0.3 },
    { id: 'bed-living', type: 'bed', x: -4, z: 6.1, rotationY: Math.PI / 2, w: 1.6, d: 2, eye: 0.3 }
  ];
  furn({ w: 1.2, h: 2, d: 0.6, x: -3.2, z: -0.875, color: 0x2e2118 });
  for (const c of closets) {
    if (c.type) continue;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(c.w - 0.12, 1.9), mat(0x4a3626));
    door.position.set(c.x + Math.sin(c.rotationY) * (c.d / 2 + 0.01), 1.0, c.z + Math.cos(c.rotationY) * (c.d / 2 + 0.01));
    door.rotation.y = c.rotationY;
    scene.add(door);
  }

  // Коридор (x -5..5, z -1.25..1.25)
  cylinder(0.03, 1.8, 4.4, 0, -0.95, mat(0x222222));
  furn({ w: 0.3, h: 0.04, d: 0.3, x: 4.4, z: -0.95, y: 1.8, color: 0x222222, shadow: false });
  furn({ w: 0.8, h: 0.7, d: 0.35, x: 2.6, z: -0.9, color: 0x3a2a1c });
  plane(0.8, 1.2, 2.6, 1.4, -1.16, 0, basic(0x888888));

  furn({ w: 0.8, h: 0.8, d: 0.35, x: -1.6, z: -0.95, color: 0x3a2a1c }); // тумба в коридоре

  // Кухня (x 5..11, z -0.5..3.5)
  furn({ w: 1.5, h: 0.8, d: 0.8, x: 8.2, z: 1.5, color: 0x5b4632 });
  for (const [cx, cz] of [[7.8, 0.8], [8.6, 0.8], [7.8, 2.2], [8.6, 2.2]]) {
    furn({ w: 0.4, h: 0.45, d: 0.4, x: cx, z: cz, color: 0x4a3828, shadow: false });
  }
  furn({ w: 0.7, h: 1.8, d: 0.7, x: 10.55, z: -0.05, color: 0xb8b8b8 });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 8.5, z: -0.125, color: 0x2a2a2a });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 9.1, z: -0.125, color: 0x4a4038 });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 9.7, z: -0.125, color: 0x4a4038 });

  // Ванная (x -1.5..1.5, z -4.25..-1.25)
  furn({ w: 0.4, h: 0.8, d: 0.6, x: -1.1, z: -3.7, color: 0xcfd4d6 }); // шкафчик
  furn({ w: 0.8, h: 0.6, d: 1.7, x: 1.05, z: -3.2, color: 0xcfd4d6 }); // у восточной стены, вентиляция в северной свободна
  furn({ w: 0.4, h: 0.85, d: 0.5, x: -1.25, z: -2.4, color: 0xcfd4d6 });
  plane(0.6, 0.8, -1.42, 1.5, -2.4, Math.PI / 2, basic(0x888888));

  // Гостиная (x -5..2, z 1.25..7.25)
  furn({ w: 0.8, h: 0.9, d: 0.4, x: 0.6, z: 1.55, color: 0x3a2a1c }); // шкафчик у северной стены
  furn({ w: 0.9, h: 0.8, d: 2.2, x: 1.4, z: 4.5, color: 0x3b3f4a });
  furn({ w: 0.2, h: 0.5, d: 2.2, x: 1.75, z: 4.5, y: 0.8, color: 0x3b3f4a, collide: false, shadow: false });
  furn({ w: 0.4, h: 0.5, d: 1.2, x: -4.75, z: 4.5, color: 0x2e2118 });
  furn({ w: 0.06, h: 0.6, d: 1, x: -4.85, z: 4.5, y: 0.5, color: 0x080808, collide: false, shadow: false });
  furn({ w: 0.5, h: 0.4, d: 1, x: -1.2, z: 4.5, color: 0x3a2a1c });
  furn({ w: 0.8, h: 0.8, d: 0.8, x: -2.2, z: 6.6, color: 0x4a3a3a });
  furn({ w: 1.6, h: 0.5, d: 2, x: -4, z: 6.1, color: 0x3d4a5c });
  furn({ w: 0.6, h: 0.15, d: 0.5, x: -4.4, z: 6.6, y: 0.5, color: 0xcfcfc8, collide: false, shadow: false });

  // Кладовка (x 2..5, z 1.25..4.25)
  furn({ w: 0.4, h: 1.8, d: 1, x: 4.75, z: 3.7, color: 0x3a2a1c });
  furn({ w: 0.5, h: 0.5, d: 0.5, x: 2.5, z: 3.9, color: 0x5b4632 });
  furn({ w: 0.5, h: 0.4, d: 0.5, x: 2.5, z: 3.2, color: 0x4a3828 });

  // 12 интерактивных точек (y — высота, на которой стоит маленький ящик)
  const spots = [
    { id: 0, room: 'bedroom', x: -8.45, z: -2.2, y: 0.5 },
    { id: 1, room: 'bedroom', x: -6.3, z: -2.1, y: 0.8 },
    { id: 2, room: 'corridor', x: 2.6, z: -0.9, y: 0.7 },
    { id: 3, room: 'corridor', x: -1.6, z: -0.95, y: 0.8 },
    { id: 4, room: 'kitchen', x: 9.7, z: -0.125, y: 0.9 },
    { id: 5, room: 'kitchen', x: 9.1, z: -0.125, y: 0.9 },
    { id: 6, room: 'bathroom', x: -1.1, z: -3.7, y: 0.8 },
    { id: 7, room: 'living', x: -4.75, z: 4.5, y: 0.5 },
    { id: 8, room: 'living', x: -1.2, z: 4.5, y: 0.4 },
    { id: 9, room: 'living', x: 0.6, z: 1.55, y: 0.9 },
    { id: 10, room: 'storage', x: 4.5, z: 3.7, y: 1.0 },
    { id: 11, room: 'storage', x: 2.5, z: 3.9, y: 0.5 }
  ];

  // Входная дверь (заглушка концовки A): восточная стена кухни
  const frontDoor = { x: 11, z: 2.2 };
  plane(0.95, 2.05, 10.91, 1.025, 2.2, -Math.PI / 2, mat(0x6a2a22));

  // Окна (слабо светятся)
  const windowMat = basic(0x6f8fbf);
  plane(1.2, 1, -10.91, 1.5, 0.9, Math.PI / 2, windowMat);
  plane(1.2, 1, -0.5, 1.5, 7.16, Math.PI, windowMat);

  // тени: фонарик отбрасывает их от стен и мебели
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const planar = o.geometry.type === 'PlaneGeometry';
    o.castShadow = !planar && o.material.type === 'MeshLambertMaterial';
    o.receiveShadow = o.material.type === 'MeshLambertMaterial';
  });

  // Проёмы для дверей
  const doorways = [];
  for (const [horizontal, fixed, , , doors = []] of WALLS) {
    for (const c of doors) doorways.push(horizontal ? { x: c, z: fixed, horizontal } : { x: fixed, z: c, horizontal });
  }

  return { scene, camera, renderer, rooms, colliders, closets, doorways, vents, frontDoor, spots, ambient };
}

export function resizeScene({ camera, renderer }) {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function disposeScene({ scene, renderer }) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    const m = o.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => {
      x.map?.dispose();
      x.dispose();
    });
  });
  renderer.dispose();
}
