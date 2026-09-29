import balance from '../../config/balance.json';
import { canPlace, clearLines, findFullLines, lineCount, place, type Board } from './board';
import { rotateTimes, shapeById, SHAPES, type Shape, type Tier } from './pieces';
import type { Rng } from './rng';

export interface Piece {
  shapeId: string;
  color: number;
  cells: Shape;
}

export function difficultyAt(score: number): number {
  return 1 - Math.exp(-Math.max(0, score - balance.difficulty.grace) / balance.difficulty.scale);
}

function tierWeight(tier: Tier, t: number): number {
  const { easy, hard } = balance.difficulty;
  return easy[tier] + (hard[tier] - easy[tier]) * t;
}

export function randomPiece(rng: Rng, score: number): Piece {
  const t = difficultyAt(score);
  const tierTotals: Record<Tier, number> = { basic: 0, small: 0, medium: 0, large: 0, long: 0 };
  for (const s of SHAPES) tierTotals[s.tier] += s.weight ?? 1;
  const weights = SHAPES.map((s) => (tierWeight(s.tier, t) * (s.weight ?? 1)) / tierTotals[s.tier]);
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
  return { shapeId: def.id, color: def.color, cells: rotateTimes(def.cells, turns) };
}

export function canPlaceAll(board: Board, pieces: readonly Piece[]): boolean {
  let budget = balance.solvableSearchBudget;
  const search = (b: Board, left: readonly Piece[]): boolean => {
    if (left.length === 0) return true;
    for (let i = 0; i < left.length; i++) {
      const rest = left.filter((_, k) => k !== i);
      for (let row = 0; row < b.size; row++) {
        for (let col = 0; col < b.size; col++) {
          if (!canPlace(b, left[i].cells, row, col)) continue;
          if (--budget <= 0) return true;
          const placed = place(b, left[i].cells, row, col, 0);
          const lines = findFullLines(placed);
          if (search(lineCount(lines) > 0 ? clearLines(placed, lines) : placed, rest)) return true;
        }
      }
    }
    return false;
  };
  return search(board, pieces);
}

export function toughSetChance(score: number): number {
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

const DOT: Piece = { shapeId: SHAPES[0].id, color: SHAPES[0].color, cells: SHAPES[0].cells };
const SMALL_SUBS = ['bar2', 'corner2', 'diag2'].map(shapeById);

export function nextPieceSet(rng: Rng, board: Board, score: number): Piece[] {
  const toughChance = toughSetChance(score);
  if (toughChance > 0 && rng() < toughChance) {
    const tough = toughSet(rng, board, score);
    if (tough) return tough;
  }
  let set: Piece[] = [];
  for (let attempt = 0; attempt <= balance.fairnessRetries; attempt++) {
    set = Array.from({ length: balance.traySize }, () => randomPiece(rng, score));
    if (canPlaceAll(board, set)) return set;
  }
  const bySize = set.map((p, i) => ({ i, n: p.cells.length })).sort((a, b) => b.n - a.n);
  for (const { i } of bySize) {
    const subs = SMALL_SUBS.map((def) => ({ def, key: rng() })).sort((a, b) => a.key - b.key);
    for (const { def } of subs) {
      set[i] = { shapeId: def.id, color: def.color, cells: rotateTimes(def.cells, Math.floor(rng() * 4)) };
      if (canPlaceAll(board, set)) return set;
    }
    set[i] = DOT;
    if (canPlaceAll(board, set)) return set;
  }
  return set;
}
