import cfg from '../../config/classic.json';

export interface ClassicLayout {
  width: number;
  height: number;
  cell: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  framePad: number;
  sideX: number;
  sideW: number;
  sideCell: number;
  holdY: number;
  nextY: number;
  boxH: number;
  labelH: number;
}

export function computeClassicLayout(width: number, height: number): ClassicLayout {
  const framePad = 8;
  const pad = 8;
  const gap = 8;
  const sideScale = 0.34;
  const sideRatio = sideScale * 4 + 0.4;
  const byWidth = (width - pad * 2 - framePad * 2 - gap - framePad * 2) / (cfg.cols + sideRatio);
  const byHeight = (height - framePad * 2 - 8) / cfg.rows;
  const cell = Math.floor(Math.min(byWidth, byHeight));
  const boardW = cell * cfg.cols;
  const boardH = cell * cfg.rows;
  const sideCell = Math.floor(cell * sideScale);
  const sideW = Math.round(cell * sideRatio);
  const total = boardW + framePad * 2 + gap + sideW + framePad * 2;
  const left = (width - total) / 2;
  const boardX = left + framePad;
  const boardY = framePad + 4;
  const sideX = boardX + boardW + framePad + gap + framePad;
  const labelH = 20;
  const boxH = sideCell * 3;
  const holdY = boardY + labelH;
  const nextY = holdY + boxH + 16 + labelH;
  return {
    width,
    height,
    cell,
    boardX,
    boardY,
    boardW,
    boardH,
    framePad,
    sideX,
    sideW,
    sideCell,
    holdY,
    nextY,
    boxH,
    labelH,
  };
}
