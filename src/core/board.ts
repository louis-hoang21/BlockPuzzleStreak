import type { Shape } from './pieces';

export interface Board {
  size: number;
  cells: readonly number[];
}

export interface Lines {
  rows: number[];
  cols: number[];
}

export function createBoard(size: number): Board {
  return { size, cells: new Array<number>(size * size).fill(0) };
}

export function cellAt(board: Board, row: number, col: number): number {
  return board.cells[row * board.size + col];
}

export function canPlace(board: Board, shape: Shape, row: number, col: number): boolean {
  const { size, cells } = board;
  for (const [r, c] of shape) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false;
    if (cells[rr * size + cc] !== 0) return false;
  }
  return true;
}

export function canFitAnywhere(board: Board, shape: Shape): boolean {
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (canPlace(board, shape, row, col)) return true;
    }
  }
  return false;
}

export function place(board: Board, shape: Shape, row: number, col: number, color: number): Board {
  const cells = board.cells.slice();
  for (const [r, c] of shape) cells[(row + r) * board.size + (col + c)] = color + 1;
  return { size: board.size, cells };
}

export function findFullLines(board: Board): Lines {
  const { size, cells } = board;
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < size; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (cells[i * size + j] === 0) rowFull = false;
      if (cells[j * size + i] === 0) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

export function lineCount(lines: Lines): number {
  return lines.rows.length + lines.cols.length;
}

export function clearLines(board: Board, lines: Lines): Board {
  const { size } = board;
  const cells = board.cells.slice();
  for (const r of lines.rows) for (let c = 0; c < size; c++) cells[r * size + c] = 0;
  for (const c of lines.cols) for (let r = 0; r < size; r++) cells[r * size + c] = 0;
  return { size, cells };
}

export function previewPlacement(board: Board, shape: Shape, row: number, col: number): Lines | null {
  if (!canPlace(board, shape, row, col)) return null;
  return findFullLines(place(board, shape, row, col, 0));
}

export function isEmpty(board: Board): boolean {
  return board.cells.every((v) => v === 0);
}

export interface CellRect {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

export function solidRect(board: Board): CellRect | null {
  const { size, cells } = board;
  let minR = size;
  let minC = size;
  let maxR = -1;
  let maxC = -1;
  let filled = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 0) continue;
    const r = Math.floor(i / size);
    const c = i % size;
    filled++;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  if (filled === 0) return null;
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  return filled === rows * cols ? { row: minR, col: minC, rows, cols } : null;
}
