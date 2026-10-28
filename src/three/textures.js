import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL;

// Текстуры: настоящие фото (дерево и кирпич из примеров three.js, лежат в public/assets).
// Ковра в примерах three.js нет — для спальни простой шум.
export function loadTextures(manager) {
  const loader = new THREE.TextureLoader(manager);
  const load = (file) =>
    new Promise((resolve) => {
      loader.load(
        BASE + 'assets/textures/' + file,
        (t) => resolve(prepare(t)),
        undefined,
        () => resolve(null) // нет текстуры — остаётся цвет материала
      );
    });
  return Promise.all([load('hardwood2_diffuse.jpg'), load('brick_diffuse.jpg')]).then(([wood, brick]) => ({
    wood,
    brick,
    carpet: carpetNoise()
  }));
}

function prepare(t) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

function carpetNoise() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 70 + Math.random() * 50;
    img.data[i] = v * 1.1;
    img.data[i + 1] = v * 0.7;
    img.data[i + 2] = v * 0.6;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return prepare(new THREE.CanvasTexture(c));
}
