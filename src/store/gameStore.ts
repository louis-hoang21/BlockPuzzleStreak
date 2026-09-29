import { create } from 'zustand';

import { hasMove, newGame, placePiece, rotatePiece, type GameState, type PlaceResult } from '../core/game';
import type { Mode } from '../core/modes';
import { prefillDifficulty, prefilledBoard, shouldPrefill } from '../core/prefill';
import { createRng } from '../core/rng';
import { loadCurrentGame, saveCurrentGame } from '../persistence/currentGame';
import { useNoticeStore } from './noticeStore';
import { useProgressStore } from './progressStore';
import { useRecordsStore, type GameResult } from './recordsStore';

export type { Mode } from '../core/modes';

interface ModeState {
  game: GameState;
  result: GameResult | null;
}

interface GameStore {
  modes: Record<Mode, ModeState>;
  start: (mode: Mode) => void;
  resume: (mode: Mode) => void;
  place: (mode: Mode, slot: number, row: number, col: number) => PlaceResult | null;
  rotate: (mode: Mode, slot: number) => boolean;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

function fresh(mode: Mode): ModeState {
  const seed = randomSeed();
  const rotations = useProgressStore.getState().rotations;
  const best = useRecordsStore.getState().byMode[mode].bestScore;
  const rng = createRng(seed ^ 0x9e3779b9).next;
  if (shouldPrefill(best, rng)) {
    useNoticeStore.getState().push('Màn giải đố! Ghép khéo vào chỗ trống để nổ hũ');
    return { game: newGame(seed, rotations, prefilledBoard(rng, prefillDifficulty(rng, best))), result: null };
  }
  return { game: newGame(seed, rotations), result: null };
}

function restore(mode: Mode): ModeState {
  const game = loadCurrentGame(mode);
  return game ? { game, result: null } : fresh(mode);
}

export const useGameStore = create<GameStore>()((set, get) => {
  const current = (mode: Mode): GameState => ({
    ...get().modes[mode].game,
    rotations: useProgressStore.getState().rotations,
  });

  const commit = (mode: Mode, prev: GameState, next: GameState) => {
    const state = get().modes[mode];
    const progress = useProgressStore.getState();
    if (next.score > prev.score) progress.onScore(prev.score, next.score);
    if (next.stats.perfectClears > prev.stats.perfectClears) progress.onPerfectClear();
    if (next.combo > prev.combo) progress.onCombo(next.combo);

    const game = next;
    let result = state.result;
    if (game.over && !result) result = useRecordsStore.getState().submit(mode, game.score, game.stats.linesCleared);
    saveCurrentGame(mode, game);
    set({ modes: { ...get().modes, [mode]: { game, result } } });
  };

  return {
    modes: { jackpot: restore('jackpot') },
    start: (mode) => {
      const state = fresh(mode);
      saveCurrentGame(mode, state.game);
      set({ modes: { ...get().modes, [mode]: state } });
    },
    resume: (mode) => {
      const game = get().modes[mode].game;
      if (game.over) {
        get().start(mode);
        return;
      }
      if (!hasMove(game.board, game.tray)) commit(mode, game, { ...game, over: true });
    },
    place: (mode, slot, row, col) => {
      const prev = current(mode);
      const result = placePiece(prev, slot, row, col);
      if (result) commit(mode, prev, result.state);
      return result;
    },
    rotate: (mode, slot) => {
      const prev = current(mode);
      const game = rotatePiece(prev, slot);
      if (!game) return false;
      useProgressStore.getState().setRotations(game.rotations);
      commit(mode, prev, game);
      return true;
    },
  };
});
