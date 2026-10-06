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
  queueGifts?: number[];
  activeGift?: number;
  holdGift?: number;
  gift?: number;
  giftChance?: number;
  queueBolts?: number[];
  activeBolt?: number;
  holdBolt?: number;
  bolt?: number;
  boltChance?: number;
  rushMs?: number;
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
      before: number[];
      lines: number;
      combo: number;
      points: number;
      perfect: boolean;
      storm?: GiftStorm;
      bolt: boolean;
    }
  | { type: 'gift' }
  | { type: 'bolt' }
  | { type: 'levelUp'; level: number }
  | { type: 'over' };

export interface GiftStorm {
  row: number;
  col: number;
  rows: number[];
  cols: number[];
}

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

const NO_GIFT = -1;

function queueGiftsOf(state: ClassicState): number[] {
  return state.queueGifts ?? state.queue.map(() => NO_GIFT);
}

function queueBoltsOf(state: ClassicState): number[] {
  return state.queueBolts ?? state.queue.map(() => NO_GIFT);
}

function hasBolt(state: ClassicState, queueBolts: readonly number[]): boolean {
  return (
    (state.bolt ?? NO_GIFT) >= 0 ||
    (state.activeBolt ?? NO_GIFT) >= 0 ||
    (state.holdBolt ?? NO_GIFT) >= 0 ||
    queueBolts.some((b) => b >= 0)
  );
}

function hasGift(state: ClassicState, queueGifts: readonly number[]): boolean {
  return (
    (state.gift ?? NO_GIFT) >= 0 ||
    (state.activeGift ?? NO_GIFT) >= 0 ||
    (state.holdGift ?? NO_GIFT) >= 0 ||
    queueGifts.some((g) => g >= 0)
  );
}

function refill(state: ClassicState): ClassicState {
  let { queue, bag, rngState } = state;
  if (queue.length > cfg.preview) return state;
  queue = [...queue];
  bag = [...bag];
  const queueGifts = [...queueGiftsOf(state)];
  const queueBolts = [...queueBoltsOf(state)];
  const rng = createRng(rngState);
  while (queue.length <= cfg.preview) {
    if (bag.length === 0) bag = shuffledBag(rng.next);
    const shape = bag.shift()!;
    queue.push(shape);
    const giftable = !hasGift(state, queueGifts) && rng.next() < (state.giftChance ?? cfg.gift.chance);
    queueGifts.push(giftable ? Math.floor(rng.next() * shapeCells(shape, 0).length) : NO_GIFT);
    const boltable =
      !giftable && !hasBolt(state, queueBolts) && rng.next() < (state.boltChance ?? cfg.bolt.chance);
    queueBolts.push(boltable ? Math.floor(rng.next() * shapeCells(shape, 0).length) : NO_GIFT);
  }
  rngState = rng.state();
  return { ...state, queue, bag, queueGifts, queueBolts, rngState };
}

function spawnPiece(shape: ClassicShape, cols: number, hidden: number): ActivePiece {
  const box = shapeBox(shape);
  const top = Math.min(...shapeCells(shape, 0).map(([r]) => r));
  return { shape, rot: 0, row: hidden - top, col: Math.floor((cols - box) / 2) };
}

function spawn(state: ClassicState, shape?: ClassicShape, gift = NO_GIFT, bolt = NO_GIFT): Step {
  let next = state;
  let id = shape;
  let activeGift = gift;
  let activeBolt = bolt;
  if (!id) {
    next = refill(next);
    id = next.queue[0];
    const gifts = queueGiftsOf(next);
    const bolts = queueBoltsOf(next);
    activeGift = gifts[0] ?? NO_GIFT;
    activeBolt = bolts[0] ?? NO_GIFT;
    next = refill({
      ...next,
      queue: next.queue.slice(1),
      queueGifts: gifts.slice(1),
      queueBolts: bolts.slice(1),
      activeGift,
      activeBolt,
    });
  }
  const active = spawnPiece(id, next.cols, next.hidden);
  next = { ...next, active, activeGift, activeBolt, fallMs: 0, lockMs: 0, lockResets: 0 };
  if (!fits(next, active)) return { state: { ...next, over: true }, events: [{ type: 'over' }] };
  return { state: next, events: [] };
}

export function newClassic(
  seed: number,
  giftChance: number = cfg.gift.chance,
  boltChance: number = cfg.bolt.chance,
): ClassicState {
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
    giftChance,
    boltChance,
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

function dropDistance(state: ClassicState): number {
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

  let gift = state.gift ?? NO_GIFT;
  const activeGift = state.activeGift ?? NO_GIFT;
  if (activeGift >= 0) {
    const [gr, gc] = placed[activeGift] ?? [-1, -1];
    gift = gr >= 0 ? gr * cols + gc : NO_GIFT;
  }
  let bolt = state.bolt ?? NO_GIFT;
  const activeBolt = state.activeBolt ?? NO_GIFT;
  if (activeBolt >= 0) {
    const [br, bc] = placed[activeBolt] ?? [-1, -1];
    bolt = br >= 0 ? br * cols + bc : NO_GIFT;
  }

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
    activeGift: NO_GIFT,
    gift,
    activeBolt: NO_GIFT,
    bolt,
    holdUsed: false,
    stats: { ...state.stats, pieces: state.stats.pieces + 1 },
  };

  if (full.length > 0) {
    const giftRow = gift >= 0 ? Math.floor(gift / cols) : -1;
    let storm: GiftStorm | undefined;
    let removed = full;
    const swept = new Set<number>();
    if (giftRow >= 0 && full.includes(giftRow)) {
      const giftCol = gift % cols;
      const rows = [giftRow - 1, giftRow, giftRow + 1].filter((r) => r >= 0 && r < state.rows);
      const sweptCols = [giftCol - 1, giftCol, giftCol + 1].filter((c) => c >= 0 && c < cols);
      storm = { row: giftRow, col: giftCol, rows, cols: sweptCols };
      removed = [...new Set([...full, ...rows])].sort((a, b) => a - b);
      for (const c of sweptCols) for (let r = 0; r < state.rows; r++) swept.add(r * cols + c);
    }
    const cleared: ClearedCell[] = [];
    const seen = new Set<number>();
    const take = (i: number) => {
      if (seen.has(i) || cells[i] === 0) return;
      seen.add(i);
      cleared.push({ row: Math.floor(i / cols), col: i % cols, color: cells[i] - 1 });
    };
    for (const r of removed) for (let c = 0; c < cols; c++) take(r * cols + c);
    for (const i of swept) take(i);
    const sweptCells = cells.map((v, i) => (swept.has(i) ? 0 : v));
    const kept: number[] = [];
    for (let r = 0; r < state.rows; r++) if (!removed.includes(r)) kept.push(...sweptCells.slice(r * cols, (r + 1) * cols));
    const nextCells = new Array<number>(removed.length * cols).fill(0).concat(kept);
    if (storm) gift = NO_GIFT;
    else if (giftRow >= 0) gift = (giftRow + removed.filter((r) => r > giftRow).length) * cols + (gift % cols);
    const boltRow = bolt >= 0 ? Math.floor(bolt / cols) : -1;
    const struck = boltRow >= 0 && (removed.includes(boltRow) || swept.has(bolt));
    if (struck) bolt = NO_GIFT;
    else if (boltRow >= 0) bolt = (boltRow + removed.filter((r) => r > boltRow).length) * cols + (bolt % cols);
    const perfect = nextCells.every((v) => v === 0);
    const combo = state.combo + 1;
    const lines = state.lines + removed.length;
    const level = levelFor(lines);
    const points = clearPoints(removed.length, combo, state.level, perfect) + (storm ? cfg.gift.bonus * state.level : 0);
    next = {
      ...next,
      cells: nextCells,
      gift,
      bolt,
      rushMs: struck ? cfg.bolt.durationMs : next.rushMs,
      combo,
      lines,
      level,
      score: next.score + points,
      stats: {
        ...next.stats,
        linesCleared: next.stats.linesCleared + removed.length,
        maxCombo: Math.max(next.stats.maxCombo, combo),
        maxLinesAtOnce: Math.max(next.stats.maxLinesAtOnce, removed.length),
        perfectClears: next.stats.perfectClears + (perfect ? 1 : 0),
      },
    };
    events.push({
      type: 'clear',
      rows: removed,
      cells: cleared,
      before: cells,
      lines: removed.length,
      combo,
      points,
      perfect,
      storm,
      bolt: struck,
    });
    if (level > state.level) events.push({ type: 'levelUp', level });
  } else {
    next = { ...next, combo: 0 };
  }

  const lockedOut = placed.every(([r]) => r < state.hidden);
  if (lockedOut) return { state: { ...next, over: true }, events: [...events, { type: 'over' }] };
  const hadGift = queueGiftsOf(next).some((g) => g >= 0);
  const hadBolt = queueBoltsOf(next).some((b) => b >= 0);
  const spawned = spawn(next);
  const giftAppeared = !hadGift && queueGiftsOf(spawned.state).some((g) => g >= 0);
  const boltAppeared = !hadBolt && queueBoltsOf(spawned.state).some((b) => b >= 0);
  return {
    state: spawned.state,
    events: [
      ...events,
      ...(giftAppeared ? [{ type: 'gift' } as const] : []),
      ...(boltAppeared ? [{ type: 'bolt' } as const] : []),
      ...spawned.events,
    ],
  };
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
  const currentGift = state.activeGift ?? NO_GIFT;
  const currentBolt = state.activeBolt ?? NO_GIFT;
  const step = spawn(
    { ...state, hold: current, holdGift: currentGift, holdBolt: currentBolt },
    state.hold ?? undefined,
    state.hold ? (state.holdGift ?? NO_GIFT) : NO_GIFT,
    state.hold ? (state.holdBolt ?? NO_GIFT) : NO_GIFT,
  );
  return { state: { ...step.state, holdUsed: true }, events: step.events };
}

export function rushSpeed(rushMs: number): number {
  if (rushMs <= 0) return 1;
  const { peakSpeed, rampInMs, rampOutMs, durationMs } = cfg.bolt;
  const elapsed = durationMs - rushMs;
  const k = Math.min(1, elapsed / rampInMs, rushMs / rampOutMs);
  return 1 + (peakSpeed - 1) * Math.max(0, k);
}

export function tick(state: ClassicState, dtMs: number, softDrop: boolean): Step {
  if (state.over || !state.active) return { state, events: [] };
  const rushMs = state.rushMs ?? 0;
  const gravity = Math.max(1, Math.round(gravityMs(state.level) / rushSpeed(rushMs)));
  const interval = softDrop ? Math.min(cfg.softDropMs, gravity) : gravity;
  let next: ClassicState = rushMs > 0 ? { ...state, rushMs: Math.max(0, rushMs - dtMs) } : state;
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
