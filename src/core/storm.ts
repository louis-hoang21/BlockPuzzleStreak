import balance from '../../config/balance.json';
import { findFullLines, type Board } from './board';
import type { Piece } from './pieceGenerator';
import { rotateTimes, sameShape, shapeSize, SHAPES, type Shape } from './pieces';
import type { Rng } from './rng';

const cfg = balance.storm;

const SHAPE_ROTATIONS: { id: string; cells: Shape; weight: number }[] = SHAPES.flatMap((def) => {
  const out: { id: string; cells: Shape; weight: number }[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const cells = rotateTimes(def.cells, turn);
    if (!out.some((o) => sameShape(o.cells, cells))) out.push({ id: def.id, cells, weight: def.weight ?? 1 });
  }
  return out;
});

function lineCells(n: number, line: number): number[] {
  const index = line % n;
  return Array.from({ length: n }, (_, k) => (line < n ? index * n + k : k * n + index));
}

function hasFullLine(n: number, filled: readonly boolean[]): boolean {
  const { rows, cols } = findFullLines({ size: n, cells: filled.map((v) => (v ? 1 : 0)) });
  return rows.length + cols.length > 0;
}

interface Step {
  before: boolean[];
  piece: Piece;
}

const lineCache = new Map<number, { cells: number[][]; of: number[][] }>();

function linesOf(n: number) {
  let lines = lineCache.get(n);
  if (!lines) {
    const cells = Array.from({ length: n * 2 }, (_, line) => lineCells(n, line));
    const of = Array.from({ length: n * n }, (_, i) => [Math.floor(i / n), n + (i % n)]);
    lines = { cells, of };
    lineCache.set(n, lines);
  }
  return lines;
}

function unclearOptions(rng: Rng, n: number, after: readonly boolean[]): Step[] {
  const { cells: allLines, of } = linesOf(n);
  const counts = allLines.map((cells) => cells.filter((i) => after[i]).length);
  const options: { line: number; spot: number[]; id: string; shape: Shape; key: number }[] = [];
  for (let line = 0; line < n * 2; line++) {
    if (counts[line] > 0) continue;
    const cells = allLines[line];
    const merged = counts.slice();
    for (const i of cells) for (const l of of[i]) if (l !== line) merged[l]++;
    merged[line] = n;
    if (merged.some((c, l) => l !== line && c === n)) continue;
    const inLine = new Set(cells);
    const index = line % n;
    for (const { id, cells: shape, weight } of SHAPE_ROTATIONS) {
      const { rows, cols } = shapeSize(shape);
      const rowFrom = line < n ? Math.max(0, index - rows + 1) : 0;
      const rowTo = line < n ? Math.min(index, n - rows) : n - rows;
      const colFrom = line < n ? 0 : Math.max(0, index - cols + 1);
      const colTo = line < n ? n - cols : Math.min(index, n - cols);
      for (let row = rowFrom; row <= rowTo; row++) {
        for (let col = colFrom; col <= colTo; col++) {
          const spot: number[] = [];
          let fits = true;
          let outside = 0;
          for (const [r, c] of shape) {
            const i = (row + r) * n + col + c;
            if (!inLine.has(i)) {
              if (!after[i]) {
                fits = false;
                break;
              }
              outside++;
            }
            spot.push(i);
          }
          if (!fits) continue;
          const left = merged.slice();
          for (const i of spot) for (const l of of[i]) left[l]--;
          let empty = 0;
          for (const c of left) if (c === 0) empty++;
          const key = empty * 2 + outside * 0.5 + Math.log(weight) + rng() * 3;
          options.push({ line, spot, id, shape, key });
        }
      }
    }
  }
  return options
    .sort((x, y) => y.key - x.key)
    .slice(0, cfg.branch)
    .map(({ line, spot, id, shape }) => {
      const before = after.slice();
      for (const i of allLines[line]) before[i] = true;
      for (const i of spot) before[i] = false;
      return { before, piece: { shapeId: id, color: 0, cells: shape } };
    });
}

interface Plan {
  filled: boolean[];
  pieces: Piece[];
}

function unclearChain(rng: Rng, n: number, after: boolean[], steps: number, budget: { left: number }): Plan | null {
  if (steps === 0) return { filled: after, pieces: [] };
  if (--budget.left < 0) return null;
  for (const { before, piece } of unclearOptions(rng, n, after)) {
    const found = unclearChain(rng, n, before, steps - 1, budget);
    if (found) return { filled: found.filled, pieces: [...found.pieces, piece] };
  }
  return null;
}

function seedBoard(rng: Rng, n: number): boolean[] {
  const filled = new Array<boolean>(n * n).fill(false);
  const count = Math.floor(rng() * (cfg.seedCells + 1));
  for (let k = 0; k < count; k++) {
    const i = Math.floor(rng() * n * n);
    filled[i] = true;
    if (hasFullLine(n, filled)) filled[i] = false;
  }
  return filled;
}

function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffleBoard(rng: Rng, board: Board): Board {
  const n = board.size;
  const colors = shuffle(rng, board.cells.filter((v) => v !== 0));
  const filled = new Array<boolean>(n * n).fill(false);
  const cells = new Array<number>(n * n).fill(0);
  const spots = shuffle(rng, Array.from({ length: n * n }, (_, i) => i));
  let c = 0;
  for (const i of spots) {
    if (c >= colors.length) break;
    filled[i] = true;
    if (hasFullLine(n, filled)) {
      filled[i] = false;
      continue;
    }
    cells[i] = colors[c++];
  }
  return { size: n, cells };
}

export interface Storm {
  board: Board;
  pieces: Piece[];
}

export function stormBoard(rng: Rng, board: Board): Storm | null {
  return buildStorm(rng, board, cfg.chainPieces, cfg.budget);
}

function buildStorm(rng: Rng, board: Board, steps: number, budget: number): Storm | null {
  const n = board.size;
  const colors = board.cells.filter((v) => v !== 0);
  const target = Math.min(cfg.maxCells, Math.max(cfg.minCells, colors.length));
  let best: Plan | null = null;
  let bestGap = Infinity;
  for (let attempt = 0; attempt < cfg.attempts; attempt++) {
    const plan = unclearChain(rng, n, seedBoard(rng, n), steps, { left: budget });
    if (!plan) continue;
    const gap = Math.abs(plan.filled.filter(Boolean).length - target);
    if (gap < bestGap) {
      best = plan;
      bestGap = gap;
    }
    if (bestGap <= cfg.tolerance) break;
  }
  if (!best) return null;
  const palette = colors.length > 0 ? shuffle(rng, colors) : [1];
  let c = 0;
  return {
    board: { size: n, cells: best.filled.map((v) => (v ? palette[c++ % palette.length] : 0)) },
    pieces: best.pieces,
  };
}
