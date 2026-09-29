import type { Board } from './board';
import type { Shape } from './pieces';

export interface Bits {
  lo: number;
  hi: number;
}

function bitsOf(indices: number[]): Bits {
  let lo = 0;
  let hi = 0;
  for (const i of indices) {
    if (i < 32) lo |= 1 << i;
    else hi |= 1 << (i - 32);
  }
  return { lo, hi };
}

const lineCache = new Map<number, Bits[]>();

function linesFor(n: number): Bits[] {
  let lines = lineCache.get(n);
  if (!lines) {
    lines = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      const col: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push(i * n + j);
        col.push(j * n + i);
      }
      lines.push(bitsOf(row), bitsOf(col));
    }
    lineCache.set(n, lines);
  }
  return lines;
}

export function boardBits(board: Board): Bits {
  const filled: number[] = [];
  board.cells.forEach((v, i) => {
    if (v !== 0) filled.push(i);
  });
  return bitsOf(filled);
}

export function placements(shape: Shape, n: number): Bits[] {
  const out: Bits[] = [];
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  for (let row = 0; row + rows <= n; row++) {
    for (let col = 0; col + cols <= n; col++) {
      out.push(bitsOf(shape.map(([r, c]) => (row + r) * n + col + c)));
    }
  }
  return out;
}

export function placeAndClear(lo: number, hi: number, piece: Bits, n: number): Bits {
  let nlo = lo | piece.lo;
  let nhi = hi | piece.hi;
  let clo = 0;
  let chi = 0;
  for (const line of linesFor(n)) {
    if ((nlo & line.lo) === line.lo && (nhi & line.hi) === line.hi) {
      clo |= line.lo;
      chi |= line.hi;
    }
  }
  nlo &= ~clo;
  nhi &= ~chi;
  return { lo: nlo, hi: nhi };
}
