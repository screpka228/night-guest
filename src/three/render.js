export function createLoop({ renderer, scene, camera, controls, container, debug }) {
  let raf = 0;
  let lastTime = 0;
  let frames = 0;
  let acc = 0;

  let fpsEl = null;
  if (debug) {
    fpsEl = document.createElement('div');
    fpsEl.className = 'fps-counter';
    container.appendChild(fpsEl);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    controls.update(dt);
    renderer.render(scene, camera);

    if (fpsEl) {
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        const p = camera.position;
        fpsEl.textContent = `FPS ${Math.round(frames / acc)}  x=${p.x.toFixed(1)} y=${p.y.toFixed(2)} z=${p.z.toFixed(1)}`;
        frames = 0;
        acc = 0;
      }
    }
  }

  return {
    start() {
      if (raf) return;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    dispose() {
      this.stop();
      fpsEl?.remove();
    }
  };
}
