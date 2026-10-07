import balance from '../../config/balance.json';
import { boardBits, placeAndClear, placements as spotsFor, type Bits } from './bitboard';
import { canPlace, type Board } from './board';
import { rotateTimes, sameShape, shapeById, SHAPES, type Shape, type Tier } from './pieces';
import type { Rng } from './rng';

export interface Piece {
  shapeId: string;
  color: number;
  cells: Shape;
  age?: number;
  aged?: number[];
  bolt?: number;
}

function difficultyAt(score: number): number {
  const { grace, scale, capScore } = balance.difficulty;
  return 1 - Math.exp(-Math.max(0, Math.min(score, capScore) - grace) / scale);
}

function tierWeight(tier: Tier, t: number): number {
  const { easy, hard } = balance.difficulty;
  return easy[tier] + (hard[tier] - easy[tier]) * t;
}

const SHAPE_SCALE: Record<string, number[] | undefined> = balance.shapeScale.shapes;

function shapeScale(id: string, score: number): number {
  const scale = SHAPE_SCALE[id];
  if (!scale) return 1;
  const at = balance.shapeScale.atScore;
  if (score <= at[0]) return scale[0];
  for (let i = 1; i < at.length; i++) {
    if (score <= at[i]) return scale[i - 1] + ((scale[i] - scale[i - 1]) * (score - at[i - 1])) / (at[i] - at[i - 1]);
  }
  return scale[scale.length - 1];
}

function shapeWeights(score: number): number[] {
  const t = difficultyAt(score);
  const tierTotals: Record<Tier, number> = { basic: 0, small: 0, medium: 0, large: 0, long: 0 };
  for (const s of SHAPES) tierTotals[s.tier] += s.weight ?? 1;
  return SHAPES.map((s) => ((tierWeight(s.tier, t) * (s.weight ?? 1)) / tierTotals[s.tier]) * shapeScale(s.id, score));
}

export function randomPiece(rng: Rng, score: number): Piece {
  const weights = shapeWeights(score);
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng() * total;
  let def = SHAPES[SHAPES.length - 1];
  for (let i = 0; i < SHAPES.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      def = SHAPES[i];
      break;
    }
  }
  const turns = Math.floor(rng() * 4);
  return { shapeId: def.id, color: 0, cells: rotateTimes(def.cells, turns) };
}

const NO_BITS: Bits = { lo: 0, hi: 0 };

function canPlaceAll(board: Board, pieces: readonly Piece[], spoiled: Bits = NO_BITS): boolean {
  const n = board.size;
  let budget = balance.solvableSearchBudget;
  const options = pieces.map((p) => spotsFor(p.cells, n));
  const search = (lo: number, hi: number, slo: number, shi: number, left: number[]): boolean => {
    if (left.length === 0) return true;
    for (let i = 0; i < left.length; i++) {
      const rest = left.filter((_, k) => k !== i);
      for (const spot of options[left[i]]) {
        if ((lo & spot.lo) !== 0 || (hi & spot.hi) !== 0) continue;
        if (--budget <= 0) return true;
        const next = placeAndClear(lo, hi, spot, n);
        const keepLo = (lo | spot.lo) & ~next.lo & slo;
        const keepHi = (hi | spot.hi) & ~next.hi & shi;
        if (search(next.lo | keepLo, next.hi | keepHi, slo & ~keepLo, shi & ~keepHi, rest)) return true;
      }
    }
    return false;
  };
  const start = boardBits(board);
  return search(
    start.lo,
    start.hi,
    spoiled.lo,
    spoiled.hi,
    pieces.map((_, i) => i),
  );
}

function toughSetChance(score: number): number {
  const { minScore, chance, rampFrom, rampChance, rampEvery, rampAdd, maxChance } = balance.toughSet;
  if (score < minScore) return 0;
  if (score < rampFrom) return chance;
  return Math.min(maxChance, rampChance + Math.floor((score - rampFrom) / rampEvery) * rampAdd);
}

function placements(board: Board, shape: Shape): number {
  let count = 0;
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (canPlace(board, shape, row, col)) count++;
    }
  }
  return count;
}

function toughSet(rng: Rng, board: Board, score: number): Piece[] | null {
  let best: Piece[] | null = null;
  let bestRoom = Infinity;
  for (let i = 0; i < balance.toughSet.candidates; i++) {
    const set = Array.from({ length: balance.traySize }, () => randomPiece(rng, score));
    const room = set.map((p) => placements(board, p.cells));
    if (room.every((n) => n === 0)) continue;
    const total = room.reduce((a, b) => a + b, 0);
    if (total < bestRoom) {
      best = set;
      bestRoom = total;
    }
  }
  return best;
}

const DOT: Piece = { shapeId: SHAPES[0].id, color: 0, cells: SHAPES[0].cells };
const SMALL_SUBS = ['bar2', 'corner2', 'diag2'].map(shapeById);

export function paintSet(rng: Rng, set: readonly Piece[], avoid: readonly number[]): Piece[] {
  const used = new Set(avoid);
  return set.map((piece) => {
    const free = Array.from({ length: balance.pieceColors }, (_, c) => c).filter((c) => !used.has(c));
    const color = free[Math.floor(rng() * free.length)];
    used.add(color);
    return { ...piece, color };
  });
}

const CHAIN_BRANCH = 8;
const CHAIN_ATTEMPTS = 24;
const CHAIN_LOOKAHEAD = 2;

const CHAIN_WEIGHTS = shapeWeights(0);

const CHAIN_SHAPES: { id: string; cells: Shape; weight: number }[] = SHAPES.flatMap((def, i) => {
  const out: { id: string; cells: Shape; weight: number }[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const cells = rotateTimes(def.cells, turn);
    if (!out.some((o) => sameShape(o.cells, cells))) out.push({ id: def.id, cells, weight: 0 });
  }
  return out.map((o) => ({ ...o, weight: (CHAIN_WEIGHTS[i] / out.length) * (1 + o.cells.length / 8) }));
});

const CHAIN_KEEP: Record<string, number | undefined> = balance.chainShapeKeep;

function keepChain(rng: Rng, plan: readonly number[]): boolean {
  return plan.every((k) => rng() < (CHAIN_KEEP[CHAIN_SHAPES[k].id] ?? 1));
}

function clearingMoves(lo: number, hi: number, spots: readonly Bits[], n: number): Bits[] {
  const out: Bits[] = [];
  for (const spot of spots) {
    if ((lo & spot.lo) !== 0 || (hi & spot.hi) !== 0) continue;
    const next = placeAndClear(lo, hi, spot, n);
    if (next.lo !== (lo | spot.lo) || next.hi !== (hi | spot.hi)) out.push(next);
  }
  return out;
}

const spotCache = new Map<number, Bits[][]>();

function chainSpots(n: number): Bits[][] {
  let spots = spotCache.get(n);
  if (!spots) {
    spots = CHAIN_SHAPES.map((s) => spotsFor(s.cells, n));
    spotCache.set(n, spots);
  }
  return spots;
}

function chainSearch(rng: Rng, n: number) {
  const spots = chainSpots(n);
  const search = (lo: number, hi: number, left: number, weighted = true): number[] | null => {
    if (left === 0) return [];
    const options: { k: number; next: Bits; key: number }[] = [];
    CHAIN_SHAPES.forEach((shape, k) => {
      for (const next of clearingMoves(lo, hi, spots[k], n)) {
        options.push({ k, next, key: weighted ? rng() ** (1 / shape.weight) : rng() });
      }
    });
    options.sort((x, y) => y.key - x.key);
    const tried = new Set<number>();
    for (const { k, next } of options) {
      if (tried.has(k)) continue;
      tried.add(k);
      if (tried.size > CHAIN_BRANCH) break;
      const rest = search(next.lo, next.hi, left - 1, weighted);
      if (rest) return [k, ...rest];
    }
    return null;
  };
  return { spots, search };
}

export function chainsAll(board: Board, trays: readonly (readonly Piece[])[]): boolean {
  const n = board.size;
  const options = trays.map((tray) => tray.map((p) => spotsFor(p.cells, n)));
  let budget = balance.solvableSearchBudget;
  const search = (lo: number, hi: number, t: number, left: number[]): boolean => {
    if (left.length === 0) {
      if (t + 1 >= trays.length) return true;
      return search(
        lo,
        hi,
        t + 1,
        trays[t + 1].map((_, i) => i),
      );
    }
    for (let i = 0; i < left.length; i++) {
      const rest = left.filter((_, j) => j !== i);
      for (const next of clearingMoves(lo, hi, options[t][left[i]], n)) {
        if (--budget < 0) return false;
        if (search(next.lo, next.hi, t, rest)) return true;
      }
    }
    return false;
  };
  if (trays.length === 0) return true;
  const start = boardBits(board);
  return search(
    start.lo,
    start.hi,
    0,
    trays[0].map((_, i) => i),
  );
}

export function chainSet(rng: Rng, board: Board, sets: number, avoid: readonly number[] = []): Piece[] | null {
  const n = board.size;
  const { spots, search } = chainSearch(rng, n);

  const everyPathChains = (lo: number, hi: number, left: number[], after: number): boolean => {
    if (left.length === 0) return search(lo, hi, after, false) !== null;
    for (let i = 0; i < left.length; i++) {
      const rest = left.filter((_, j) => j !== i);
      for (const next of clearingMoves(lo, hi, spots[left[i]], n)) {
        if (!everyPathChains(next.lo, next.hi, rest, after)) return false;
      }
    }
    return true;
  };

  const start = boardBits(board);
  const after = balance.traySize * (Math.min(sets, CHAIN_LOOKAHEAD) - 1);
  let set: number[] | null = null;
  for (let attempt = 0; attempt < (after > 0 ? CHAIN_ATTEMPTS : 1); attempt++) {
    const plan = search(start.lo, start.hi, balance.traySize + after, attempt < CHAIN_ATTEMPTS / 2);
    if (!plan || !keepChain(rng, plan.slice(0, balance.traySize))) continue;
    set = plan.slice(0, balance.traySize);
    if (after === 0 || everyPathChains(start.lo, start.hi, set, after)) break;
  }
  for (let attempt = 0; !set && attempt < CHAIN_ATTEMPTS; attempt++) {
    const plan = search(start.lo, start.hi, balance.traySize, attempt % 2 === 0);
    if (plan && keepChain(rng, plan)) set = plan;
  }
  if (!set) return null;
  const shuffled = set.map((k) => ({ k, key: rng() })).sort((x, y) => x.key - y.key);
  return paintSet(
    rng,
    shuffled.map(({ k }) => ({ shapeId: CHAIN_SHAPES[k].id, color: 0, cells: CHAIN_SHAPES[k].cells })),
    avoid,
  );
}

export function nextPieceSet(
  rng: Rng,
  board: Board,
  score: number,
  avoid: readonly number[] = [],
  spoiled: Bits = NO_BITS,
): Piece[] {
  return paintSet(rng, pickSet(rng, board, score, spoiled), avoid);
}

function pickSet(rng: Rng, board: Board, score: number, spoiled: Bits): Piece[] {
  const toughChance = toughSetChance(score);
  if (toughChance > 0 && rng() < toughChance) {
    const tough = toughSet(rng, board, score);
    if (tough) return tough;
  }
  let set: Piece[] = [];
  for (let attempt = 0; attempt <= balance.fairnessRetries; attempt++) {
    set = Array.from({ length: balance.traySize }, () => randomPiece(rng, score));
    if (canPlaceAll(board, set, spoiled)) return set;
  }
  const bySize = set.map((p, i) => ({ i, n: p.cells.length })).sort((a, b) => b.n - a.n);
  for (const { i } of bySize) {
    const subs = SMALL_SUBS.map((def) => ({ def, key: rng() })).sort((a, b) => a.key - b.key);
    for (const { def } of subs) {
      set[i] = { shapeId: def.id, color: 0, cells: rotateTimes(def.cells, Math.floor(rng() * 4)) };
      if (canPlaceAll(board, set, spoiled)) return set;
    }
    set[i] = DOT;
    if (canPlaceAll(board, set, spoiled)) return set;
  }
  return set;
}
