import { navigate } from '../router.js';

// Универсальный экран концовки: заголовок, текст, дополнительные строки, кнопка
function mountEnding(parent, { cls, title, text, lines = [], button, to }) {
  const el = document.createElement('div');
  el.className = 'overlay overlay-dead ' + cls;
  el.innerHTML = `
    <div class="dead-box">
      <h2>${title}</h2>
      <p>${text}</p>
      ${lines.map((l) => `<p class="dim">${l}</p>`).join('')}
      <button data-act>${button}</button>
    </div>`;
  el.querySelector('[data-act]').addEventListener('click', () => navigate(to));
  parent.appendChild(el);
  return { destroy: () => el.remove() };
}

// Концовка D: гость поймал
export function mountEndingD(parent, { attemptsLeft }) {
  const more = attemptsLeft > 0;
  return mountEnding(parent, {
    cls: 'overlay-lose',
    title: 'Он нашёл вас',
    text: 'Новая ночь. Вы просыпаетесь в 2:47 от звука разбитого стекла.',
    lines: [`Попыток: ${attemptsLeft === Infinity ? '∞' : attemptsLeft}`],
    button: more ? 'Попробовать снова' : 'В меню',
    to: more ? 'game' : 'menu'
  });
}

// Концовка A: побег
export function mountEndingA(parent, { time, nextNight }) {
  return mountEnding(parent, {
    cls: 'overlay-win',
    title: 'Вы сбежали',
    text: 'В отражении лифта вы видите, что ваше тело осталось в квартире. В 2:47.',
    lines: [`Время: ${time}`, `Следующая ночь: ${nextNight}`],
    button: 'В меню',
    to: 'menu'
  });
}

// Концовка C: переждали до рассвета
export function mountEndingC(parent, { time, nextNight }) {
  return mountEnding(parent, {
    cls: 'overlay-dawn',
    title: 'Вы переждали до утра',
    text: 'Вы переждали до рассвета. Но на столе появился новый предмет.',
    lines: [`Время: ${time}`, `Следующая ночь: ${nextNight}`],
    button: 'В меню',
    to: 'menu'
  });
}

// После 5-й ночи
export function mountCredits(parent) {
  return mountEnding(parent, {
    cls: 'overlay-win',
    title: 'Ночной гость',
    text: 'Пять ночей позади. Но в 2:47 дверь снова скрипнет.',
    lines: ['Спасибо за игру', 'Конец'],
    button: 'В меню',
    to: 'menu'
  });
}
