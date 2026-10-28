export function mountConfirm(parent, { onYes, onNo }) {
  const el = document.createElement('div');
  el.className = 'overlay overlay-confirm';
  el.innerHTML = `
    <div class="modal">
      <p>Вы уверены? Прогресс ночи будет потерян.</p>
      <div class="modal-buttons">
        <button class="danger" data-yes>Да</button>
        <button data-no>Нет</button>
      </div>
    </div>`;
  el.querySelector('[data-yes]').addEventListener('click', onYes);
  el.querySelector('[data-no]').addEventListener('click', onNo);
  parent.appendChild(el);
  return { destroy: () => el.remove() };
}
