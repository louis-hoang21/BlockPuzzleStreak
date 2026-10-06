import balance from '../../config/balance.json';

export interface PlacementScore {
  cellPoints: number;
  lines: number;
  combo: number;
  multiplier: number;
  linePoints: number;
  perfectClearPoints: number;
  heart: boolean;
  total: number;
  banked: number;
}

function linePointsFor(lines: number): number {
  const table = balance.linePoints;
  const last = table.length - 1;
  return lines <= last ? table[lines] : table[last] + (lines - last) * balance.linePointsExtra;
}

export function scorePlacement(
  cellsPlaced: number,
  linesCleared: number,
  prevCombo: number,
  perfectClear: boolean,
  prevBanked = 0,
  heart = false,
): PlacementScore {
  const earned = prevBanked + cellsPlaced * balance.pointsPerCell;
  const paid = linesCleared > 0 || heart;
  const cellPoints = paid ? earned : 0;
  const combo = linesCleared > 0 ? prevCombo + 1 : 0;
  const multiplier = Math.max(1, combo);
  const linePoints = linePointsFor(linesCleared) * multiplier;
  const perfectClearPoints = perfectClear ? balance.perfectClearBonus : 0;
  const heartMultiplier = heart ? balance.heart.multiplier : 1;
  return {
    cellPoints,
    lines: linesCleared,
    combo,
    multiplier,
    linePoints,
    perfectClearPoints,
    heart,
    total: (cellPoints + linePoints + perfectClearPoints) * heartMultiplier,
    banked: paid ? 0 : earned,
  };
}
