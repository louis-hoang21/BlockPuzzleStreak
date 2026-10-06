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
  solidRect,
  type Board,
  type CellRect,
  type Lines,
} from './board';
import { chainSet, nextPieceSet, type Piece } from './pieceGenerator';
import { rotateCW, sameShape } from './pieces';
import { createRng } from './rng';
import { scorePlacement, type PlacementScore } from './scoreEngine';
import { shuffleBoard } from './storm';

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
  chainSets?: number;
  stormed?: boolean;
  storms?: number;
  stormNeed?: number[];
  stormMax?: number;
  energy?: number;
  gift?: number;
  queued?: Piece[];
  stats: GameStats;
  over: boolean;
}

export interface PlaceResult {
  state: GameState;
  score: PlacementScore;
  cleared: Lines;
  placed: Board;
  refilled: boolean;
  heart: CellRect | null;
  gift?: GiftBlast;
}

export interface StormResult {
  state: GameState;
  before: Board;
  wiped: boolean;
}

export interface GiftBlast {
  row: number;
  col: number;
  rows: number[];
  cols: number[];
}

export function newGame(
  seed: number,
  board: Board = createBoard(balance.gridSize),
  chainSets = 0,
  stormNeed: number[] = [],
  rotations: number = balance.startingRotations,
  stormMax: number = balance.storm.maxStorms,
): GameState {
  const rng = createRng(seed);
  const tray = (chainSets > 0 && chainSet(rng.next, board, chainSets)) || nextPieceSet(rng.next, board, 0);
  return {
    board,
    tray,
    ...(chainSets > 1 ? { chainSets: chainSets - 1 } : {}),
    stormNeed,
    stormMax,
    score: 0,
    combo: 0,
    rotations,
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

function needByScore(score: number): number {
  const { atScore, need } = balance.storm.needByScore;
  let value = need[0];
  atScore.forEach((at, i) => {
    if (score >= at) value = need[i];
  });
  return value;
}

function wipeChance(score: number): number {
  const { atScore, chance } = balance.storm.wipeChance;
  let value = chance[0];
  atScore.forEach((at, i) => {
    if (score >= at) value = chance[i];
  });
  return value;
}

export function stormNeedAt(state: GameState, score = state.score): number {
  return state.stormNeed?.[state.storms ?? 0] ?? needByScore(score);
}

export function stormEnergy(state: GameState): { energy: number; need: number; ready: boolean; done: boolean } {
  const done = (state.storms ?? 0) >= (state.stormMax ?? balance.storm.maxStorms);
  const need = done ? 0 : stormNeedAt(state);
  const energy = done ? 0 : Math.min(state.energy ?? 0, need);
  return { energy, need, ready: !done && energy >= need, done };
}

function heartRect(before: Board, after: Board, pieceCells: number): CellRect | null {
  const rect = solidRect(after);
  if (!rect || rect.rows < 2 || rect.cols < 2) return null;
  const area = rect.rows * rect.cols;
  if (area < balance.heart.minCells || area <= pieceCells) return null;
  return solidRect(before) ? null : rect;
}

function giftBlast(board: Board, gift: number | undefined, full: Lines): GiftBlast | undefined {
  if (gift === undefined || board.cells[gift] === 0) return undefined;
  const n = board.size;
  const row = Math.floor(gift / n);
  const col = gift % n;
  if (!full.rows.includes(row) && !full.cols.includes(col)) return undefined;
  const r = balance.gift.radius;
  const around = (center: number) =>
    Array.from({ length: r * 2 + 1 }, (_, k) => center - r + k).filter((i) => i >= 0 && i < n);
  return { row, col, rows: around(row), cols: around(col) };
}

function pickGift(rng: () => number, board: Board): number | undefined {
  const filled = board.cells.flatMap((v, i) => (v !== 0 ? [i] : []));
  return filled.length > 0 ? filled[Math.floor(rng() * filled.length)] : undefined;
}

export function placePiece(state: GameState, slot: number, row: number, col: number): PlaceResult | null {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece.cells, row, col)) return null;

  const placed = place(state.board, piece.cells, row, col, piece.color);
  const full = findFullLines(placed);
  const n = lineCount(full);
  const gift = giftBlast(placed, state.gift, full);
  const cleared: Lines = gift
    ? {
        rows: [...new Set([...full.rows, ...gift.rows])].sort((a, b) => a - b),
        cols: [...new Set([...full.cols, ...gift.cols])].sort((a, b) => a - b),
      }
    : full;
  const board = n > 0 ? clearLines(placed, cleared) : placed;
  const perfectClear = n > 0 && isEmpty(board);
  const heart = heartRect(state.board, board, piece.cells.length);
  const base = scorePlacement(piece.cells.length, n, state.combo, perfectClear, state.banked ?? 0, heart !== null);
  const score = gift ? { ...base, total: base.total + balance.gift.bonus } : base;
  const nextGift = gift ? undefined : state.gift;

  let tray = state.tray.map((p, i) => (i === slot ? null : p));
  let rngState = state.rngState;
  let setColors = state.setColors;
  let chainSets = state.chainSets;
  const storms = state.storms ?? (state.stormed ? 1 : 0);
  const charge = n > 0 ? n * balance.storm.energyPerLine + (score.combo >= 2 ? balance.storm.energyPerCombo : 0) : 0;
  const energy = (state.energy ?? 0) + charge;
  const refilled = tray.every((p) => p === null);
  if (refilled) {
    const rng = createRng(rngState);
    const fresh =
      (chainSets && chainSet(rng.next, board, chainSets, setColors)) ||
      nextPieceSet(rng.next, board, state.score + score.total, setColors);
    chainSets = chainSets && chainSets > 1 ? chainSets - 1 : undefined;
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
    chainSets,
    stormed: undefined,
    storms,
    energy: Math.min(energy, stormNeedAt({ ...state, storms }, state.score + score.total)),
    gift: nextGift,
    queued: undefined,
    stats,
  };
  next.over = isOver(next);
  return { state: next, score, cleared, placed, refilled, heart, gift };
}

export function castStorm(state: GameState): StormResult | null {
  if (state.over || !stormEnergy(state).ready) return null;
  const rng = createRng(state.rngState ^ 0x5bd1e995);
  const filled = state.board.cells.some((v) => v !== 0);
  let board: Board | null = null;
  if (filled && rng.next() >= wipeChance(state.score)) {
    for (let attempt = 0; attempt < balance.storm.shuffleAttempts && !board; attempt++) {
      const shuffled = shuffleBoard(rng.next, state.board);
      if (hasMove(shuffled, state.tray)) board = shuffled;
    }
  }
  const wiped = board === null;
  const nextBoard = board ?? createBoard(state.board.size);
  const next: GameState = {
    ...state,
    board: nextBoard,
    storms: (state.storms ?? 0) + 1,
    energy: 0,
    gift: wiped ? undefined : pickGift(rng.next, nextBoard),
    rngState: (state.rngState + 1) >>> 0,
    over: false,
  };
  next.over = isOver(next);
  return { state: next, before: state.board, wiped };
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
  return !hasMove(state.board, state.tray) && rescueSlots(state).length === 0 && !stormEnergy(state).ready;
}

export function addRotations(current: number, amount: number): { rotations: number; added: number } {
  const rotations = Math.max(current, Math.min(balance.maxRotations, current + amount));
  return { rotations, added: rotations - current };
}
