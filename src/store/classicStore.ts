import { create } from 'zustand';

import { newClassic, type ClassicState } from '../core/classic/engine';
import { loadClassicGame, saveClassicGame } from '../persistence/classicGame';
import { useRecordsStore, type GameResult } from './recordsStore';

interface ClassicStore {
  game: ClassicState;
  result: GameResult | null;
  start: () => void;
  resume: () => void;
  commit: (game: ClassicState, save: boolean) => void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

export const useClassicStore = create<ClassicStore>()((set, get) => ({
  game: loadClassicGame() ?? newClassic(randomSeed()),
  result: null,
  start: () => {
    const game = newClassic(randomSeed());
    saveClassicGame(game);
    set({ game, result: null });
  },
  resume: () => {
    if (get().game.over) get().start();
  },
  commit: (game, save) => {
    let result = get().result;
    if (game.over && !result)
      result = useRecordsStore.getState().submit('classic', game.score, game.stats.linesCleared, game.level);
    if (save || game.over) saveClassicGame(game);
    set({ game, result });
  },
}));
