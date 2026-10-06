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
  meterY: number;
  meterHeight: number;
}

const MAX_PIECE_CELLS = 6;
const GAP_CELLS = 0.8;
const TRAY_CELLS = 3;
const METER_GAP_CELLS = 0.45;
const METER_CELLS = 0.6;

export function computeLayout(width: number, height: number): BoardLayout {
  const n = balance.gridSize;
  const sidePad = 12;
  const framePad = 12;
  const stack = n + GAP_CELLS + TRAY_CELLS + METER_GAP_CELLS + METER_CELLS;
  const cell = Math.floor(
    Math.min((width - sidePad * 2 - framePad * 2) / n, (height * 0.66) / n, (height - framePad * 2) / stack),
  );
  const boardSize = cell * n;
  const gap = cell * GAP_CELLS;
  const trayHeight = cell * TRAY_CELLS;
  const meterHeight = cell * METER_CELLS;
  const total = framePad * 2 + boardSize + gap + trayHeight + cell * METER_GAP_CELLS + meterHeight;
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
    meterY: boardY + boardSize + framePad + gap + trayHeight + cell * METER_GAP_CELLS,
    meterHeight,
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
