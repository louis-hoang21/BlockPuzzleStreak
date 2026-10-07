import balance from '../../config/balance.json';
import { bitsOf, type Bits } from './bitboard';
import type { Board, Lines } from './board';
import type { Piece } from './pieceGenerator';
import type { Shape } from './pieces';

export const SPOIL_AT = balance.spoil.at;
export const SPOIL_WARN = balance.spoil.warnAt;
export const CRACKED = SPOIL_AT + 1;

const AGE = 15;
const BAKED = 16;
const PRESET = 32;

export type Wear = 'fresh' | 'warn' | 'spoiled' | 'cracked';

export const ageOf = (w: number | undefined) => (w ?? 0) & AGE;

export const isBaked = (w: number | undefined) => ((w ?? 0) & BAKED) !== 0;

export function wearOf(w: number | undefined): Wear {
  const age = ageOf(w);
  if (age >= SPOIL_AT) return age === SPOIL_AT ? 'spoiled' : 'cracked';
  return age >= SPOIL_WARN || isBaked(w) ? 'warn' : 'fresh';
}

export function turnsLeft(w: number | undefined): number | null {
  return wearOf(w) === 'warn' ? SPOIL_AT - ageOf(w) : null;
}

export function spoilChance(score: number): number {
  const { maxChance, fromScore, toScore, minChance } = balance.spoil.fade;
  if (score <= fromScore) return maxChance;
  if (score >= toScore) return minChance;
  return maxChance - ((maxChance - minChance) * (score - fromScore)) / (toScore - fromScore);
}

export function pieceWear(piece: Piece, k: number): number {
  if (!piece.age || (piece.aged && !piece.aged.includes(k))) return 0;
  return piece.age | BAKED;
}

export function pickAged(rng: () => number, count: number): number[] {
  const want = Math.min(count, 1 + Math.floor(rng() * balance.spoil.maxCells));
  const pool = Array.from({ length: count }, (_, k) => k);
  const picked: number[] = [];
  for (let k = 0; k < want; k++) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return picked.sort((a, b) => a - b);
}

export function agingCells(piece: Piece, rng: () => number, keep: boolean): number[] {
  if (piece.age) return piece.aged ?? piece.cells.map((_, k) => k);
  return keep ? [] : pickAged(rng, piece.cells.length);
}

export function wearFor(board: Board, wear?: readonly number[]): number[] {
  return wear && wear.length === board.cells.length ? wear.slice() : new Array<number>(board.cells.length).fill(0);
}

export function presetWear(board: Board): number[] {
  return board.cells.map((v) => (v !== 0 ? PRESET : 0));
}

export function spoiledBits(wear?: readonly number[]): Bits {
  return bitsOf(wear ? wear.flatMap((w, i) => (ageOf(w) === SPOIL_AT ? [i] : [])) : []);
}

export function placeWear(
  wear: readonly number[],
  n: number,
  piece: Piece,
  row: number,
  col: number,
  aging: readonly number[],
): number[] {
  const next = wear.slice();
  piece.cells.forEach(([r, c], k) => {
    next[(row + r) * n + col + c] = aging.includes(k) ? pieceWear(piece, k) : PRESET;
  });
  return next;
}

export function clearWithWear(
  board: Board,
  wear: readonly number[],
  lines: Lines,
  smash = false,
): { board: Board; wear: number[]; cracked: number[] } {
  const n = board.size;
  const cells = board.cells.slice();
  const next = wear.slice();
  const hit = new Set<number>();
  for (const r of lines.rows) for (let c = 0; c < n; c++) hit.add(r * n + c);
  for (const c of lines.cols) for (let r = 0; r < n; r++) hit.add(r * n + c);
  const cracked: number[] = [];
  for (const i of hit) {
    if (!smash && cells[i] !== 0 && ageOf(next[i]) === SPOIL_AT) {
      next[i] = CRACKED;
      cracked.push(i);
    } else {
      cells[i] = 0;
      next[i] = 0;
    }
  }
  return { board: { size: n, cells }, wear: next, cracked };
}

export function shieldWear(wear: readonly number[], i: number | undefined): number[] {
  const next = wear.slice();
  if (i !== undefined && i < next.length) next[i] = PRESET;
  return next;
}

export function spoiledCells(board: Board, wear: readonly number[]): number[] {
  return board.cells.flatMap((v, i) => (v !== 0 && ageOf(wear[i]) >= SPOIL_AT ? [i] : []));
}

export function removeSpoiled(board: Board, wear: readonly number[]): { board: Board; wear: number[] } {
  const gone = (i: number) => ageOf(wear[i]) >= SPOIL_AT;
  return {
    board: { size: board.size, cells: board.cells.map((v, i) => (gone(i) ? 0 : v)) },
    wear: wear.map((w, i) => (gone(i) ? 0 : w)),
  };
}

export function ageWear(board: Board, wear: readonly number[], shape: Shape, row: number, col: number): number[] {
  const n = board.size;
  const fresh = new Set(shape.map(([r, c]) => (row + r) * n + col + c));
  return wear.map((w, i) => {
    if (board.cells[i] === 0) return 0;
    if (w & PRESET || ageOf(w) >= SPOIL_AT || fresh.has(i)) return w;
    return w + 1;
  });
}

export function bakeSet(
  rng: () => number,
  tray: readonly Piece[],
  board: Board,
  force: boolean,
  score = 0,
): Piece[] {
  const { chance, minAge, maxAge, maxFill } = balance.spoil.baked;
  const fill = board.cells.filter((v) => v !== 0).length / board.cells.length;
  const roll = rng();
  const slot = Math.floor(rng() * tray.length);
  const age = minAge + Math.floor(rng() * (maxAge - minAge + 1));
  if (!force && (fill > maxFill || roll >= (chance * spoilChance(score)) / balance.spoil.fade.maxChance)) return tray.slice();
  return tray.map((p, i) => (i === slot ? { ...p, age, aged: pickAged(rng, p.cells.length) } : p));
}
