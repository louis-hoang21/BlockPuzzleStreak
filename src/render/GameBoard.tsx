import {
  BlurMask,
  Canvas,
  ClipOp,
  createPicture,
  Group,
  PaintStyle,
  Picture,
  RoundedRect,
  Skia,
  StrokeCap,
  TileMode,
  vec,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Board } from '../core/board';
import type { Piece } from '../core/pieceGenerator';
import { shapeSize, type Shape } from '../core/pieces';
import { mulberry32 } from '../core/rng';
import { Block, PieceBlocks } from './Block';
import { EmptyCell } from './EmptyCell';
import { GiftBow } from './GiftBow';
import { BoardFrame } from './BoardFrame';
import { RainbowWarmup } from './RainbowWarmup';
import { drawRainbowBoxes, RAINBOW_MS, type Box } from './rainbow';
import { slotCenter, type BoardLayout } from './layout';
import type { BoardTheme, Skin } from './theme';

export interface ClearingCell {
  row: number;
  col: number;
  color: number;
}

export interface StormWave {
  id: number;
  before: Board;
}

export interface ClearEvent {
  id: number;
  cells: ClearingCell[];
  rows: number[];
  cols: number[];
  lines: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  spin: number;
}

interface Props {
  layout: BoardLayout;
  board: Board;
  tray: readonly (Piece | null)[];
  clearing: ClearEvent | null;
  storm: StormWave | null;
  gift?: number;
  disabled: boolean;
  onDrop: (slot: number, row: number, col: number) => boolean;
  onRotate: (slot: number) => boolean;
  hintSlots: readonly number[];
  theme: BoardTheme;
  skin: Skin;
}

type Size = { rows: number; cols: number } | null;
type Preview = { valid: boolean; rows: number[]; cols: number[] };

const NO_PREVIEW: Preview = { valid: false, rows: [], cols: [] };


function previewAt(
  cells: readonly number[],
  n: number,
  shape: readonly (readonly number[])[],
  row: number,
  col: number,
): Preview {
  'worklet';
  const filled = cells.slice();
  for (const [r, c] of shape) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n || filled[rr * n + cc] !== 0) return NO_PREVIEW;
    filled[rr * n + cc] = 1;
  }
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < n; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < n; j++) {
      if (filled[i * n + j] === 0) rowFull = false;
      if (filled[j * n + i] === 0) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { valid: true, rows, cols };
}

const BURST_MS = 520;
const FLASH_S = 0.1;
const SHARD_LIFE_S = 0.4;
const SHARDS_PER_CELL = 6;
const GRAVITY = 640;
const RAINBOW_HOLD_S = 0.15;
const RAINBOW_FADE_S = 0.2;
const SPIN_MS = 180;
const HOP_MS = 300;
const MIN_DROP_TRAVEL = 0.6;
const GHOST_OPACITY = 0.4;
const SNAP_CELLS = 0.75;
const LAND_MS = 80;
const POP_SCALE = 1.08;
const POP_UP_MS = 70;
const POP_DOWN_MS = 110;
const LIFT_SPRING = { damping: 18, stiffness: 520, mass: 0.6 };
const BACK_SPRING = { damping: 16, stiffness: 280, mass: 0.7 };
const FLASH_COLOR = '#FFE680';
const GUST_MS = 350;
const WAVE_MS = 1100;
const STORM_MS = GUST_MS + WAVE_MS;
const GUST_DARK = 0.38;
const GUST_STREAKS = 9;
const STORM_SKY = '#1E2A44';
const WAVE_BAND = 0.45;
const WAVE_CRESTS = 3;
const WAVE_DEEP = '#2E8BD8';
const WAVE_LIGHT = '#8FD3FF';
const FOAM = '#FFFFFF';
const GIFT_TWINKLE_MS = 600;

function JackpotBurst({
  clearing,
  skin,
  cell,
  boardX,
  boardY,
  boardSize,
  framePad,
}: {
  clearing: ClearEvent;
  skin: Skin;
  cell: number;
  boardX: number;
  boardY: number;
  boardSize: number;
  framePad: number;
}) {
  const clearProgress = useSharedValue(0);
  const frameFlash = useSharedValue(0);
  const shards = useMemo(() => {
    const rand = mulberry32(clearing.id * 2654435761);
    const unit = cell / 38;
    const list: Shard[] = [];
    for (const { row, col, color } of clearing.cells) {
      const base = skin.colors[color % skin.colors.length].base;
      for (let i = 0; i < SHARDS_PER_CELL; i++) {
        const angle = rand() * Math.PI * 2;
        const speed = (80 + rand() * 160) * unit;
        list.push({
          x: boardX + (col + 0.5) * cell,
          y: boardY + (row + 0.5) * cell,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 120 * unit,
          size: (5 + rand() * 6) * unit,
          color: base,
          rot: rand() * 360,
          spin: (rand() - 0.5) * 600,
        });
      }
    }
    return list;
  }, [clearing, skin, cell, boardX, boardY]);
  const burstBoxes = useMemo(
    () => [
      ...clearing.rows.map((r): Box => [boardX, boardY + r * cell, boardSize, cell]),
      ...clearing.cols.map((c): Box => [boardX + c * cell, boardY, cell, boardSize]),
    ],
    [clearing, boardX, boardY, boardSize, cell],
  );
  useEffect(() => {
    clearProgress.value = withTiming(1, { duration: BURST_MS, easing: Easing.linear });
    if (clearing.lines >= 2) {
      frameFlash.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 180 }));
    }
  }, [clearing, clearProgress, frameFlash]);
  const clearOpacity = useDerivedValue(() => {
    const t = (clearProgress.value * BURST_MS) / 1000;
    return t < FLASH_S ? 1 : 0;
  });
  const flashOpacity = useDerivedValue(() => {
    const t = (clearProgress.value * BURST_MS) / 1000;
    return t < FLASH_S ? 1 - t / FLASH_S : 0;
  });
  const burst = useDerivedValue(() => {
    const p = clearProgress.value;
    const t = (p * BURST_MS) / 1000;
    return createPicture((canvas) => {
      if (p >= 1) return;
      const glow = t < RAINBOW_HOLD_S ? 1 : Math.max(0, 1 - (t - RAINBOW_HOLD_S) / RAINBOW_FADE_S);
      if (glow > 0) drawRainbowBoxes(canvas, burstBoxes, t, [boardX, boardY, boardSize, boardSize], cell, glow);
      const life = t - FLASH_S;
      if (life <= 0 || life >= SHARD_LIFE_S) return;
      const paint = Skia.Paint();
      for (const sh of shards) {
        paint.setColor(Skia.Color(sh.color));
        paint.setAlphaf(1 - life / SHARD_LIFE_S);
        const x = sh.x + sh.vx * life;
        const y = sh.y + sh.vy * life + 0.5 * GRAVITY * (cell / 38) * life * life;
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(sh.rot + sh.spin * life, 0, 0);
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-sh.size / 2, -sh.size / 2, sh.size, sh.size), 2, 2), paint);
        canvas.restore();
      }
    });
  });
  return (
    <>
      <Group opacity={clearOpacity}>
        {clearing.cells.map(({ row, col, color }) => {
          const x = boardX + col * cell;
          const y = boardY + row * cell;
          return (
            <Group key={`${row}-${col}`}>
              <Block x={x} y={y} size={cell} color={color} skin={skin} />
              <RoundedRect
                x={x + 2}
                y={y + 2}
                width={cell - 4}
                height={cell - 4}
                r={cell * 0.16}
                color="white"
                opacity={flashOpacity}
              />
            </Group>
          );
        })}
      </Group>
      <Picture picture={burst} />
      <Group opacity={frameFlash}>
        <RoundedRect
          x={boardX - framePad / 2}
          y={boardY - framePad / 2}
          width={boardSize + framePad}
          height={boardSize + framePad}
          r={framePad * 1.5}
          color={FLASH_COLOR}
          style="stroke"
          strokeWidth={framePad}
        >
          <BlurMask blur={framePad} style="solid" />
        </RoundedRect>
      </Group>
    </>
  );
}

const pieceIds = new WeakMap<Piece, number>();
let lastPieceId = 0;
let lastPopId = 0;

function pieceId(piece: Piece): number {
  let id = pieceIds.get(piece);
  if (id === undefined) {
    id = ++lastPieceId;
    pieceIds.set(piece, id);
  }
  return id;
}

function fitsAt(cells: readonly number[], n: number, shape: Shape, row: number, col: number): boolean {
  'worklet';
  for (const [r, c] of shape) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n || cells[rr * n + cc] !== 0) return false;
  }
  return true;
}

interface Lift {
  slot: SharedValue<number>;
  id: SharedValue<number>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  offX: SharedValue<number>;
  offY: SharedValue<number>;
  scale: SharedValue<number>;
}

interface Pop {
  id: number;
  cells: Shape;
  color: number;
  row: number;
  col: number;
}

function TrayPiece({
  piece,
  id,
  slot,
  layout,
  skin,
  lift,
  hop,
  hint,
  spin,
  spinning,
}: {
  piece: Piece;
  id: number;
  slot: number;
  layout: BoardLayout;
  skin: Skin;
  lift: Lift;
  hop: SharedValue<number>;
  hint: boolean;
  spin: SharedValue<number>;
  spinning: boolean;
}) {
  const { cell, trayCell } = layout;
  const { rows, cols } = shapeSize(piece.cells);
  const home = slotCenter(layout, slot);
  const rest = trayCell / cell;
  const transform = useDerivedValue(() => {
    const lifted = lift.slot.value === slot && lift.id.value === id;
    const x = lifted ? lift.fingerX.value + lift.offX.value : home.x;
    const y = lifted ? lift.fingerY.value + lift.offY.value : home.y - (hint ? hop.value * trayCell * 0.6 : 0);
    const angle = !lifted && spinning ? (-(1 - spin.value) * Math.PI) / 2 : 0;
    return [
      { translateX: x },
      { translateY: y },
      { rotate: angle },
      { scale: lifted ? lift.scale.value : rest },
      { translateX: (-cols * cell) / 2 },
      { translateY: (-rows * cell) / 2 },
    ];
  });
  return (
    <Group transform={transform}>
      <PieceBlocks cells={piece.cells} color={piece.color} size={cell} skin={skin} />
    </Group>
  );
}

function TrayGhost({
  piece,
  id,
  slot,
  layout,
  skin,
  lift,
  shown,
  hoverRow,
  hoverCol,
}: {
  piece: Piece;
  id: number;
  slot: number;
  layout: BoardLayout;
  skin: Skin;
  lift: Lift;
  shown: SharedValue<boolean>;
  hoverRow: SharedValue<number>;
  hoverCol: SharedValue<number>;
}) {
  const { cell, boardX, boardY } = layout;
  const opacity = useDerivedValue(() =>
    shown.value && lift.slot.value === slot && lift.id.value === id ? GHOST_OPACITY : 0,
  );
  const transform = useDerivedValue(() => [
    { translateX: boardX + hoverCol.value * cell },
    { translateY: boardY + hoverRow.value * cell },
  ]);
  return (
    <Group transform={transform} opacity={opacity}>
      <PieceBlocks cells={piece.cells} color={piece.color} size={cell} skin={skin} />
    </Group>
  );
}

function PlacedPop({
  pop,
  board,
  layout,
  skin,
  onDone,
}: {
  pop: Pop;
  board: Board;
  layout: BoardLayout;
  skin: Skin;
  onDone: (id: number) => void;
}) {
  const { cell, boardX, boardY } = layout;
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(POP_SCALE, { duration: POP_UP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: POP_DOWN_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(onDone, pop.id);
      }),
    );
  }, [scale, pop.id, onDone]);
  const { rows, cols } = shapeSize(pop.cells);
  const cx = boardX + (pop.col + cols / 2) * cell;
  const cy = boardY + (pop.row + rows / 2) * cell;
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: scale.value },
    { translateX: (-cols * cell) / 2 },
    { translateY: (-rows * cell) / 2 },
  ]);
  const n = board.size;
  const visible = pop.cells.filter(([r, c]) => board.cells[(pop.row + r) * n + pop.col + c] !== 0);
  if (visible.length === 0) return null;
  return (
    <Group transform={transform}>
      <PieceBlocks cells={visible} color={pop.color} size={cell} skin={skin} />
    </Group>
  );
}

function GameBoardView({
  layout,
  board,
  tray,
  clearing,
  storm,
  gift,
  disabled,
  onDrop,
  onRotate,
  hintSlots,
  theme,
  skin,
}: Props) {
  const { cell, boardX, boardY, boardSize, framePad, trayX, trayY, trayWidth, trayHeight, trayCell, slotWidth, liftGap } =
    layout;
  const n = board.size;
  const rest = trayCell / cell;

  const ids = useMemo(() => tray.map((p) => (p ? pieceId(p) : -1)), [tray]);
  const traySizes = useSharedValue<Size[]>([]);
  const trayShapes = useSharedValue<(Shape | null)[]>([]);
  const trayIds = useSharedValue<number[]>([]);
  const trayColors = useSharedValue<number[]>([]);
  const boardCells = useSharedValue<number[]>([]);
  const dragShape = useSharedValue<Shape>([]);
  const rainbow = useSharedValue(0);
  const twinkle = useSharedValue(1);
  const hasGift = gift !== undefined && board.cells[gift] !== 0;
  useEffect(() => {
    if (!hasGift) return;
    twinkle.value = withRepeat(withSequence(withTiming(0.25, { duration: GIFT_TWINKLE_MS }), withTiming(1, { duration: GIFT_TWINKLE_MS })), -1);
    return () => cancelAnimation(twinkle);
  }, [hasGift, twinkle]);
  const pressSlot = useSharedValue(-1);
  const activeSlot = useSharedValue(-1);
  const landing = useSharedValue(0);
  const dragSize = useSharedValue({ rows: 1, cols: 1 });
  const hoverRow = useSharedValue(-99);
  const hoverCol = useSharedValue(-99);
  const lift: Lift = {
    slot: useSharedValue(-1),
    id: useSharedValue(-1),
    fingerX: useSharedValue(0),
    fingerY: useSharedValue(0),
    offX: useSharedValue(0),
    offY: useSharedValue(0),
    scale: useSharedValue(rest),
  };

  useEffect(() => {
    traySizes.value = tray.map((p) => (p ? shapeSize(p.cells) : null));
    trayShapes.value = tray.map((p) => (p ? p.cells : null));
    trayIds.value = ids;
    trayColors.value = tray.map((p) => (p ? p.color : 0));
  }, [tray, ids, traySizes, trayShapes, trayIds, trayColors]);
  useEffect(() => {
    boardCells.value = board.cells.slice();
  }, [board, boardCells]);

  const stormT = useSharedValue(1);
  useEffect(() => {
    if (storm === null) return;
    stormT.value = 0;
    stormT.value = withTiming(1, { duration: STORM_MS, easing: Easing.linear });
  }, [storm, stormT]);
  const waveOf = (t: number) => {
    'worklet';
    const x = Math.min(1, Math.max(0, (t * STORM_MS - GUST_MS) / WAVE_MS));
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  };
  const stormLead = (t: number) => {
    'worklet';
    const band = boardSize * WAVE_BAND;
    return boardX - framePad + t * (boardSize + band + framePad * 2);
  };
  const oldClip = useDerivedValue(() => {
    const lead = stormT.value >= 1 ? boardX + boardSize + framePad : stormLead(waveOf(stormT.value));
    return Skia.XYWHRect(lead, boardY - framePad, Math.max(0, boardX + boardSize + framePad - lead), boardSize + framePad * 2);
  });
  const wave = useDerivedValue(() => {
    const raw = stormT.value;
    const t = waveOf(raw);
    return createPicture((canvas) => {
      if (raw >= 1) return;
      const ms = raw * STORM_MS;
      const gust = ms < GUST_MS ? ms / GUST_MS : Math.max(0, 1 - (ms - GUST_MS) / (WAVE_MS * 0.6));
      const areaX = boardX - framePad / 2;
      const areaY = boardY - framePad / 2;
      const areaS = boardSize + framePad;
      canvas.save();
      canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(areaX, areaY, areaS, areaS), framePad * 1.5, framePad * 1.5), ClipOp.Intersect, true);
      if (gust > 0) {
        const sky = Skia.Paint();
        sky.setColor(Skia.Color(STORM_SKY));
        sky.setAlphaf(GUST_DARK * gust);
        canvas.drawRect(Skia.XYWHRect(areaX, areaY, areaS, areaS), sky);
        const wind = Skia.Paint();
        wind.setColor(Skia.Color(FOAM));
        wind.setStyle(PaintStyle.Stroke);
        wind.setStrokeCap(StrokeCap.Round);
        wind.setStrokeWidth(cell * 0.06);
        const travel = ms / STORM_MS;
        for (let i = 0; i < GUST_STREAKS; i++) {
          const len = cell * (1.2 + ((i * 53) % 7) * 0.25);
          const y0 = areaY + (areaS * ((i * 37) % GUST_STREAKS + 0.5)) / GUST_STREAKS;
          const x0 = areaX - len + ((travel * 2.4 + (i * 0.29) % 1) % 1) * (areaS + len * 2);
          wind.setAlphaf(0.55 * gust);
          canvas.drawLine(x0, y0, x0 + len, y0 - len * 0.25, wind);
        }
      }
      canvas.restore();
      if (ms < GUST_MS) return;
      const band = boardSize * WAVE_BAND;
      const lead = stormLead(t);
      const top = boardY - framePad / 2;
      const bottom = boardY + boardSize + framePad / 2;
      const h = bottom - top;
      const amp = cell * 0.45;
      const phase = t * Math.PI * 4;
      const edge = (y: number) => lead + Math.sin(((y - top) / h) * Math.PI * 2 * WAVE_CRESTS + phase) * amp;
      const body = Skia.PathBuilder.Make().moveTo(lead - band, top);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const y = top + (h * i) / steps;
        body.lineTo(edge(y), y);
      }
      body.lineTo(lead - band, bottom).close();
      const fade = t > 0.85 ? (1 - t) / 0.15 : 1;
      const fill = Skia.Paint();
      fill.setShader(
        Skia.Shader.MakeLinearGradient(
          vec(lead - band, 0),
          vec(lead + amp, 0),
          [Skia.Color('rgba(143,211,255,0)'), Skia.Color(WAVE_LIGHT), Skia.Color(WAVE_DEEP)],
          [0, 0.55, 1],
          TileMode.Clamp,
        ),
      );
      fill.setAlphaf(0.92 * fade);
      canvas.save();
      canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(boardX - framePad / 2, top, boardSize + framePad, h), framePad * 1.5, framePad * 1.5), ClipOp.Intersect, true);
      canvas.drawPath(body.build(), fill);
      const foam = Skia.PathBuilder.Make();
      for (let i = 0; i <= steps; i++) {
        const y = top + (h * i) / steps;
        if (i === 0) foam.moveTo(edge(y), y);
        else foam.lineTo(edge(y), y);
      }
      const stroke = Skia.Paint();
      stroke.setColor(Skia.Color(FOAM));
      stroke.setStyle(PaintStyle.Stroke);
      stroke.setStrokeWidth(cell * 0.12);
      stroke.setStrokeCap(StrokeCap.Round);
      stroke.setAlphaf(0.9 * fade);
      canvas.drawPath(foam.build(), stroke);
      const dot = Skia.Paint();
      dot.setColor(Skia.Color(FOAM));
      for (let i = 0; i < 10; i++) {
        const y = top + (h * (i + 0.5)) / 10;
        const back = cell * (0.3 + ((i * 37) % 5) * 0.12);
        dot.setAlphaf(0.7 * fade);
        canvas.drawCircle(edge(y) - back, y, cell * (0.06 + (i % 3) * 0.03), dot);
        dot.setAlphaf(0.8 * fade);
        canvas.drawCircle(edge(y) + cell * (0.15 + (i % 4) * 0.1), y - cell * 0.2, cell * (0.04 + (i % 2) * 0.03), dot);
      }
      canvas.restore();
    });
  });
  const oldCells = useMemo(() => {
    if (!storm) return null;
    const before = storm.before;
    return before.cells.map((v, i) => {
      const x = boardX + (i % n) * cell;
      const y = boardY + Math.floor(i / n) * cell;
      return v === 0 ? (
        <EmptyCell key={i} x={x} y={y} size={cell} theme={theme} />
      ) : (
        <Block key={i} x={x} y={y} size={cell} color={v - 1} skin={skin} />
      );
    });
  }, [storm, boardX, boardY, cell, n, theme, skin]);

  const [pop, setPop] = useState<Pop | null>(null);
  const clearPop = useCallback((id: number) => setPop((p) => (p?.id === id ? null : p)), []);

  const sendHome = (slot: number) => {
    'worklet';
    const homeX = trayX + slotWidth * (slot + 0.5);
    const homeY = trayY + trayHeight / 2;
    lift.offX.value = withSpring(homeX - lift.fingerX.value, BACK_SPRING);
    lift.scale.value = withSpring(rest, BACK_SPRING);
    lift.offY.value = withSpring(homeY - lift.fingerY.value, BACK_SPRING, (finished) => {
      if (finished && lift.slot.value === slot && pressSlot.value < 0) lift.slot.value = -1;
    });
  };

  const handleDrop = (slot: number, row: number, col: number, cells: Shape, color: number) => {
    landing.value = 0;
    if (onDrop(slot, row, col)) {
      setPop({ id: ++lastPopId, cells, color, row, col });
      return;
    }
    sendHome(slot);
  };

  const [spinSlot, setSpinSlot] = useState<number | null>(null);
  const spin = useSharedValue(1);

  const handleTap = (slot: number) => {
    if (!onRotate(slot)) return;
    setSpinSlot(slot);
    spin.value = 0;
    spin.value = withTiming(1, { duration: SPIN_MS });
  };

  const hop = useSharedValue(0);
  const hinting = hintSlots.length > 0;
  useEffect(() => {
    if (!hinting) {
      cancelAnimation(hop);
      hop.value = 0;
      return;
    }
    hop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: HOP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: HOP_MS, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [hinting, hop]);

  const gesture = useMemo(() => {
    const slotAt = (x: number, y: number) => {
      'worklet';
      if (y < trayY - cell * 0.5 || y > trayY + trayHeight + cell * 0.5) return -1;
      const slot = Math.min(traySizes.value.length - 1, Math.max(0, Math.floor((x - trayX) / slotWidth)));
      return traySizes.value[slot] ? slot : -1;
    };
    const liftFor = (rows: number) => {
      'worklet';
      return (rows * cell) / 2 + liftGap;
    };

    const pan = Gesture.Pan()
      .minDistance(4)
      .enabled(!disabled)
      .onTouchesDown((e) => {
        const touch = e.allTouches[0];
        if (!touch || pressSlot.value >= 0 || landing.value) return;
        const slot = slotAt(touch.x, touch.y);
        if (slot < 0) return;
        const size = traySizes.value[slot]!;
        const id = trayIds.value[slot];
        const resumed = lift.slot.value === slot && lift.id.value === id;
        const prevX = resumed ? lift.fingerX.value + lift.offX.value : trayX + slotWidth * (slot + 0.5);
        const prevY = resumed ? lift.fingerY.value + lift.offY.value : trayY + trayHeight / 2;
        pressSlot.value = slot;
        dragSize.value = size;
        dragShape.value = trayShapes.value[slot]!;
        hoverRow.value = -99;
        hoverCol.value = -99;
        lift.fingerX.value = touch.x;
        lift.fingerY.value = touch.y;
        lift.offX.value = prevX - touch.x;
        lift.offY.value = prevY - touch.y;
        if (!resumed) lift.scale.value = rest;
        lift.slot.value = slot;
        lift.id.value = id;
        lift.offX.value = withSpring(0, LIFT_SPRING);
        lift.offY.value = withSpring(-liftFor(size.rows), LIFT_SPRING);
        lift.scale.value = withSpring(1, LIFT_SPRING);
      })
      .onStart(() => {
        if (pressSlot.value < 0) return;
        activeSlot.value = pressSlot.value;
        rainbow.value = 0;
        rainbow.value = withRepeat(withTiming(1, { duration: RAINBOW_MS, easing: Easing.linear }), -1, false);
      })
      .onUpdate((e) => {
        if (activeSlot.value < 0) return;
        lift.fingerX.value = e.x;
        lift.fingerY.value = e.y;
        const { rows, cols } = dragSize.value;
        const fc = (e.x - (cols * cell) / 2 - boardX) / cell;
        const fr = (e.y - liftFor(rows) - (rows * cell) / 2 - boardY) / cell;
        const r0 = Math.round(fr);
        const c0 = Math.round(fc);
        let row = r0;
        let col = c0;
        let best = SNAP_CELLS * SNAP_CELLS;
        let found = false;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = r0 + dr;
            const c = c0 + dc;
            const d = (r - fr) * (r - fr) + (c - fc) * (c - fc);
            if (d < best && fitsAt(boardCells.value, n, dragShape.value, r, c)) {
              best = d;
              row = r;
              col = c;
              found = true;
            }
          }
        }
        if (!found) {
          row = r0;
          col = c0;
        }
        if (row !== hoverRow.value) hoverRow.value = row;
        if (col !== hoverCol.value) hoverCol.value = col;
      })
      .onFinalize((e) => {
        const slot = pressSlot.value;
        if (slot < 0) return;
        pressSlot.value = -1;
        const minTravel = MIN_DROP_TRAVEL * cell;
        const moved = e.translationX * e.translationX + e.translationY * e.translationY >= minTravel * minTravel;
        const dragging = activeSlot.value === slot && moved;
        activeSlot.value = -1;
        cancelAnimation(rainbow);
        const row = hoverRow.value;
        const col = hoverCol.value;
        if (dragging && fitsAt(boardCells.value, n, dragShape.value, row, col)) {
          const { rows, cols } = dragSize.value;
          const shape = dragShape.value;
          const color = trayColors.value[slot];
          const easing = Easing.out(Easing.cubic);
          landing.value = 1;
          lift.offX.value = withTiming(boardX + (col + cols / 2) * cell - lift.fingerX.value, {
            duration: LAND_MS,
            easing,
          });
          lift.scale.value = withTiming(1, { duration: LAND_MS, easing });
          lift.offY.value = withTiming(
            boardY + (row + rows / 2) * cell - lift.fingerY.value,
            { duration: LAND_MS, easing },
            () => scheduleOnRN(handleDrop, slot, row, col, shape, color),
          );
          return;
        }
        sendHome(slot);
      });

    const tap = Gesture.Tap()
      .maxDistance(10)
      .enabled(!disabled)
      .onEnd((e, success) => {
        if (!success) return;
        const slot = slotAt(e.x, e.y);
        if (slot >= 0) scheduleOnRN(handleTap, slot);
      });

    return Gesture.Race(pan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, layout, onDrop, onRotate]);

  const preview = useDerivedValue(() =>
    activeSlot.value < 0 ? NO_PREVIEW : previewAt(boardCells.value, n, dragShape.value, hoverRow.value, hoverCol.value),
  );
  const ghostShown = useDerivedValue(() => preview.value.valid);

  const highlight = useDerivedValue(() => {
    const { rows, cols } = preview.value;
    const phase = rainbow.value;
    return createPicture((canvas) => {
      const boxes: Box[] = [
        ...rows.map((r): Box => [boardX, boardY + r * cell, boardSize, cell]),
        ...cols.map((c): Box => [boardX + c * cell, boardY, cell, boardSize]),
      ];
      drawRainbowBoxes(canvas, boxes, phase, [boardX, boardY, boardSize, boardSize], cell);
    });
  });

  const cells = useMemo(
    () =>
      board.cells.map((v, i) => {
        const x = boardX + (i % n) * cell;
        const y = boardY + Math.floor(i / n) * cell;
        return v === 0 ? (
          <EmptyCell key={i} x={x} y={y} size={cell} theme={theme} />
        ) : (
          <Block key={i} x={x} y={y} size={cell} color={v - 1} skin={skin} />
        );
      }),
    [board, boardX, boardY, cell, n, theme, skin],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width: layout.width, height: layout.height }}>
        <RainbowWarmup x={boardX} y={boardY} w={boardSize} h={boardSize} cell={cell} pad={framePad} />
        <BoardFrame x={boardX} y={boardY} width={boardSize} height={boardSize} pad={framePad} theme={theme} />
        {cells}
        {hasGift && (
          <GiftBow x={boardX + (gift % n) * cell} y={boardY + Math.floor(gift / n) * cell} size={cell} twinkle={twinkle} />
        )}
        {oldCells && <Group clip={oldClip}>{oldCells}</Group>}
        <Picture picture={wave} />
        {pop && <PlacedPop key={`pop-${pop.id}`} pop={pop} board={board} layout={layout} skin={skin} onDone={clearPop} />}

        <Picture picture={highlight} />
        {tray.map((piece, slot) =>
          piece ? (
            <TrayGhost
              key={ids[slot]}
              piece={piece}
              id={ids[slot]}
              slot={slot}
              layout={layout}
              skin={skin}
              lift={lift}
              shown={ghostShown}
              hoverRow={hoverRow}
              hoverCol={hoverCol}
            />
          ) : null,
        )}

        {clearing && (
          <JackpotBurst
            key={`burst-${clearing.id}`}
            clearing={clearing}
            skin={skin}
            cell={cell}
            boardX={boardX}
            boardY={boardY}
            boardSize={boardSize}
            framePad={framePad}
          />
        )}

        <RoundedRect
          x={trayX}
          y={trayY - cell * 0.2}
          width={trayWidth}
          height={trayHeight + cell * 0.4}
          r={framePad * 2}
          color={theme.boardBg}
          opacity={0.55}
        />
        <RoundedRect
          x={trayX + 1.5}
          y={trayY - cell * 0.2 + 1.5}
          width={trayWidth - 3}
          height={trayHeight + cell * 0.4 - 3}
          r={framePad * 2}
          color={theme.boardFrame}
          style="stroke"
          strokeWidth={3}
        />

        {tray.map((piece, slot) =>
          piece ? (
            <TrayPiece
              key={ids[slot]}
              piece={piece}
              id={ids[slot]}
              slot={slot}
              layout={layout}
              skin={skin}
              lift={lift}
              hop={hop}
              hint={hintSlots.includes(slot)}
              spin={spin}
              spinning={slot === spinSlot}
            />
          ) : null,
        )}
      </Canvas>
    </GestureDetector>
  );
}

export const GameBoard = memo(GameBoardView);
