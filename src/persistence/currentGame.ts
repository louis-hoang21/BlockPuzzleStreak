import type { GameState } from '../core/game';
import { readJson, storage, writeJson } from './storage';

const key = (mode: string) => `current-game.${mode}`;

export function loadCurrentGame(mode: string): GameState | null {
  const saved = readJson<{ game: GameState | null }>(key(mode), { game: null });
  return saved.game && !saved.game.over ? saved.game : null;
}

export function saveCurrentGame(mode: string, game: GameState) {
  if (game.over) {
    storage.remove(key(mode));
    storage.remove(`${key(mode)}.bak`);
  } else {
    writeJson(key(mode), { game });
  }
}
