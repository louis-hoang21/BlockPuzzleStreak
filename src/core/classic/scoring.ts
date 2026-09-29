import cfg from '../../../config/classic.json';

export function levelFor(lines: number): number {
  return 1 + Math.floor(lines / cfg.linesPerLevel);
}

export function gravityMs(level: number): number {
  const { startMs, factor, minMs } = cfg.gravity;
  return Math.max(minMs, startMs * Math.pow(factor, level - 1));
}

export function clearPoints(lines: number, combo: number, level: number, perfect: boolean): number {
  const table = cfg.points.lines;
  const base = table[Math.min(lines, table.length - 1)] * level;
  const comboBonus = combo >= 2 ? cfg.points.combo * (combo - 1) * level : 0;
  const perfectBonus = perfect ? cfg.points.perfectClear * level : 0;
  return base + comboBonus + perfectBonus;
}
