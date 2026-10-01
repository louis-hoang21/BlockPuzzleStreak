import balance from '../../config/balance.json';

export interface BoardLayout {
  width: number;
  height: number;
  cell: number;
  boardX: number;
  boardY: number;
  boardSize: number;
  framePad: number;
  trayY: number;
  trayHeight: number;
  trayX: number;
  trayWidth: number;
  trayCell: number;
  slotWidth: number;
  liftGap: number;
}

const MAX_PIECE_CELLS = 6;

export function computeLayout(width: number, height: number): BoardLayout {
  const n = balance.gridSize;
  const sidePad = 12;
  const framePad = 8;
  const cell = Math.floor(Math.min((width - sidePad * 2 - framePad * 2) / n, (height * 0.66) / n));
  const boardSize = cell * n;
  const gap = cell * 0.8;
  const trayHeight = cell * 3;
  const total = framePad * 2 + boardSize + gap + trayHeight;
  const top = Math.max(0, Math.min((height - total) / 2, cell * 0.3));
  const boardX = (width - boardSize) / 2;
  const boardY = top + framePad;
  const trayX = boardX - framePad;
  const trayWidth = boardSize + framePad * 2;
  const slotWidth = trayWidth / balance.traySize;
  const trayCell = Math.min(
    cell * 0.5,
    Math.floor((slotWidth * 0.84) / MAX_PIECE_CELLS),
    Math.floor((trayHeight * 0.92) / MAX_PIECE_CELLS),
  );
  return {
    width,
    height,
    cell,
    boardX,
    boardY,
    boardSize,
    framePad,
    trayY: boardY + boardSize + framePad + gap,
    trayHeight,
    trayX,
    trayWidth,
    trayCell,
    slotWidth,
    liftGap: cell * 1.2,
  };
}

export function slotCenter(layout: BoardLayout, slot: number): { x: number; y: number } {
  return { x: layout.trayX + layout.slotWidth * (slot + 0.5), y: layout.trayY + layout.trayHeight / 2 };
}
