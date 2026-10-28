import { getDifficulty } from './difficulty.js';

export let gameState = null;

export function createGameState() {
  gameState = {
    startedAt: Date.now(),
    pausedAt: null,
    pausedDuration: 0,
    difficulty: getDifficulty(),
    night: 1
  };
  return gameState;
}

export function resetGameState() {
  gameState = null;
}

export function pauseGame() {
  if (gameState && gameState.pausedAt === null) gameState.pausedAt = Date.now();
}

export function resumeGame() {
  if (gameState && gameState.pausedAt !== null) {
    gameState.pausedDuration += Date.now() - gameState.pausedAt;
    gameState.pausedAt = null;
  }
}

// MM:SS; на паузе время стоит на моменте паузы
export function getElapsedTime() {
  if (!gameState) return '00:00';
  const now = gameState.pausedAt ?? Date.now();
  const total = Math.max(0, Math.floor((now - gameState.startedAt - gameState.pausedDuration) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
