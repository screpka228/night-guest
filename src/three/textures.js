import * as THREE from 'three';

const SIZE = 512;
const rnd = (a, b) => a + Math.random() * (b - a);

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

function toTexture(c, repeat = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

// Деревянный пол: доски, волокна, царапины, затемнение по краям
export function woodFloor() {
  const c = canvas();
  const g = c.getContext('2d');
  g.fillStyle = '#6a4a2e';
  g.fillRect(0, 0, SIZE, SIZE);
  const boards = 8;
  const h = SIZE / boards;
  for (let i = 0; i < boards; i++) {
    const shade = rnd(-18, 18);
    g.fillStyle = `rgb(${106 + shade}, ${74 + shade}, ${46 + shade})`;
    g.fillRect(0, i * h, SIZE, h);
    // волокна
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(40, 25, 12, ${rnd(0.05, 0.18)})`;
      g.lineWidth = rnd(0.5, 1.5);
      const y = i * h + rnd(2, h - 2);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(SIZE * 0.3, y + rnd(-3, 3), SIZE * 0.6, y + rnd(-3, 3), SIZE, y + rnd(-2, 2));
      g.stroke();
    }
    // стыки досок
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, i * h, SIZE, 2);
    const seam = rnd(60, SIZE - 60);
    g.fillRect(seam, i * h, 2, h);
  }
  // царапины
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(200, 170, 130, ${rnd(0.05, 0.2)})`;
    g.lineWidth = rnd(0.5, 1.2);
    const x = rnd(0, SIZE);
    const y = rnd(0, SIZE);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd(-60, 60), y + rnd(-25, 25));
    g.stroke();
  }
  // затемнение по краям
  const vg = g.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.25, SIZE / 2, SIZE / 2, SIZE * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg;
  g.fillRect(0, 0, SIZE, SIZE);
  return toTexture(c);
}

// Бетон: серый фон, цветной пиксельный шум, тёмные разводы
export function concreteWall() {
  const c = canvas();
  const g = c.getContext('2d');
  g.fillStyle = '#7a7a78';
  g.fillRect(0, 0, SIZE, SIZE);
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    d[i] += n + (Math.random() - 0.5) * 8;
    d[i + 1] += n + (Math.random() - 0.5) * 8;
    d[i + 2] += n + (Math.random() - 0.5) * 8;
  }
  g.putImageData(img, 0, 0);
  // грязные разводы
  for (let i = 0; i < 14; i++) {
    const x = rnd(0, SIZE);
    const y = rnd(0, SIZE);
    const r = rnd(40, 150);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(30, 28, 20, ${rnd(0.12, 0.3)})`);
    grad.addColorStop(1, 'rgba(30, 28, 20, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
  }
  return toTexture(c);
}

// Обои: светло-серый фон с вертикальными полосами
export function wallpaper() {
  const c = canvas();
  const g = c.getContext('2d');
  g.fillStyle = '#b9b9b4';
  g.fillRect(0, 0, SIZE, SIZE);
  const stripe = 32;
  for (let x = 0; x < SIZE; x += stripe * 2) {
    g.fillStyle = 'rgba(80, 80, 90, 0.18)';
    g.fillRect(x, 0, stripe, SIZE);
  }
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd(0.02, 0.06)})`;
    g.fillRect(rnd(0, SIZE), rnd(0, SIZE), 1, 1);
  }
  return toTexture(c);
}
