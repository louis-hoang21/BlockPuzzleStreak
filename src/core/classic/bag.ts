import type { Rng } from '../rng';
import { CLASSIC_SHAPES, type ClassicShape } from './shapes';

export function shuffledBag(rng: Rng): ClassicShape[] {
  const bag = [...CLASSIC_SHAPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}
