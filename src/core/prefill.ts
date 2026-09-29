import balance from '../../config/balance.json';
import { canPlace, createBoard, findFullLines, place, type Board } from './board';
import { rotateTimes, SHAPES } from './pieces';
import type { Rng } from './rng';

const cfg = balance.prefill;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type PrefillTier = keyof typeof cfg.tiers;
const TIERS = Object.keys(cfg.tiers) as PrefillTier[];

export function prefillDifficulty(rng: Rng, best: number): number {
  const k = Math.min(1, Math.max(0, (best - cfg.minBest) / (cfg.topBest - cfg.minBest)));
  const weights = TIERS.map((t) => lerp(cfg.tierWeightsAtMinBest[t], cfg.tierWeightsAtTopBest[t], k));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  let tier = TIERS[TIERS.length - 1];
  for (let i = 0; i < TIERS.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      tier = TIERS[i];
      break;
    }
  }
  const [lo, hi] = cfg.tiers[tier];
  return lo + rng() * (hi - lo);
}

export function shouldPrefill(best: number, rng: Rng): boolean {
  return best >= cfg.minBest && rng() < cfg.chance;
}

export function prefilledBoard(rng: Rng, t: number): Board {
  const n = balance.gridSize;
  let board = createBoard(n);
  const color = () => Math.floor(rng() * balance.pieceColors);
  const setCell = (r: number, c: number, v: number) => {
    const cells = board.cells.slice();
    cells[r * n + c] = v;
    board = { size: n, cells };
  };

  const nearLines = Math.round(lerp(cfg.nearLinesEasy, cfg.nearLinesHard, t));
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  for (let i = 0; i < nearLines; i++) {
    const isRow = rng() < 0.5;
    const used = isRow ? usedRows : usedCols;
    let line = Math.floor(rng() * n);
    for (let tries = 0; used.has(line) && tries < n; tries++) line = (line + 1) % n;
    used.add(line);
    const gap = Math.max(1, Math.round(lerp(3, 1, t) + (rng() - 0.5)));
    const gapStart = Math.floor(rng() * (n - gap + 1));
    const v = color() + 1;
    for (let k = 0; k < n; k++) {
      if (k >= gapStart && k < gapStart + gap) continue;
      if (isRow) setCell(line, k, v);
      else setCell(k, line, v);
    }
  }

  const target = Math.round(n * n * lerp(cfg.fillEasy, cfg.fillHard, t));
  const filled = () => board.cells.filter((v) => v !== 0).length;
  const pool = SHAPES.filter((s) => t > 0.5 || (s.tier !== 'large' && s.cells.length <= 4));
  for (let tries = 0; filled() < target && tries < 200; tries++) {
    const def = pool[Math.floor(rng() * pool.length)];
    const cells = rotateTimes(def.cells, Math.floor(rng() * 4));
    const row = Math.floor(rng() * n);
    const col = Math.floor(rng() * n);
    if (canPlace(board, cells, row, col)) board = place(board, cells, row, col, def.color);
  }

  const { rows, cols } = findFullLines(board);
  for (const r of rows) setCell(r, Math.floor(rng() * n), 0);
  for (const c of cols) {
    if (findFullLines(board).cols.includes(c)) setCell(Math.floor(rng() * n), c, 0);
  }
  return board;
}
