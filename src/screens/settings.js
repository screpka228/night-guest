import { navigate } from '../router.js';

function load(key) {
  try {
    return localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
}

export function mountSettings(root) {
  root.innerHTML = `
    <div class="screen settings">
      <h2>Настройки</h2>
      <input type="text" placeholder="Ник" disabled />
      <label class="row"><input type="checkbox" data-opt="ng_sound" ${load('ng_sound') ? 'checked' : ''} /> Звук</label>
      <label class="row"><input type="checkbox" data-opt="ng_vibration" ${load('ng_vibration') ? 'checked' : ''} /> Вибрация</label>
      <button disabled>Сменить ник</button>
      <button data-back>Назад</button>
    </div>`;
  root.querySelectorAll('[data-opt]').forEach((c) =>
    c.addEventListener('change', () => {
      try {
        localStorage.setItem(c.dataset.opt, c.checked ? '1' : '0');
      } catch {}
    })
  );
  root.querySelector('[data-back]').addEventListener('click', () => navigate('menu'));
}
