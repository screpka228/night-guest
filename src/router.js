import { mountMenu } from './screens/menu.js';
import { mountDifficulty } from './screens/difficulty.js';
import { mountSettings } from './screens/settings.js';
import { mountLeaderboard } from './screens/leaderboard.js';
import { mountGame } from './screens/game.js';
import { mountEnding } from './screens/ending.js';

const SCREENS = {
  menu: mountMenu,
  difficulty: mountDifficulty,
  game: mountGame,
  ending: mountEnding,
  leaderboard: mountLeaderboard,
  settings: mountSettings
};

let cleanup = null;

export function navigate(screen) {
  screen = screen.replace(/^#/, '');
  if (location.hash !== '#' + screen) {
    location.hash = screen;
    return;
  }
  render();
}

function render() {
  const name = location.hash.slice(1);
  const mount = SCREENS[name] || SCREENS.menu;
  const app = document.getElementById('app');
  if (typeof cleanup === 'function') cleanup();
  app.innerHTML = '';
  cleanup = mount(app) || null;
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  if (!SCREENS[location.hash.slice(1)]) location.hash = 'menu';
  render();
}
