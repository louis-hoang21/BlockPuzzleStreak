import balance from '../../config/balance.json';

export interface PlacementScore {
  cellPoints: number;
  lines: number;
  combo: number;
  multiplier: number;
  linePoints: number;
  perfectClearPoints: number;
  total: number;
  banked: number;
}

export function scorePlacement(
  cellsPlaced: number,
  linesCleared: number,
  prevCombo: number,
  perfectClear: boolean,
  prevBanked = 0,
): PlacementScore {
  const earned = prevBanked + cellsPlaced * balance.pointsPerCell;
  const cellPoints = linesCleared > 0 ? earned : 0;
  const combo = linesCleared > 0 ? prevCombo + 1 : 0;
  const multiplier = Math.max(1, combo);
  const linePoints = balance.lineClearBase * linesCleared * linesCleared * multiplier;
  const perfectClearPoints = perfectClear ? balance.perfectClearBonus : 0;
  return {
    cellPoints,
    lines: linesCleared,
    combo,
    multiplier,
    linePoints,
    perfectClearPoints,
    total: cellPoints + linePoints + perfectClearPoints,
    banked: linesCleared > 0 ? 0 : earned,
  };
}
