import cfg from '../../../config/classic.json';
import { createRng } from '../rng';
import { shuffledBag } from './bag';
import { clearPoints, gravityMs, levelFor } from './scoring';
import { shapeBox, shapeCells, shapeColor, type ClassicShape } from './shapes';

export interface ActivePiece {
  shape: ClassicShape;
  rot: number;
  row: number;
  col: number;
}

export interface ClassicStats {
  pieces: number;
  linesCleared: number;
  maxCombo: number;
  maxLinesAtOnce: number;
  perfectClears: number;
}

export interface ClassicState {
  cols: number;
  rows: number;
  hidden: number;
  cells: number[];
  active: ActivePiece | null;
  queue: ClassicShape[];
  bag: ClassicShape[];
  hold: ClassicShape | null;
  holdUsed: boolean;
  score: number;
  level: number;
  lines: number;
  combo: number;
  fallMs: number;
  lockMs: number;
  lockResets: number;
  rngState: number;
  seed: number;
  stats: ClassicStats;
  over: boolean;
}

export interface ClearedCell {
  row: number;
  col: number;
  color: number;
}

export type ClassicEvent =
  | { type: 'lock' }
  | { type: 'hardDrop'; distance: number }
  | {
      type: 'clear';
      rows: number[];
      cells: ClearedCell[];
      lines: number;
      combo: number;
      points: number;
      perfect: boolean;
    }
  | { type: 'levelUp'; level: number }
  | { type: 'over' };

export interface Step {
  state: ClassicState;
  events: ClassicEvent[];
}

const KICKS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [0, -2],
  [0, 2],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

export function pieceCells(piece: ActivePiece): [number, number][] {
  return shapeCells(piece.shape, piece.rot).map(([r, c]) => [piece.row + r, piece.col + c]);
}

function fits(state: ClassicState, piece: ActivePiece): boolean {
  for (const [r, c] of pieceCells(piece)) {
    if (c < 0 || c >= state.cols || r >= state.rows) return false;
    if (r >= 0 && state.cells[r * state.cols + c] !== 0) return false;
  }
  return true;
}

function grounded(state: ClassicState, piece: ActivePiece): boolean {
  return !fits(state, { ...piece, row: piece.row + 1 });
}

function refill(state: ClassicState): ClassicState {
  let { queue, bag, rngState } = state;
  if (queue.length > cfg.preview) return state;
  queue = [...queue];
  bag = [...bag];
  const rng = createRng(rngState);
  while (queue.length <= cfg.preview) {
    if (bag.length === 0) bag = shuffledBag(rng.next);
    queue.push(bag.shift()!);
  }
  rngState = rng.state();
  return { ...state, queue, bag, rngState };
}

function spawnPiece(shape: ClassicShape, cols: number, hidden: number): ActivePiece {
  const box = shapeBox(shape);
  const top = Math.min(...shapeCells(shape, 0).map(([r]) => r));
  return { shape, rot: 0, row: hidden - top, col: Math.floor((cols - box) / 2) };
}

function spawn(state: ClassicState, shape?: ClassicShape): Step {
  let next = state;
  let id = shape;
  if (!id) {
    next = refill(next);
    id = next.queue[0];
    next = refill({ ...next, queue: next.queue.slice(1) });
  }
  const active = spawnPiece(id, next.cols, next.hidden);
  next = { ...next, active, fallMs: 0, lockMs: 0, lockResets: 0 };
  if (!fits(next, active)) return { state: { ...next, over: true }, events: [{ type: 'over' }] };
  return { state: next, events: [] };
}

export function newClassic(seed: number): ClassicState {
  const cols = cfg.cols;
  const rows = cfg.rows + cfg.hiddenRows;
  const base: ClassicState = {
    cols,
    rows,
    hidden: cfg.hiddenRows,
    cells: new Array<number>(cols * rows).fill(0),
    active: null,
    queue: [],
    bag: [],
    hold: null,
    holdUsed: false,
    score: 0,
    level: 1,
    lines: 0,
    combo: 0,
    fallMs: 0,
    lockMs: 0,
    lockResets: 0,
    rngState: seed >>> 0,
    seed,
    stats: { pieces: 0, linesCleared: 0, maxCombo: 0, maxLinesAtOnce: 0, perfectClears: 0 },
    over: false,
  };
  return spawn(base).state;
}

function afterShift(state: ClassicState, piece: ActivePiece): ClassicState {
  const onGround = grounded(state, piece);
  if (onGround && state.lockResets < cfg.maxLockResets) {
    return { ...state, active: piece, lockMs: 0, lockResets: state.lockResets + 1 };
  }
  return { ...state, active: piece };
}

export function move(state: ClassicState, dx: number): ClassicState {
  if (state.over || !state.active) return state;
  const piece = { ...state.active, col: state.active.col + dx };
  return fits(state, piece) ? afterShift(state, piece) : state;
}

export function rotate(state: ClassicState, dir = 1): ClassicState {
  if (state.over || !state.active || state.active.shape === 'square') return state;
  const turned = { ...state.active, rot: (state.active.rot + dir + 4) % 4 };
  for (const [dr, dc] of KICKS) {
    const piece = { ...turned, row: turned.row + dr, col: turned.col + dc };
    if (fits(state, piece)) return afterShift(state, piece);
  }
  return state;
}

export function dropDistance(state: ClassicState): number {
  if (!state.active) return 0;
  let d = 0;
  while (fits(state, { ...state.active, row: state.active.row + d + 1 })) d++;
  return d;
}

function lock(state: ClassicState): Step {
  const piece = state.active!;
  const cols = state.cols;
  const cells = state.cells.slice();
  const color = shapeColor(piece.shape) + 1;
  const placed = pieceCells(piece);
  for (const [r, c] of placed) if (r >= 0) cells[r * cols + c] = color;
  const events: ClassicEvent[] = [{ type: 'lock' }];

  const full: number[] = [];
  for (let r = 0; r < state.rows; r++) {
    let isFull = true;
    for (let c = 0; c < cols; c++) if (cells[r * cols + c] === 0) isFull = false;
    if (isFull) full.push(r);
  }

  let next: ClassicState = {
    ...state,
    cells,
    active: null,
    holdUsed: false,
    stats: { ...state.stats, pieces: state.stats.pieces + 1 },
  };

  if (full.length > 0) {
    const cleared: ClearedCell[] = [];
    for (const r of full)
      for (let c = 0; c < cols; c++) cleared.push({ row: r, col: c, color: cells[r * cols + c] - 1 });
    const kept: number[] = [];
    for (let r = 0; r < state.rows; r++) if (!full.includes(r)) kept.push(...cells.slice(r * cols, (r + 1) * cols));
    const nextCells = new Array<number>(full.length * cols).fill(0).concat(kept);
    const perfect = nextCells.every((v) => v === 0);
    const combo = state.combo + 1;
    const lines = state.lines + full.length;
    const level = levelFor(lines);
    const points = clearPoints(full.length, combo, state.level, perfect);
    next = {
      ...next,
      cells: nextCells,
      combo,
      lines,
      level,
      score: next.score + points,
      stats: {
        ...next.stats,
        linesCleared: next.stats.linesCleared + full.length,
        maxCombo: Math.max(next.stats.maxCombo, combo),
        maxLinesAtOnce: Math.max(next.stats.maxLinesAtOnce, full.length),
        perfectClears: next.stats.perfectClears + (perfect ? 1 : 0),
      },
    };
    events.push({ type: 'clear', rows: full, cells: cleared, lines: full.length, combo, points, perfect });
    if (level > state.level) events.push({ type: 'levelUp', level });
  } else {
    next = { ...next, combo: 0 };
  }

  const lockedOut = placed.every(([r]) => r < state.hidden);
  if (lockedOut) return { state: { ...next, over: true }, events: [...events, { type: 'over' }] };
  const spawned = spawn(next);
  return { state: spawned.state, events: [...events, ...spawned.events] };
}

export function hardDrop(state: ClassicState): Step {
  if (state.over || !state.active) return { state, events: [] };
  const distance = dropDistance(state);
  const dropped = {
    ...state,
    active: { ...state.active, row: state.active.row + distance },
    score: state.score + distance * cfg.points.hardDrop,
  };
  const step = lock(dropped);
  return { state: step.state, events: [{ type: 'hardDrop', distance }, ...step.events] };
}

export function hold(state: ClassicState): Step {
  if (state.over || !state.active || state.holdUsed) return { state, events: [] };
  const current = state.active.shape;
  const step = spawn({ ...state, hold: current }, state.hold ?? undefined);
  return { state: { ...step.state, holdUsed: true }, events: step.events };
}

export function tick(state: ClassicState, dtMs: number, softDrop: boolean): Step {
  if (state.over || !state.active) return { state, events: [] };
  const interval = softDrop ? Math.min(cfg.softDropMs, gravityMs(state.level)) : gravityMs(state.level);
  let next = state;
  let fallMs = state.fallMs + dtMs;
  let active = state.active;
  let score = state.score;
  while (fallMs >= interval) {
    const down = { ...active, row: active.row + 1 };
    if (!fits(next, down)) {
      fallMs = 0;
      break;
    }
    active = down;
    fallMs -= interval;
    if (softDrop) score += cfg.points.softDrop;
    next = { ...next, lockMs: 0 };
  }
  next = { ...next, active, fallMs, score };
  if (grounded(next, active)) {
    const lockMs = next.lockMs + dtMs;
    if (lockMs >= cfg.lockDelayMs) return lock(next);
    next = { ...next, lockMs };
  }
  return { state: next, events: [] };
}

export function ghostRow(state: ClassicState): number {
  return state.active ? state.active.row + dropDistance(state) : 0;
}
