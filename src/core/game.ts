import balance from '../../config/balance.json';
import {
  canFitAnywhere,
  canPlace,
  clearLines,
  createBoard,
  findFullLines,
  isEmpty,
  lineCount,
  place,
  type Board,
  type Lines,
} from './board';
import { nextPieceSet, type Piece } from './pieceGenerator';
import { rotateCW, sameShape } from './pieces';
import { createRng } from './rng';
import { scorePlacement, type PlacementScore } from './scoreEngine';

export interface GameStats {
  placements: number;
  linesCleared: number;
  perfectClears: number;
  maxCombo: number;
  maxLinesAtOnce: number;
  rotationsUsed: number;
}

export interface GameState {
  board: Board;
  tray: (Piece | null)[];
  score: number;
  banked?: number;
  combo: number;
  rotations: number;
  rngState: number;
  seed?: number;
  setColors?: number[];
  stats: GameStats;
  over: boolean;
}

export interface PlaceResult {
  state: GameState;
  score: PlacementScore;
  cleared: Lines;
  placed: Board;
  refilled: boolean;
}

export function newGame(seed: number, board: Board = createBoard(balance.gridSize)): GameState {
  const rng = createRng(seed);
  const tray = nextPieceSet(rng.next, board, 0);
  return {
    board,
    tray,
    score: 0,
    combo: 0,
    rotations: balance.startingRotations,
    rngState: rng.state(),
    seed,
    setColors: tray.map((p) => p.color),
    stats: {
      placements: 0,
      linesCleared: 0,
      perfectClears: 0,
      maxCombo: 0,
      maxLinesAtOnce: 0,
      rotationsUsed: 0,
    },
    over: false,
  };
}

export function placePiece(state: GameState, slot: number, row: number, col: number): PlaceResult | null {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece.cells, row, col)) return null;

  const placed = place(state.board, piece.cells, row, col, piece.color);
  const cleared = findFullLines(placed);
  const n = lineCount(cleared);
  const board = n > 0 ? clearLines(placed, cleared) : placed;
  const perfectClear = n > 0 && isEmpty(board);
  const score = scorePlacement(piece.cells.length, n, state.combo, perfectClear, state.banked ?? 0);

  let tray = state.tray.map((p, i) => (i === slot ? null : p));
  let rngState = state.rngState;
  let setColors = state.setColors;
  const refilled = tray.every((p) => p === null);
  if (refilled) {
    const rng = createRng(rngState);
    const fresh = nextPieceSet(rng.next, board, state.score + score.total, setColors);
    tray = fresh;
    setColors = fresh.map((p) => p.color);
    rngState = rng.state();
  }

  const stats: GameStats = {
    ...state.stats,
    placements: state.stats.placements + 1,
    linesCleared: state.stats.linesCleared + n,
    perfectClears: state.stats.perfectClears + (perfectClear ? 1 : 0),
    maxCombo: Math.max(state.stats.maxCombo, score.combo),
    maxLinesAtOnce: Math.max(state.stats.maxLinesAtOnce, n),
  };
  const next: GameState = {
    ...state,
    board,
    tray,
    score: state.score + score.total,
    banked: score.banked,
    combo: score.combo,
    rngState,
    setColors,
    stats,
  };
  next.over = isOver(next);
  return { state: next, score, cleared, placed, refilled };
}

export function rotatePiece(state: GameState, slot: number): GameState | null {
  const piece = state.tray[slot];
  if (state.over || !piece || state.rotations <= 0) return null;
  const cells = rotateCW(piece.cells);
  if (sameShape(cells, piece.cells)) return null;

  const tray = state.tray.map((p, i) => (i === slot ? { ...piece, cells } : p));
  const next: GameState = {
    ...state,
    tray,
    rotations: state.rotations - 1,
    stats: { ...state.stats, rotationsUsed: state.stats.rotationsUsed + 1 },
  };
  next.over = isOver(next);
  return next;
}

export function hasMove(board: Board, tray: readonly (Piece | null)[]): boolean {
  return tray.some((piece) => piece !== null && canFitAnywhere(board, piece.cells));
}

export function rescueSlots(state: GameState): number[] {
  const slots: number[] = [];
  state.tray.forEach((piece, slot) => {
    if (!piece) return;
    let cells = piece.cells;
    for (let turn = 1; turn <= Math.min(3, state.rotations); turn++) {
      cells = rotateCW(cells);
      if (sameShape(cells, piece.cells)) return;
      if (canFitAnywhere(state.board, cells)) {
        slots.push(slot);
        return;
      }
    }
  });
  return slots;
}

export function isOver(state: GameState): boolean {
  return !hasMove(state.board, state.tray) && rescueSlots(state).length === 0;
}

export function addRotations(current: number, amount: number): { rotations: number; added: number } {
  const rotations = Math.min(balance.maxRotations, current + amount);
  return { rotations, added: rotations - current };
}
