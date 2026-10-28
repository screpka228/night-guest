import * as THREE from 'three';

// Гость из примитивов: высокий худой силуэт с неестественно длинными руками.
// Фронт модели — +z. Рост около 2.4 м.
export function createGuestModel({ opacity = 1 } = {}) {
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: opacity < 1, opacity });
  const group = new THREE.Group();
  const add = (parent, mesh) => {
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // торс: верх шире (0.2), низ уже (0.1), высота 1.2 над бёдрами
  add(group, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 1.2, 10), material)).position.y = 1.4;

  // голова слегка наклонена вперёд
  const head = new THREE.Group();
  head.position.set(0, 2.05, 0.04);
  head.rotation.x = 0.35;
  add(head, new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), material)).position.y = 0.15;
  group.add(head);

  // руки: цилиндры r=0.05, длина 1.0 × 1.4 — почти до колен; крепятся к плечам
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 1.95, 0);
    const arm = add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), material));
    arm.scale.y = 1.4;
    arm.position.y = -0.7;
    group.add(pivot);
    return pivot;
  });

  // ноги: цилиндры r=0.08, высота 0.8
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.8, 0);
    add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), material)).position.y = -0.4;
    group.add(pivot);
    return pivot;
  });

  let t = 0;
  let twitch = 0;

  // time — секунды, moving — идёт ли, lookYaw — угол на игрока относительно корпуса
  function animate(dt, speed, lookYaw) {
    t += dt;
    const moving = speed > 0.15;
    const phase = t * (4 + speed * 2.5);
    const swing = moving ? Math.min(0.9, 0.4 + speed * 0.15) : 0;
    legs[0].rotation.x = Math.sin(phase) * swing;
    legs[1].rotation.x = -Math.sin(phase) * swing;
    const idle = Math.sin(t * 1.3) * 0.06;
    arms[0].rotation.x = -Math.sin(phase) * swing * 0.8 + idle;
    arms[1].rotation.x = Math.sin(phase) * swing * 0.8 - idle;
    arms[0].rotation.z = 0.08 + Math.sin(t * 0.9) * 0.03;
    arms[1].rotation.z = -0.08 - Math.sin(t * 0.9) * 0.03;
    // голова всегда смотрит на игрока, изредка дёргается
    if (Math.random() < 0.01) twitch = (Math.random() - 0.5) * 0.5;
    twitch *= 0.9;
    head.rotation.y = Math.max(-1.1, Math.min(1.1, lookYaw)) + twitch;
  }

  return { group, material, animate };
}
