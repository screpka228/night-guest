// Вентиляция: лаз 3 м, проходится только ползком; на конце игрока выносит в другую комнату.
// Гость пройти не может: туннели лежат вне комнат, сетка поиска пути их не видит.
const ZONE_BEFORE = 0.7; // автоприсед за 0.7 м до проёма
const TUNNEL_LEN = 3;
const EXIT_AT = 2.55; // до упора в торец игрок не дойдёт (радиус 0.3)
const CRAWL_EYE = 0.6;

export function createVents({ vents, camera, controls, container }) {
  const hint = document.createElement('div');
  hint.className = 'toast';
  hint.textContent = 'Проползите';
  hint.hidden = true;
  container.appendChild(hint);
  let hintTimer = 0;

  function update(dt) {
    const p = camera.position;
    let crawling = false;
    for (const v of vents) {
      const rx = p.x - v.entry.x;
      const rz = p.z - v.entry.z;
      const along = rx * v.dir.x + rz * v.dir.z;
      const lat = Math.abs(rx * v.dir.z - rz * v.dir.x);
      if (along > -ZONE_BEFORE && along < TUNNEL_LEN + 0.1 && lat < 0.7) {
        if (controls.getState().mode !== 'crouch') {
          controls.forceMode('crouch');
          hint.hidden = false;
          hintTimer = 2;
        }
        if (along >= 0) crawling = true;
        if (along >= EXIT_AT && lat < 0.6) {
          // выход в кладовке / ванной с сохранением направления взгляда
          p.x = v.exit.x;
          p.z = v.exit.z;
          crawling = false;
          break;
        }
      }
    }
    controls.setEyeOverride(crawling ? CRAWL_EYE : null);
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.hidden = true;
    }
  }

  function dispose() {
    hint.remove();
    controls.setEyeOverride(null);
  }

  return { update, dispose };
}
