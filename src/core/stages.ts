import balance from '../../config/balance.json';
import { mulberry32 } from './rng';

export type StageColor = 'light' | 'orange' | 'pink' | 'red';

const COLORS: readonly StageColor[] = ['light', 'orange', 'pink', 'red'];
const CHOICES: readonly (StageColor | null)[] = [null, ...COLORS];

export function stageAt(score: number): number {
  return Math.floor(Math.max(0, score) / balance.colorStageEvery);
}

function firstRound(seed: number): StageColor[] {
  const rand = mulberry32(seed >>> 0);
  const order = [...COLORS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function stageColor(stage: number, seed: number): StageColor | null {
  if (stage <= 0) return null;
  const order = firstRound(seed);
  if (stage <= order.length) return order[stage - 1];
  let color: StageColor | null = order[order.length - 1];
  for (let s = order.length + 1; s <= stage; s++) {
    const others = CHOICES.filter((c) => c !== color);
    color = others[Math.floor(mulberry32((seed ^ Math.imul(s, 0x9e3779b1)) >>> 0)() * others.length)];
  }
  return color;
}
