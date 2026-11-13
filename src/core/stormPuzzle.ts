import balance from '../../config/balance.json';
import { canPlace, createBoard, findFullLines, isEmpty, lineCount, place, type Board, type Lines } from './board';
import { boltSet, boltStrike, giftBlast, hasMove, pickGift, placedBolt, type BoltStrike, type GiftBlast } from './game';
import { nextPieceSet, paintSet, type Piece } from './pieceGenerator';
import { createRng } from './rng';
import { scorePlacement } from './scoreEngine';
import { ageOf, ageWear, clearWithWear, presetWear, removeSpoiled, shieldWear, SPOIL_AT, spoiledBits, spoiledCells, wearFor } from './spoil';
import { runSteps, shuffleBoard, stormBoardSteps } from './storm';

export interface PuzzleKey {
  day: string;
  level: number;
  variant: number;
}

export interface PuzzleState {
  day: string;
  level: number;
  variant: number;
  seeds: number[];
  target: number;
  par: number;
  budget: number;
  burnChance?: number;
  mixChance?: number;
  rngState: number;
  gift?: number;
  bolt?: number;
  burn?: number;
  mix?: number;
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
  cured: number[];
  lines: number;
  points: number;
  gift?: GiftBlast;
  bolt?: BoltStrike;
  burned: number[];
  burnFrom?: number;
  mixed: Board | null;
}

type MarkKind = 'bolt' | 'burn' | 'mix';

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

export interface PuzzleTune {
  chain: readonly number[];
  extra: number;
  burn: number;
  mix: number;
  minutes: number;
  hard: boolean;
}

export const MAP_DAY = 'map';

export function mapKey(level: number): PuzzleKey {
  return { day: MAP_DAY, level, variant: 0 };
}

export function isHardLevel(level: number): boolean {
  const { every } = balance.puzzle.map.hard;
  return level > 0 && level % every === 0;
}

export function mapTune(level: number): PuzzleTune {
  const m = balance.puzzle.map;
  let k = 0;
  m.atLevel.forEach((at, i) => {
    if (level >= at) k = i;
  });
  if (isHardLevel(level)) {
    const { pieces, burn, mix } = m.hard;
    return { chain: [pieces, pieces], extra: 0, burn: Math.max(burn, m.burn[k]), mix: Math.max(mix, m.mix[k]), minutes: m.minutes[k], hard: true };
  }
  return { chain: m.chain[k], extra: m.extra[k], burn: m.burn[k], mix: m.mix[k], minutes: m.minutes[k], hard: false };
}

function tuneFor({ day, level }: PuzzleKey): Omit<PuzzleTune, 'minutes'> {
  if (day === MAP_DAY) return mapTune(level);
  const p = balance.puzzle;
  return { chain: p.chain, extra: p.extra.pieces[0], burn: p.burnChance, mix: p.mixChance, hard: false };
}

function solvesFully(start: PuzzleState, moves: readonly (readonly [number, number])[]): boolean {
  let state = start;
  for (let i = 0; i < moves.length; i++) {
    const [row, col] = moves[i];
    const result = placeInPuzzle(state, i % balance.traySize, row, col);
    if (!result) return false;
    state = result.state;
    if (state.won) return true;
  }
  return false;
}

export function newPuzzle(key: PuzzleKey): PuzzleState {
  return runSteps(puzzleSteps(key));
}

const keyOf = ({ day, level, variant }: PuzzleKey) => `${day}|${level}|${variant}`;

const CACHE_SIZE = 8;

function* puzzleSteps(key: PuzzleKey): Generator<void, PuzzleState> {
  const { day, level, variant } = key;
  const tune = tuneFor(key);
  const size = balance.traySize;
  const seed = (daySeed(day) + Math.imul(level, 104729) + Math.imul(variant, 15485863)) >>> 0;
  const retries = tune.hard ? balance.puzzle.map.hard.retries : SEED_RETRIES;
  let fallback: PuzzleState | null = null;
  let safe: PuzzleState | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const rng = createRng(seed + attempt * 7919);
    const [low, high] = tune.chain;
    const steps = low + Math.floor(rng.next() * (high - low + 1));
    const plan = yield* stormBoardSteps(rng.next, sampleBoard(rng.next), steps, tune.hard);
    if (!plan) continue;
    const painted: Piece[] = [];
    let avoid: number[] = [];
    for (let i = 0; i < plan.pieces.length; i += size) {
      const tray = paintSet(rng.next, plan.pieces.slice(i, i + size), avoid);
      avoid = tray.map((p) => p.color);
      painted.push(...tray);
    }
    const gift = pickGift(rng.next, plan.board);
    const bolt = rng.next() < balance.bolt.boardChance ? pickGift(rng.next, plan.board, gift) : undefined;
    const puzzle: PuzzleState = {
      day,
      level,
      variant,
      seeds: plan.board.cells.flatMap((v, i) => (v !== 0 ? [i] : [])),
      target: plan.board.cells.filter((v) => v !== 0).length,
      par: plan.pieces.length,
      budget: plan.pieces.length + tune.extra,
      burnChance: tune.burn,
      mixChance: tune.mix,
      rngState: rng.state(),
      gift,
      bolt,
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
    if (!tune.hard || solvesFully(puzzle, plan.moves)) return puzzle;
    const calm: PuzzleState = { ...puzzle, bolt: undefined, burnChance: 0, mixChance: 0 };
    if (solvesFully(calm, plan.moves)) safe ??= calm;
    fallback ??= puzzle;
    yield;
  }
  if (safe) return safe;
  if (fallback) return fallback;
  throw new Error(`No puzzle for ${day} level ${level}`);
}

const cache = new Map<string, PuzzleState>();
const pending = new Map<string, Promise<PuzzleState>>();

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function keep(key: PuzzleKey, puzzle: PuzzleState): PuzzleState {
  cache.delete(keyOf(key));
  cache.set(keyOf(key), puzzle);
  for (const k of cache.keys()) {
    if (cache.size <= CACHE_SIZE) break;
    cache.delete(k);
  }
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

function markCell(piece: Piece, index: number | undefined, n: number, row: number, col: number): number | undefined {
  const cell = index === undefined ? undefined : piece.cells[index];
  return cell ? (row + cell[0]) * n + col + cell[1] : undefined;
}

function hasMark(piece: Piece): boolean {
  return piece.bolt !== undefined || piece.burn !== undefined || piece.mix !== undefined || !!piece.age;
}

function markSet(rng: () => number, tray: readonly Piece[], kind: Exclude<MarkKind, 'bolt'>, chance: number, busy: boolean): Piece[] {
  const roll = rng();
  const slot = Math.floor(rng() * tray.length);
  const pick = rng();
  const target = tray[slot];
  if (busy || roll >= chance || !target || hasMark(target) || tray.some((p) => p[kind] !== undefined)) return tray.slice();
  return tray.map((p, i) => (i === slot ? { ...p, [kind]: Math.floor(pick * p.cells.length) } : p));
}

function lineCells(n: number, lines: { rows: number[]; cols: number[] }): number[] {
  const out = new Set<number>();
  for (const r of lines.rows) for (let c = 0; c < n; c++) out.add(r * n + c);
  for (const c of lines.cols) for (let r = 0; r < n; r++) out.add(r * n + c);
  return [...out];
}

function alive(board: Board, at: number | undefined): number | undefined {
  return at !== undefined && board.cells[at] !== 0 ? at : undefined;
}

export function placeInPuzzle(state: PuzzleState, slot: number, row: number, col: number): PuzzleResult | null {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece.cells, row, col)) return null;
  const n = state.board.size;
  const placed = place(state.board, piece.cells, row, col, piece.color);
  const full = findFullLines(placed);
  const lines = lineCount(full);
  const gift = giftBlast(placed, state.gift, full);
  const blasted: Lines = gift ? mergeLines(full, gift) : full;
  const boltAt = placedBolt(piece, n, row, col) ?? state.bolt;
  const bolt = boltStrike(placed, boltAt, blasted);
  const cleared: Lines = bolt ? mergeLines(blasted, bolt) : blasted;
  const burnAt = markCell(piece, piece.burn, n, row, col) ?? state.burn;
  const mixAt = markCell(piece, piece.mix, n, row, col) ?? state.mix;
  const burnHit = boltStrike(placed, burnAt, cleared);
  const mixHit = boltStrike(placed, mixAt, cleared);
  const fate = createRng((state.rngState ^ 0x2c1b3c6d ^ Math.imul(state.placed + 1, 0x9e3779b1)) >>> 0);
  let shielded = state.wear ? wearFor(state.board, state.wear) : presetWear(state.board);
  for (const at of [boltAt, burnAt, mixAt]) shielded = shieldWear(shielded, at);
  const cleaned =
    lines > 0 ? clearWithWear(placed, shielded, cleared, state.combo >= 1 || bolt !== undefined) : { board: placed, wear: shielded, cracked: [] };
  const cured = gift && fate.next() < balance.gift.cureChance ? spoiledCells(cleaned.board, cleaned.wear) : [];
  const after = cured.length > 0 ? { ...removeSpoiled(cleaned.board, cleaned.wear), cracked: [] } : cleaned;
  let board = after.board;
  let seeds = state.seeds.filter((i) => board.cells[i] !== 0);
  let wear = ageWear(board, after.wear, piece.cells, row, col);
  const base = scorePlacement(piece.cells.length, lines, state.combo, lines > 0 && isEmpty(board), state.banked);
  const bonus = (gift ? balance.gift.bonus : 0) + (bolt ? balance.bolt.bonus : 0);
  let nextGift = gift ? undefined : alive(board, state.gift);
  let nextBolt = bolt ? undefined : alive(board, boltAt);
  let nextBurn = burnHit ? undefined : alive(board, burnAt);
  let nextMix = mixHit ? undefined : alive(board, mixAt);

  const burned: number[] = [];
  if (burnHit) {
    const safe = new Set([nextGift, nextBolt, nextMix]);
    for (const i of lineCells(n, burnHit)) {
      if (board.cells[i] === 0 || safe.has(i) || ageOf(wear[i]) >= SPOIL_AT) continue;
      wear[i] = SPOIL_AT;
      burned.push(i);
    }
  }

  let tray = state.tray.map((p, i) => (i === slot ? null : p));
  let mixed: Board | null = null;
  if (mixHit && !isEmpty(board)) {
    const left = tray.filter((p): p is Piece => p !== null);
    for (let attempt = 0; attempt < balance.storm.shuffleAttempts && !mixed; attempt++) {
      const candidate = shuffleBoard(fate.next, board, wear);
      if (left.length > 0 && !hasMove(candidate.board, left)) continue;
      mixed = board;
      const moveTo = (at: number | undefined) => {
        const to = at === undefined ? -1 : candidate.source.indexOf(at);
        return to >= 0 ? to : undefined;
      };
      nextGift = moveTo(nextGift);
      nextBolt = moveTo(nextBolt);
      nextBurn = moveTo(nextBurn);
      nextMix = moveTo(nextMix);
      seeds = seeds.flatMap((i) => {
        const to = moveTo(i);
        return to === undefined ? [] : [to];
      });
      board = candidate.board;
      wear = candidate.wear;
    }
  }

  let queue = state.queue;
  let rngState = state.rngState;
  const placedCount = state.placed + 1;
  const left = Math.max(0, state.budget - placedCount);
  if (tray.every((p) => p === null) && left > 0 && seeds.length > 0) {
    const rng = createRng(rngState);
    let fresh: Piece[];
    if (queue.length > 0) {
      fresh = queue.slice(0, balance.traySize);
      queue = queue.slice(balance.traySize);
    } else {
      fresh = nextPieceSet(rng.next, board, 0, [piece.color], spoiledBits(wear));
    }
    fresh = fresh.slice(0, left);
    const withBolt = boltSet(rng.next, fresh, nextBolt !== undefined);
    const withBurn = markSet(rng.next, withBolt, 'burn', state.burnChance ?? balance.puzzle.burnChance, nextBurn !== undefined);
    const dealt = markSet(rng.next, withBurn, 'mix', state.mixChance ?? balance.puzzle.mixChance, nextMix !== undefined);
    tray = Array.from({ length: balance.traySize }, (_, i) => dealt[i] ?? null);
    rngState = rng.state();
  }
  const won = seeds.length === 0;
  const next: PuzzleState = {
    ...state,
    rngState,
    board,
    wear,
    tray,
    queue,
    gift: nextGift,
    bolt: nextBolt,
    burn: nextBurn,
    mix: nextMix,
    seeds,
    placed: placedCount,
    combo: base.combo,
    banked: base.banked,
    score: state.score + base.total + bonus,
    won,
    over: won || left === 0 || !hasMove(board, tray),
  };
  return {
    state: next,
    placed,
    cleared,
    cracked: after.cracked,
    cured,
    lines,
    points: base.total + bonus,
    gift,
    bolt,
    burned,
    burnFrom: burned.length > 0 ? burnAt : undefined,
    mixed,
  };
}

function mergeLines(a: Lines, b: { rows: number[]; cols: number[] }): Lines {
  return {
    rows: [...new Set([...a.rows, ...b.rows])].sort((x, y) => x - y),
    cols: [...new Set([...a.cols, ...b.cols])].sort((x, y) => x - y),
  };
}

export function withBudget(state: PuzzleState, extra: number): PuzzleState {
  return { ...state, budget: state.par + extra };
}

export function piecesLeft(state: PuzzleState): number {
  return Math.max(0, state.budget - state.placed);
}

export const STAR_MARKS: readonly number[] = balance.puzzle.starsCleared;

export function clearedShare(state: PuzzleState): number {
  return state.target > 0 ? (state.target - state.seeds.length) / state.target : 1;
}

export function clearedPercent(state: PuzzleState): number {
  return Math.floor(clearedShare(state) * 100 + 1e-6);
}

export function starsFor(state: PuzzleState): number {
  const share = clearedShare(state) + 1e-6;
  return STAR_MARKS.filter((mark) => share >= mark).length;
}

export function puzzleStars(state: PuzzleState): number {
  return starsFor(state);
}

export function levelsForStreak(streak: number): number {
  const { levelEvery, maxLevels } = balance.puzzle;
  return Math.min(maxLevels, 1 + Math.floor(streak / levelEvery));
}

function byStreak(streak: number, atStreak: readonly number[], values: readonly number[]): number {
  let value = values[0];
  atStreak.forEach((at, i) => {
    if (streak >= at) value = values[i];
  });
  return value;
}

export function minutesForStreak(streak: number): number {
  const { atStreak, limit } = balance.puzzle.minutes;
  return byStreak(streak, atStreak, limit);
}

export function extraForStreak(streak: number): number {
  const { atStreak, pieces } = balance.puzzle.extra;
  return byStreak(streak, atStreak, pieces);
}

export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + offset));
}
