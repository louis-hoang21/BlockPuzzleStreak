import balance from '../../config/balance.json';
import { mulberry32 } from './rng';

export type StageColor = 'light' | 'orange' | 'pink' | 'red';

const FIXED: readonly StageColor[] = ['light', 'orange', 'pink', 'red'];

export function stageAt(score: number): number {
  return Math.floor(Math.max(0, score) / balance.colorStageEvery);
}

export function stageColor(stage: number, seed: number): StageColor | null {
  if (stage <= 0) return null;
  if (stage <= FIXED.length) return FIXED[stage - 1];
  let color = FIXED[FIXED.length - 1];
  for (let s = FIXED.length + 1; s <= stage; s++) {
    const others = FIXED.filter((c) => c !== color);
    color = others[Math.floor(mulberry32((seed ^ Math.imul(s, 0x9e3779b1)) >>> 0)() * others.length)];
  }
  return color;
}
