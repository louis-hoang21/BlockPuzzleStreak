import type { ClassicState } from '../core/classic/engine';
import { readJson, storage, writeJson } from './storage';

const KEY = 'current-game.classic';

export function loadClassicGame(): ClassicState | null {
  const saved = readJson<{ game: ClassicState | null }>(KEY, { game: null });
  return saved.game && !saved.game.over ? saved.game : null;
}

export function saveClassicGame(game: ClassicState) {
  if (game.over) {
    storage.remove(KEY);
    storage.remove(`${KEY}.bak`);
  } else {
    writeJson(KEY, { game });
  }
}
