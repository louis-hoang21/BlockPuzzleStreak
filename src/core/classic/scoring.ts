import cfg from '../../../config/classic.json';

export function levelFor(lines: number): number {
  return 1 + Math.floor(lines / cfg.linesPerLevel);
}

export function gravityMs(level: number): number {
  const { startMs, factor, minMs, steps } = cfg.gravity;
  const curveEnd = steps.length > 0 ? steps[0].fromLevel - 1 : Infinity;
  let ms = startMs * Math.pow(factor, Math.min(level, curveEnd) - 1);
  for (const { fromLevel, toLevel, stepMs } of steps) {
    const levels = Math.min(level, toLevel) - fromLevel + 1;
    if (levels > 0) ms -= levels * stepMs;
  }
  return Math.max(minMs, Math.round(ms));
}

export function clearPoints(lines: number, combo: number, level: number, perfect: boolean): number {
  const table = cfg.points.lines;
  const base = table[Math.min(lines, table.length - 1)] * level;
  const comboBonus = combo >= 2 ? cfg.points.combo * (combo - 1) * level : 0;
  const perfectBonus = perfect ? cfg.points.perfectClear * level : 0;
  return base + comboBonus + perfectBonus;
}
