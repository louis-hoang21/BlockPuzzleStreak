export type Cell = readonly [row: number, col: number];
export type Shape = readonly Cell[];

export type Tier = 'basic' | 'small' | 'medium' | 'large' | 'long';

export interface ShapeDef {
  id: string;
  tier: Tier;
  weight?: number;
  cells: Shape;
}

function parse(rows: string[]): Shape {
  const cells: Cell[] = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '#') cells.push([r, c]);
    }
  });
  return normalize(cells);
}

export const SHAPES: readonly ShapeDef[] = [
  { id: 'dot', tier: 'basic', cells: parse(['#']) },
  { id: 'bar2', tier: 'basic', weight: 1.7, cells: parse(['##']) },
  { id: 'corner2', tier: 'small', cells: parse(['#.', '##']) },
  { id: 'diag2', tier: 'basic', weight: 0.3, cells: parse(['#.', '.#']) },
  { id: 'diag3', tier: 'basic', weight: 0.2, cells: parse(['#..', '.#.', '..#']) },
  { id: 'bar3', tier: 'basic', weight: 1.7, cells: parse(['###']) },
  { id: 'bar4', tier: 'basic', cells: parse(['####']) },
  { id: 'square2', tier: 'medium', weight: 1.6, cells: parse(['##', '##']) },
  { id: 'L', tier: 'medium', weight: 1.4, cells: parse(['#.', '#.', '##']) },
  { id: 'J', tier: 'medium', weight: 1.4, cells: parse(['.#', '.#', '##']) },
  { id: 'T', tier: 'medium', weight: 0.8, cells: parse(['###', '.#.']) },
  { id: 'S', tier: 'medium', weight: 0.6, cells: parse(['.##', '##.']) },
  { id: 'Z', tier: 'medium', weight: 0.6, cells: parse(['##.', '.##']) },
  { id: 'bar5', tier: 'long', weight: 0.6, cells: parse(['#####']) },
  { id: 'bar6', tier: 'long', weight: 0.145, cells: parse(['######']) },
  { id: 'rect2x3', tier: 'large', weight: 2.6, cells: parse(['###', '###']) },
  { id: 'corner3', tier: 'large', cells: parse(['#..', '#..', '###']) },
  { id: 'L4', tier: 'large', weight: 0.9, cells: parse(['#.', '#.', '#.', '##']) },
  { id: 'J4', tier: 'large', weight: 0.9, cells: parse(['.#', '.#', '.#', '##']) },
  { id: 'square3', tier: 'large', cells: parse(['###', '###', '###']) },
];

export function shapeById(id: string): ShapeDef {
  const def = SHAPES.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown shape: ${id}`);
  return def;
}

export function normalize(cells: readonly Cell[]): Shape {
  let minR = Infinity;
  let minC = Infinity;
  for (const [r, c] of cells) {
    if (r < minR) minR = r;
    if (c < minC) minC = c;
  }
  return cells
    .map(([r, c]) => [r - minR, c - minC] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function shapeSize(shape: Shape): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  return { rows, cols };
}

export function rotateCW(shape: Shape): Shape {
  const { rows } = shapeSize(shape);
  return normalize(shape.map(([r, c]) => [c, rows - 1 - r] as const));
}

export function rotateTimes(shape: Shape, times: number): Shape {
  let s = shape;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) s = rotateCW(s);
  return s;
}

export function sameShape(a: Shape, b: Shape): boolean {
  return a.length === b.length && a.every(([r, c], i) => r === b[i][0] && c === b[i][1]);
}
