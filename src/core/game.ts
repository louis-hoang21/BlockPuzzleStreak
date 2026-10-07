import balance from '../../config/balance.json';
import {
  canFitAnywhere,
  canPlace,
  createBoard,
  findFullLines,
  isEmpty,
  lineCount,
  place,
  solidRect,
  type Board,
  type CellRect,
  type Lines,
} from './board';
import { chainSet, nextPieceSet, type Piece } from './pieceGenerator';
import { rotateCW, sameShape, shapeSize, type Shape } from './pieces';
import { createRng } from './rng';
import { scorePlacement, type PlacementScore } from './scoreEngine';
import {
  agingCells,
  ageWear,
  bakeSet,
  clearWithWear,
  placeWear,
  presetWear,
  removeSpoiled,
  shieldWear,
  spoilChance,
  spoiledBits,
  spoiledCells,
  wearFor,
} from './spoil';
import { shuffleBoard } from './storm';

export interface GameStats {
  placements: number;
  linesCleared: number;
  perfectClears: number;
  maxCombo: number;
  maxLinesAtOnce: number;
  rotationsUsed: number;
}

export interface GameState {
  board: Board;
  wear?: number[];
  tray: (Piece | null)[];
  score: number;
  banked?: number;
  combo: number;
  rotations: number;
  rngState: number;
  seed?: number;
  setColors?: number[];
  chainSets?: number;
  stormed?: boolean;
  storms?: number;
  stormNeed?: number[];
  stormMax?: number;
  energy?: number;
  gift?: number;
  bolt?: number;
  queued?: Piece[];
  stats: GameStats;
  over: boolean;
}

export interface PlaceResult {
  state: GameState;
  score: PlacementScore;
  cleared: Lines;
  cracked: number[];
  cured: number[];
  placed: Board;
  refilled: boolean;
  heart: CellRect | null;
  gift?: GiftBlast;
  bolt?: BoltStrike;
}

export interface BoltStrike {
  row: number;
  col: number;
  rows: number[];
  cols: number[];
}

export interface StormResult {
  state: GameState;
  before: Board;
  wiped: boolean;
}

export interface GiftBlast {
  row: number;
  col: number;
  rows: number[];
  cols: number[];
}

export function newGame(
  seed: number,
  board: Board = createBoard(balance.gridSize),
  chainSets = 0,
  stormNeed: number[] = [],
  rotations: number = balance.startingRotations,
  stormMax: number = balance.storm.maxStorms,
): GameState {
  const rng = createRng(seed);
  const dealt = (chainSets > 0 && chainSet(rng.next, board, chainSets)) || nextPieceSet(rng.next, board, 0);
  const tray = bakeSet(rng.next, dealt, board, true);
  return {
    board,
    tray,
    ...(chainSets > 1 ? { chainSets: chainSets - 1 } : {}),
    stormNeed,
    stormMax,
    score: 0,
    combo: 0,
    rotations,
    rngState: rng.state(),
    seed,
    setColors: tray.map((p) => p.color),
    stats: {
      placements: 0,
      linesCleared: 0,
      perfectClears: 0,
      maxCombo: 0,
      maxLinesAtOnce: 0,
      rotationsUsed: 0,
    },
    over: false,
  };
}

function needByScore(score: number): number {
  const { atScore, need } = balance.storm.needByScore;
  let value = need[0];
  atScore.forEach((at, i) => {
    if (score >= at) value = need[i];
  });
  return value;
}

function wipeChance(score: number): number {
  const { atScore, chance } = balance.storm.wipeChance;
  let value = chance[0];
  atScore.forEach((at, i) => {
    if (score >= at) value = chance[i];
  });
  return value;
}

export function stormNeedAt(state: GameState, score = state.score): number {
  return state.stormNeed?.[state.storms ?? 0] ?? needByScore(score);
}

export function stormEnergy(state: GameState): { energy: number; need: number; ready: boolean; done: boolean } {
  const done = (state.storms ?? 0) >= (state.stormMax ?? balance.storm.maxStorms);
  const need = done ? 0 : stormNeedAt(state);
  const energy = done ? 0 : Math.min(state.energy ?? 0, need);
  return { energy, need, ready: !done && energy >= need, done };
}

function heartRect(before: Board, after: Board, pieceCells: number): CellRect | null {
  const rect = solidRect(after);
  if (!rect || rect.rows < 2 || rect.cols < 2) return null;
  const area = rect.rows * rect.cols;
  if (area < balance.heart.minCells || area <= pieceCells) return null;
  return solidRect(before) ? null : rect;
}

function giftBlast(board: Board, gift: number | undefined, full: Lines): GiftBlast | undefined {
  if (gift === undefined || board.cells[gift] === 0) return undefined;
  const n = board.size;
  const row = Math.floor(gift / n);
  const col = gift % n;
  if (!full.rows.includes(row) && !full.cols.includes(col)) return undefined;
  const r = balance.gift.radius;
  const around = (center: number) =>
    Array.from({ length: r * 2 + 1 }, (_, k) => center - r + k).filter((i) => i >= 0 && i < n);
  return { row, col, rows: around(row), cols: around(col) };
}

function pickGift(rng: () => number, board: Board, skip?: number): number | undefined {
  const filled = board.cells.flatMap((v, i) => (v !== 0 && i !== skip ? [i] : []));
  return filled.length > 0 ? filled[Math.floor(rng() * filled.length)] : undefined;
}

function boltStrike(board: Board, bolt: number | undefined, cleared: Lines): BoltStrike | undefined {
  if (bolt === undefined || board.cells[bolt] === 0) return undefined;
  const n = board.size;
  const row = Math.floor(bolt / n);
  const col = bolt % n;
  const byRow = cleared.rows.includes(row);
  const byCol = cleared.cols.includes(col);
  if (!byRow && !byCol) return undefined;
  return { row, col, rows: byCol && !byRow ? [row] : [], cols: byRow && !byCol ? [col] : [] };
}

function placedBolt(piece: Piece, n: number, row: number, col: number): number | undefined {
  const cell = piece.bolt === undefined ? undefined : piece.cells[piece.bolt];
  return cell ? (row + cell[0]) * n + col + cell[1] : undefined;
}

function boltSet(rng: () => number, tray: readonly Piece[], busy: boolean): Piece[] {
  const roll = rng();
  const slot = Math.floor(rng() * tray.length);
  const pick = rng();
  const target = tray[slot];
  if (busy || roll >= balance.bolt.trayChance || !target || target.age) return tray.slice();
  return tray.map((p, i) => (i === slot ? { ...p, bolt: Math.floor(pick * p.cells.length) } : p));
}

function rotateIndex(cells: Shape, index: number | undefined): number | undefined {
  if (index === undefined) return undefined;
  const { rows } = shapeSize(cells);
  const turned = cells.map(([r, c]) => [c, rows - 1 - r] as const);
  const minR = Math.min(...turned.map(([r]) => r));
  const minC = Math.min(...turned.map(([, c]) => c));
  const [br, bc] = turned[index];
  const moved = rotateCW(cells).findIndex(([r, c]) => r === br - minR && c === bc - minC);
  return moved >= 0 ? moved : undefined;
}

export function placePiece(state: GameState, slot: number, row: number, col: number): PlaceResult | null {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece.cells, row, col)) return null;

  const placed = place(state.board, piece.cells, row, col, piece.color);
  const full = findFullLines(placed);
  const n = lineCount(full);
  const gift = giftBlast(placed, state.gift, full);
  const blasted: Lines = gift
    ? {
        rows: [...new Set([...full.rows, ...gift.rows])].sort((a, b) => a - b),
        cols: [...new Set([...full.cols, ...gift.cols])].sort((a, b) => a - b),
      }
    : full;
  const boltAt = placedBolt(piece, placed.size, row, col) ?? state.bolt;
  const bolt = boltStrike(placed, boltAt, blasted);
  const cleared: Lines = bolt
    ? {
        rows: [...new Set([...blasted.rows, ...bolt.rows])].sort((a, b) => a - b),
        cols: [...new Set([...blasted.cols, ...bolt.cols])].sort((a, b) => a - b),
      }
    : blasted;
  const fate = createRng((state.rngState ^ 0x2c1b3c6d ^ Math.imul(state.stats.placements + 1, 0x9e3779b1)) >>> 0);
  const keep = fate.next() >= spoilChance(state.score);
  const aging = agingCells(piece, fate.next, keep);
  const before = shieldWear(placeWear(wearFor(state.board, state.wear), placed.size, piece, row, col, aging), boltAt);
  const cleaned = n > 0 ? clearWithWear(placed, before, cleared, state.combo >= 1 || bolt !== undefined) : { board: placed, wear: before, cracked: [] };
  const cured = gift && fate.next() < balance.gift.cureChance ? spoiledCells(cleaned.board, cleaned.wear) : [];
  const after = cured.length > 0 ? { ...removeSpoiled(cleaned.board, cleaned.wear), cracked: [] } : cleaned;
  const board = after.board;
  const wear = ageWear(board, after.wear, piece.cells, row, col);
  const perfectClear = n > 0 && isEmpty(board);
  const heart = heartRect(state.board, board, piece.cells.length);
  const base = scorePlacement(piece.cells.length, n, state.combo, perfectClear, state.banked ?? 0, heart !== null);
  const bonus = (gift ? balance.gift.bonus : 0) + (bolt ? balance.bolt.bonus : 0);
  const score = bonus > 0 ? { ...base, total: base.total + bonus } : base;
  const nextGift = gift ? undefined : state.gift;
  const nextBolt = bolt || boltAt === undefined || board.cells[boltAt] === 0 ? undefined : boltAt;

  let tray = state.tray.map((p, i) => (i === slot ? null : p));
  let rngState = state.rngState;
  let setColors = state.setColors;
  let chainSets = state.chainSets;
  const storms = state.storms ?? (state.stormed ? 1 : 0);
  const charge = n > 0 ? n * balance.storm.energyPerLine + (score.combo >= 2 ? balance.storm.energyPerCombo : 0) : 0;
  const energy = (state.energy ?? 0) + charge;
  const refilled = tray.every((p) => p === null);
  if (refilled) {
    const rng = createRng(rngState);
    const fresh =
      (chainSets && chainSet(rng.next, board, chainSets, setColors)) ||
      nextPieceSet(rng.next, board, state.score + score.total, setColors, spoiledBits(wear));
    chainSets = chainSets && chainSets > 1 ? chainSets - 1 : undefined;
    const baked = bakeSet(rng.next, fresh, board, false, state.score + score.total);
    tray = boltSet(rng.next, baked, nextBolt !== undefined);
    setColors = fresh.map((p) => p.color);
    rngState = rng.state();
  }

  const stats: GameStats = {
    ...state.stats,
    placements: state.stats.placements + 1,
    linesCleared: state.stats.linesCleared + n,
    perfectClears: state.stats.perfectClears + (perfectClear ? 1 : 0),
    maxCombo: Math.max(state.stats.maxCombo, score.combo),
    maxLinesAtOnce: Math.max(state.stats.maxLinesAtOnce, n),
  };
  const next: GameState = {
    ...state,
    board,
    wear,
    tray,
    score: state.score + score.total,
    banked: score.banked,
    combo: score.combo,
    rngState,
    setColors,
    chainSets,
    stormed: undefined,
    storms,
    energy: Math.min(energy, stormNeedAt({ ...state, storms }, state.score + score.total)),
    gift: nextGift,
    bolt: nextBolt,
    queued: undefined,
    stats,
  };
  next.over = isOver(next);
  return { state: next, score, cleared, cracked: after.cracked, cured, placed, refilled, heart, gift, bolt };
}

export function castStorm(state: GameState): StormResult | null {
  if (state.over || !stormEnergy(state).ready) return null;
  const rng = createRng(state.rngState ^ 0x5bd1e995);
  const cleaned = removeSpoiled(state.board, wearFor(state.board, state.wear));
  const filled = cleaned.board.cells.some((v) => v !== 0);
  let shuffled: { board: Board; wear: number[] } | null = null;
  if (filled && rng.next() >= wipeChance(state.score)) {
    for (let attempt = 0; attempt < balance.storm.shuffleAttempts && !shuffled; attempt++) {
      const candidate = shuffleBoard(rng.next, cleaned.board, cleaned.wear);
      if (hasMove(candidate.board, state.tray)) shuffled = candidate;
    }
  }
  const wiped = shuffled === null;
  const nextBoard = shuffled?.board ?? createBoard(state.board.size);
  const gift = wiped ? undefined : pickGift(rng.next, nextBoard);
  const boltRoll = rng.next();
  const boltFree = !wiped && !state.tray.some((p) => p?.bolt !== undefined) && boltRoll < balance.bolt.boardChance;
  const bolt = boltFree ? pickGift(rng.next, nextBoard, gift) : undefined;
  const next: GameState = {
    ...state,
    board: nextBoard,
    wear: presetWear(nextBoard),
    bolt,
    storms: (state.storms ?? 0) + 1,
    energy: 0,
    gift,
    rngState: (state.rngState + 1) >>> 0,
    over: false,
  };
  next.over = isOver(next);
  return { state: next, before: state.board, wiped };
}

export function rotatePiece(state: GameState, slot: number): GameState | null {
  const piece = state.tray[slot];
  if (state.over || !piece || state.rotations <= 0) return null;
  const cells = rotateCW(piece.cells);
  if (sameShape(cells, piece.cells)) return null;

  const tray = state.tray.map((p, i) => (i === slot ? {
          ...piece,
          cells,
          bolt: rotateIndex(piece.cells, piece.bolt),
          aged: piece.aged
            ?.map((k) => rotateIndex(piece.cells, k))
            .filter((k) => k !== undefined)
            .sort((a, b) => a - b),
        } : p));
  const next: GameState = {
    ...state,
    tray,
    rotations: state.rotations - 1,
    stats: { ...state.stats, rotationsUsed: state.stats.rotationsUsed + 1 },
  };
  next.over = isOver(next);
  return next;
}

export function hasMove(board: Board, tray: readonly (Piece | null)[]): boolean {
  return tray.some((piece) => piece !== null && canFitAnywhere(board, piece.cells));
}

export function rescueSlots(state: GameState): number[] {
  const slots: number[] = [];
  state.tray.forEach((piece, slot) => {
    if (!piece) return;
    let cells = piece.cells;
    for (let turn = 1; turn <= Math.min(3, state.rotations); turn++) {
      cells = rotateCW(cells);
      if (sameShape(cells, piece.cells)) return;
      if (canFitAnywhere(state.board, cells)) {
        slots.push(slot);
        return;
      }
    }
  });
  return slots;
}

export function isOver(state: GameState): boolean {
  return !hasMove(state.board, state.tray) && rescueSlots(state).length === 0 && !stormEnergy(state).ready;
}

export function addRotations(current: number, amount: number): { rotations: number; added: number } {
  const rotations = Math.max(current, Math.min(balance.maxRotations, current + amount));
  return { rotations, added: rotations - current };
}
