import balance from '../../config/balance.json';
import { canPlace, createBoard, findFullLines, isEmpty, lineCount, place, type Board, type Lines } from './board';
import { hasMove } from './game';
import { paintSet, type Piece } from './pieceGenerator';
import { createRng } from './rng';
import { scorePlacement } from './scoreEngine';
import { ageWear, clearWithWear, presetWear, wearFor } from './spoil';
import { runSteps, stormBoardSteps } from './storm';

export interface PuzzleState {
  day: string;
  board: Board;
  wear?: number[];
  tray: (Piece | null)[];
  queue: Piece[];
  total: number;
  placed: number;
  chained: number;
  combo: number;
  banked: number;
  score: number;
  over: boolean;
  won: boolean;
}

export interface PuzzleResult {
  state: PuzzleState;
  placed: Board;
  cleared: Lines;
  cracked: number[];
  lines: number;
  points: number;
}

const SEED_CELLS = 30;
const SEED_RETRIES = 8;

export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daySeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sampleBoard(rng: () => number): Board {
  const n = balance.gridSize;
  const cells = createBoard(n).cells.slice();
  for (let k = 0; k < SEED_CELLS; k++) cells[Math.floor(rng() * n * n)] = 1 + Math.floor(rng() * balance.pieceColors);
  return { size: n, cells };
}

export function newPuzzle(day: string): PuzzleState {
  return runSteps(puzzleSteps(day));
}

function* puzzleSteps(day: string): Generator<void, PuzzleState> {
  const size = balance.traySize;
  for (let attempt = 0; attempt < SEED_RETRIES; attempt++) {
    const rng = createRng(daySeed(day) + attempt * 7919);
    const plan = yield* stormBoardSteps(rng.next, sampleBoard(rng.next));
    if (!plan) continue;
    const painted: Piece[] = [];
    let avoid: number[] = [];
    for (let i = 0; i < plan.pieces.length; i += size) {
      const tray = paintSet(rng.next, plan.pieces.slice(i, i + size), avoid);
      avoid = tray.map((p) => p.color);
      painted.push(...tray);
    }
    return {
      day,
      board: plan.board,
      wear: presetWear(plan.board),
      tray: painted.slice(0, size),
      queue: painted.slice(size),
      total: painted.length,
      placed: 0,
      chained: 0,
      combo: 0,
      banked: 0,
      score: 0,
      over: false,
      won: false,
    };
  }
  throw new Error(`No storm puzzle for ${day}`);
}

let daily: { day: string; puzzle: PuzzleState } | null = null;
let pending: { day: string; promise: Promise<PuzzleState> } | null = null;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function keep(day: string, puzzle: PuzzleState): PuzzleState {
  daily = { day, puzzle };
  return puzzle;
}

export function dailyPuzzle(day: string): PuzzleState {
  if (daily?.day === day) return daily.puzzle;
  return keep(day, newPuzzle(day));
}

export function loadDailyPuzzle(day: string): Promise<PuzzleState> {
  if (daily?.day === day) return Promise.resolve(daily.puzzle);
  if (pending?.day === day) return pending.promise;
  const promise = (async () => {
    const steps = puzzleSteps(day);
    for (;;) {
      if (daily?.day === day) return daily.puzzle;
      const step = steps.next();
      if (step.done) return keep(day, step.value);
      await nextTick();
    }
  })();
  pending = { day, promise };
  promise.finally(() => {
    if (pending?.promise === promise) pending = null;
  });
  return promise;
}

export function placeInPuzzle(state: PuzzleState, slot: number, row: number, col: number): PuzzleResult | null {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece.cells, row, col)) return null;
  const placed = place(state.board, piece.cells, row, col, piece.color);
  const cleared = findFullLines(placed);
  const lines = lineCount(cleared);
  const before = state.wear ? wearFor(state.board, state.wear) : presetWear(state.board);
  const after = lines > 0 ? clearWithWear(placed, before, cleared, state.combo >= 1) : { board: placed, wear: before, cracked: [] };
  const board = after.board;
  const wear = ageWear(board, after.wear, piece.cells, row, col);
  const score = scorePlacement(piece.cells.length, lines, state.combo, lines > 0 && isEmpty(board), state.banked);

  let tray = state.tray.map((p, i) => (i === slot ? null : p));
  let queue = state.queue;
  if (tray.every((p) => p === null) && queue.length > 0) {
    tray = queue.slice(0, balance.traySize);
    queue = queue.slice(balance.traySize);
  }
  const count = state.placed + 1;
  const won = count === state.total;
  const next: PuzzleState = {
    ...state,
    board,
    wear,
    tray,
    queue,
    placed: count,
    chained: state.chained + (lines > 0 ? 1 : 0),
    combo: score.combo,
    banked: score.banked,
    score: state.score + score.total,
    won,
    over: won || !hasMove(board, tray),
  };
  return { state: next, placed, cleared, cracked: after.cracked, lines, points: score.total };
}

export function puzzleStars(state: PuzzleState): number {
  if (!state.won) return 0;
  if (state.chained === state.total) return 3;
  if (state.chained >= state.total - 3) return 2;
  return 1;
}
