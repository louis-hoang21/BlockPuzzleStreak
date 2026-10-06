import { create } from 'zustand';

import balance from '../../config/balance.json';
import milestones from '../../config/milestones.json';
import {
  addRotations,
  castStorm,
  isOver,
  newGame,
  placePiece,
  rotatePiece,
  type GameState,
  type PlaceResult,
  type StormResult,
} from '../core/game';
import { rotationMilestonesCrossed } from '../core/milestones';
import type { BoardMode as Mode } from '../core/modes';
import { prefillDifficulty, prefilledBoard, shouldPrefill } from '../core/prefill';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { loadCurrentGame, saveCurrentGame } from '../persistence/currentGame';
import { useNoticeStore } from './noticeStore';
import { isTester, useProgressStore } from './progressStore';
import { useRecordsStore, type GameResult } from './recordsStore';

export type { BoardMode as Mode } from '../core/modes';

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
  storm: (mode: Mode) => StormResult | null;
  giveUp: (mode: Mode) => void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

function fresh(mode: Mode): ModeState {
  const seed = randomSeed();
  const { bestScore: best, gamesPlayed } = useRecordsStore.getState().byMode[mode];
  const tester = isTester();
  const firstGame = gamesPlayed === 0;
  const stormNeed = tester ? balance.tester.stormNeed : firstGame ? [balance.storm.firstGameNeed] : [];
  const stormMax = tester ? balance.tester.maxStorms : balance.storm.maxStorms + (firstGame ? 1 : 0);
  const rotations = tester ? balance.tester.rotations : balance.startingRotations;
  const rng = createRng(seed ^ 0x9e3779b9).next;
  if (shouldPrefill(best, rng) || (tester && rng() < balance.tester.prefillChance)) {
    useNoticeStore.getState().push(t('Puzzle board! Fit blocks into the gaps to clear lines', 'Màn giải đố! Ghép khéo vào chỗ trống để nổ hàng'));
    return {
      game: newGame(seed, prefilledBoard(rng, prefillDifficulty(rng, best)), balance.chainSets, stormNeed, rotations, stormMax),
      result: null,
    };
  }
  return { game: newGame(seed, undefined, 0, stormNeed, rotations, stormMax), result: null };
}

function restore(mode: Mode): ModeState {
  const game = loadCurrentGame(mode);
  return game ? { game, result: null } : fresh(mode);
}

export const useGameStore = create<GameStore>()((set, get) => {
  const current = (mode: Mode): GameState => get().modes[mode].game;

  const withMilestones = (prev: GameState, next: GameState): GameState => {
    let rotations = next.rotations;
    for (const score of rotationMilestonesCrossed(prev.score, next.score)) {
      const granted = addRotations(rotations, milestones.rotationMilestones.rotations);
      rotations = granted.rotations;
      const notices = useNoticeStore.getState();
      const points = score.toLocaleString();
      if (granted.added > 0)
        notices.push(t(`${points} points! +${granted.added} rotations`, `Mốc ${points} điểm! +${granted.added} lượt xoay`), 'rotation');
      else notices.push(t(`${points} points! Rotations are full`, `Mốc ${points} điểm! Kho xoay đã đầy`));
    }
    if (rotations === next.rotations) return next;
    const game = { ...next, rotations };
    return { ...game, over: isOver(game) };
  };

  const commit = (mode: Mode, prev: GameState, next: GameState) => {
    const state = get().modes[mode];
    const progress = useProgressStore.getState();
    if (next.score > prev.score) progress.onScore(prev.score, next.score);
    if (next.stats.perfectClears > prev.stats.perfectClears) progress.onPerfectClear();
    if (next.combo > prev.combo) progress.onCombo(next.combo);

    const game = withMilestones(prev, next);
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
      if (isOver(game)) commit(mode, game, { ...game, over: true });
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
      commit(mode, prev, game);
      return true;
    },
    storm: (mode) => {
      const prev = current(mode);
      const result = castStorm(prev);
      if (!result) return null;
      commit(mode, prev, result.state);
      useNoticeStore
        .getState()
        .push(
          result.wiped
            ? t('Block Storm! The board is swept clean', 'Bão khối! Bàn được quét sạch')
            : t('Block Storm! The board is reshuffled', 'Bão khối! Bàn được xáo lại'),
        );
      return result;
    },
    giveUp: (mode) => {
      const game = current(mode);
      if (!game.over) commit(mode, game, { ...game, over: true });
    },
  };
});
