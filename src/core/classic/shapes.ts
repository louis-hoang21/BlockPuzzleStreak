import type { Cell } from '../pieces';

export type ClassicShape = 'bar' | 'square' | 't' | 's' | 'z' | 'j' | 'l';

export const CLASSIC_SHAPES: readonly ClassicShape[] = ['bar', 'square', 't', 's', 'z', 'j', 'l'];

interface ShapeDef {
  box: number;
  color: number;
  rows: string[];
}

const DEFS: Record<ClassicShape, ShapeDef> = {
  bar: { box: 4, color: 1, rows: ['....', '####', '....', '....'] },
  square: { box: 2, color: 2, rows: ['##', '##'] },
  t: { box: 3, color: 4, rows: ['.#.', '###', '...'] },
  s: { box: 3, color: 0, rows: ['.##', '##.', '...'] },
  z: { box: 3, color: 3, rows: ['##.', '.##', '...'] },
  j: { box: 3, color: 6, rows: ['#..', '###', '...'] },
  l: { box: 3, color: 5, rows: ['..#', '###', '...'] },
};

function parse(rows: string[]): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] === '#') cells.push([r, c]);
  });
  return cells;
}

function turn(cells: readonly Cell[], box: number): Cell[] {
  return cells.map(([r, c]) => [c, box - 1 - r] as const);
}

const ROTATIONS: Record<ClassicShape, Cell[][]> = Object.fromEntries(
  CLASSIC_SHAPES.map((id) => {
    const { box, rows } = DEFS[id];
    const states: Cell[][] = [parse(rows)];
    for (let i = 1; i < 4; i++) states.push(id === 'square' ? states[0] : turn(states[i - 1], box));
    return [id, states];
  }),
) as Record<ClassicShape, Cell[][]>;

export function shapeCells(id: ClassicShape, rot: number): readonly Cell[] {
  return ROTATIONS[id][((rot % 4) + 4) % 4];
}

export function shapeBox(id: ClassicShape): number {
  return DEFS[id].box;
}

export function shapeColor(id: ClassicShape): number {
  return DEFS[id].color;
}
