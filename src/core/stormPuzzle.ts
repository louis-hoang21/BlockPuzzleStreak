import balance from '../../config/balance.json';
import { canPlace, createBoard, findFullLines, isEmpty, lineCount, place, type Board, type Lines } from './board';
import { hasMove } from './game';
import { paintSet, type Piece } from './pieceGenerator';
import { createRng } from './rng';
import { scorePlacement } from './scoreEngine';
import { ageWear, clearWithWear, presetWear, wearFor } from './spoil';
import { runSteps, stormBoardSteps } from './storm';

export interface PuzzleKey {
  day: string;
  level: number;
  variant: number;
}

export interface PuzzleState {
  day: string;
  level: number;
  variant: number;
  initial: number;
  board: Board;
  wear?: number[];
  tray: (Piece | null)[];
  queue: Piece[];
  total: number;
  placed: number;
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

export function newPuzzle(key: PuzzleKey): PuzzleState {
  return runSteps(puzzleSteps(key));
}

const keyOf = ({ day, level, variant }: PuzzleKey) => `${day}|${level}|${variant}`;

function* puzzleSteps({ day, level, variant }: PuzzleKey): Generator<void, PuzzleState> {
  const size = balance.traySize;
  const seed = (daySeed(day) + Math.imul(level, 104729) + Math.imul(variant, 15485863)) >>> 0;
  for (let attempt = 0; attempt < SEED_RETRIES; attempt++) {
    const rng = createRng(seed + attempt * 7919);
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
      level,
      variant,
      initial: plan.board.cells.filter((v) => v !== 0).length,
      board: plan.board,
      wear: presetWear(plan.board),
      tray: painted.slice(0, size),
      queue: painted.slice(size),
      total: painted.length,
      placed: 0,
      combo: 0,
      banked: 0,
      score: 0,
      over: false,
      won: false,
    };
  }
  throw new Error(`No puzzle for ${day} level ${level}`);
}

const cache = new Map<string, PuzzleState>();
const pending = new Map<string, Promise<PuzzleState>>();

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function keep(key: PuzzleKey, puzzle: PuzzleState): PuzzleState {
  for (const k of cache.keys()) if (!k.startsWith(`${key.day}|`)) cache.delete(k);
  cache.set(keyOf(key), puzzle);
  return puzzle;
}

export function cachedPuzzle(key: PuzzleKey): PuzzleState | null {
  return cache.get(keyOf(key)) ?? null;
}

export function puzzleFor(key: PuzzleKey): PuzzleState {
  return cachedPuzzle(key) ?? keep(key, newPuzzle(key));
}

export function loadPuzzle(key: PuzzleKey): Promise<PuzzleState> {
  const id = keyOf(key);
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(id);
  if (running) return running;
  const promise = (async () => {
    const steps = puzzleSteps(key);
    for (;;) {
      const done = cache.get(id);
      if (done) return done;
      const step = steps.next();
      if (step.done) return keep(key, step.value);
      await nextTick();
    }
  })();
  pending.set(id, promise);
  promise.finally(() => {
    if (pending.get(id) === promise) pending.delete(id);
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
  const won = count === state.total || isEmpty(board);
  const next: PuzzleState = {
    ...state,
    board,
    wear,
    tray,
    queue,
    placed: count,
    combo: score.combo,
    banked: score.banked,
    score: state.score + score.total,
    won,
    over: won || !hasMove(board, tray),
  };
  return { state: next, placed, cleared, cracked: after.cracked, lines, points: score.total };
}

export function remainingBlocks(state: PuzzleState): number {
  return state.board.cells.filter((v) => v !== 0).length;
}

export function clearedRatio(state: PuzzleState): number {
  if (state.initial <= 0) return 1;
  return Math.max(0, 1 - remainingBlocks(state) / state.initial);
}

export function puzzleStars(state: PuzzleState): number {
  const ratio = clearedRatio(state) + 1e-9;
  return balance.puzzle.stars.filter((need) => ratio >= need).length;
}

export function levelsForStreak(streak: number): number {
  const { levelEvery, maxLevels } = balance.puzzle;
  return Math.min(maxLevels, 1 + Math.floor(streak / levelEvery));
}

export function minutesForStreak(streak: number): number {
  const { atStreak, limit } = balance.puzzle.minutes;
  let value = limit[0];
  atStreak.forEach((at, i) => {
    if (streak >= at) value = limit[i];
  });
  return value;
}

export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + offset));
}
