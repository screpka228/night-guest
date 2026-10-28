import * as THREE from 'three';

const WALL_T = 0.15;
const WALL_H = 2.7;
const DOOR_W = 1.0;
const DOOR_H = 2.1;

// Комнаты: прямоугольники в метрах (x → восток, z → юг)
const ROOM_DEFS = [
  { name: 'bedroom',  x1: -7,   z1: -2,   x2: -3,  z2: 2,    floor: 0x4a3626 },
  { name: 'corridor', x1: -3,   z1: -1,   x2: 3,   z2: 1,    floor: 0x4d5254 },
  { name: 'kitchen',  x1: 3,    z1: -1.5, x2: 7,   z2: 1.5,  floor: 0x5a4330 },
  { name: 'bathroom', x1: -1.5, z1: -3,   x2: 1.5, z2: -1,   floor: 0x6c7377 },
  { name: 'living',   x1: -2.5, z1: 1,    x2: 2.5, z2: 5,    floor: 0x3f2d20 }
];

// Стены: horizontal = вдоль x (z фиксирован), иначе вдоль z (x фиксирован)
const WALLS = [
  [true, -2, -7, -3], [true, 2, -7, -3],
  [true, -1.5, 3, 7], [true, 1.5, 3, 7],
  [true, -3, -1.5, 1.5],
  [true, -1, -3, 3, [0]], [true, 1, -3, 3, [0]],
  [true, 5, -2.5, 2.5],
  [false, -7, -2, 2], [false, -3, -2, 2, [0]],
  [false, 3, -1.5, 1.5, [0]], [false, 7, -1.5, 1.5],
  [false, -1.5, -3, -1], [false, 1.5, -3, -1],
  [false, -2.5, 1, 5], [false, 2.5, 1, 5]
];

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.rotation.order = 'YXZ';
  camera.position.set(-4.2, 1.6, 0);
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
  scene.add(new THREE.AmbientLight(0x222233, 0.6));
  const moon = new THREE.DirectionalLight(0x334466, 0.4);
  moon.position.set(-10, 8, -10); // из окна спальни, с северо-запада
  scene.add(moon);

  const flashlight = new THREE.SpotLight(0xffffff, 2.5, 10, Math.PI / 4, 0.3, 1);
  flashlight.position.set(0, 0, 0);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);

  // --- полы и потолки ---
  const rooms = ROOM_DEFS.map((r) => ({ ...r }));
  for (const r of rooms) {
    const w = r.x2 - r.x1;
    const d = r.z2 - r.z1;
    const cx = (r.x1 + r.x2) / 2;
    const cz = (r.z1 + r.z2) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(r.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0x161616));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, WALL_H, cz);
    scene.add(ceiling);
  }

  // --- стены с проёмами ---
  const wallMat = mat(0x6b645d);
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
  for (const [horizontal, fixed, a0, b0, doors = []] of WALLS) {
    const a = a0 - WALL_T / 2; // закрываем углы
    const b = b0 + WALL_T / 2;
    let cursor = a;
    for (const c of [...doors].sort((p, q) => p - q)) {
      wallPiece(horizontal, fixed, cursor, c - DOOR_W / 2, 0, WALL_H, true);
      wallPiece(horizontal, fixed, c - DOOR_W / 2, c + DOOR_W / 2, DOOR_H, WALL_H, false);
      cursor = c + DOOR_W / 2;
    }
    wallPiece(horizontal, fixed, cursor, b, 0, WALL_H, true);
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

  // Спальня
  furn({ w: 2, h: 0.5, d: 2.2, x: -5.8, z: -0.8, color: 0x3d4a5c });
  furn({ w: 0.8, h: 0.15, d: 0.4, x: -5.8, z: -1.65, y: 0.5, color: 0xcfcfc8, collide: false, shadow: false });
  furn({ w: 2, h: 2, d: 0.6, x: -5, z: 1.6, color: 0x2e2118 });
  furn({ w: 0.5, h: 0.5, d: 0.4, x: -4.45, z: -1.7, color: 0x3a2a1c });
  cylinder(0.08, 0.3, -4.45, 0.5, -1.7, basic(0xc9a66b));

  // Коридор
  cylinder(0.03, 1.8, 2.5, 0, -0.8, mat(0x222222));
  furn({ w: 0.3, h: 0.04, d: 0.3, x: 2.5, z: -0.8, y: 1.8, color: 0x222222, shadow: false });
  furn({ w: 0.8, h: 0.7, d: 0.35, x: -2, z: -0.8, color: 0x3a2a1c });
  plane(0.8, 1.2, -2, 1.4, -0.91, 0, basic(0x888888));

  // Кухня
  furn({ w: 1.5, h: 0.8, d: 0.8, x: 5.2, z: 0.2, color: 0x5b4632 });
  for (const [cx, cz] of [[4.8, -0.5], [5.6, -0.5], [4.8, 0.9], [5.6, 0.9]]) {
    furn({ w: 0.4, h: 0.45, d: 0.4, x: cx, z: cz, color: 0x4a3828, shadow: false });
  }
  furn({ w: 0.7, h: 1.8, d: 0.7, x: 6.55, z: -1.05, color: 0xb8b8b8 });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 4, z: -1.15, color: 0x2a2a2a });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 4.65, z: -1.15, color: 0x4a4038 });
  furn({ w: 0.6, h: 0.9, d: 0.6, x: 5.3, z: -1.15, color: 0x4a4038 });

  // Ванная
  furn({ w: 1.7, h: 0.6, d: 0.8, x: 0.6, z: -2.5, color: 0xcfd4d6 });
  furn({ w: 0.4, h: 0.85, d: 0.5, x: -1.25, z: -1.9, color: 0xcfd4d6 });
  plane(0.6, 0.8, -1.42, 1.5, -1.9, Math.PI / 2, basic(0x888888));

  // Гостиная
  furn({ w: 0.9, h: 0.8, d: 2.2, x: 2, z: 3, color: 0x3b3f4a });
  furn({ w: 0.2, h: 0.5, d: 2.2, x: 2.35, z: 3, y: 0.8, color: 0x3b3f4a, collide: false, shadow: false });
  furn({ w: 0.4, h: 0.5, d: 1.2, x: -2.2, z: 3, color: 0x2e2118 });
  furn({ w: 0.06, h: 0.6, d: 1, x: -2.3, z: 3, y: 0.5, color: 0x080808, collide: false, shadow: false });
  furn({ w: 0.5, h: 0.4, d: 1, x: 0.2, z: 3, color: 0x3a2a1c });
  furn({ w: 0.8, h: 0.8, d: 0.8, x: -1.2, z: 4.4, color: 0x4a3a3a });

  // Окна (слабо светятся)
  const windowMat = basic(0x6f8fbf);
  plane(1.2, 1, -6.91, 1.5, -1, Math.PI / 2, windowMat);
  plane(1.2, 1, 1.2, 1.5, 4.91, Math.PI, windowMat);

  return { scene, camera, renderer, rooms, colliders };
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
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
  });
  renderer.dispose();
}
