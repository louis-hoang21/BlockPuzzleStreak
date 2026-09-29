import cosmetics from '../../config/cosmetics.json';
import milestones from '../../config/milestones.json';

const ROTATION_SCORES = [...milestones.rotationMilestones.scores].sort((a, b) => a - b);

export function rotationMilestonesCrossed(prev: number, next: number): number[] {
  return ROTATION_SCORES.filter((s) => s > prev && s <= next);
}

export function nextRotationMilestone(score: number): number | null {
  return ROTATION_SCORES.find((s) => s > score) ?? null;
}

export interface ScoreUnlock {
  kind: 'theme' | 'skin';
  id: string;
  score: number;
}

export const SCORE_UNLOCKS: readonly ScoreUnlock[] = [
  ...cosmetics.themes.map((t) => ({ kind: 'theme' as const, id: t.id, unlock: t.unlock })),
  ...cosmetics.skins.map((s) => ({ kind: 'skin' as const, id: s.id, unlock: s.unlock })),
]
  .filter((x) => x.unlock.type === 'score' && 'score' in x.unlock)
  .map((x) => ({ kind: x.kind, id: x.id, score: (x.unlock as { score: number }).score }))
  .sort((a, b) => a.score - b.score);

export function scoreUnlocksReached(score: number, themes: readonly string[], skins: readonly string[]): ScoreUnlock[] {
  return SCORE_UNLOCKS.filter((u) => score >= u.score && !(u.kind === 'theme' ? themes : skins).includes(u.id));
}
