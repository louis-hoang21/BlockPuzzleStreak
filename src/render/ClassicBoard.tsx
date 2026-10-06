import {
  BlurMask,
  Canvas,
  createPicture,
  Group,
  Picture,
  rect,
  RoundedRect,
  Skia,
  TileMode,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import cfg from '../../config/classic.json';
import { ghostRow, pieceCells, type ClassicState, type ClearedCell, type GiftStorm } from '../core/classic/engine';
import { shapeCells, shapeColor, type ClassicShape } from '../core/classic/shapes';
import { normalize, shapeSize } from '../core/pieces';
import { mulberry32 } from '../core/rng';
import { Block, PieceBlocks } from './Block';
import type { ClassicLayout } from './classicLayout';
import { EmptyCell } from './EmptyCell';
import { BoltMark } from './BoltMark';
import { GiftBow } from './GiftBow';
import { drawRainbowBoxes, RAINBOW_MS, type Box } from './rainbow';
import { BoardFrame } from './BoardFrame';
import { RainbowWarmup } from './RainbowWarmup';
import type { BoardTheme, Skin } from './theme';

export interface ClassicClear {
  id: number;
  cells: ClearedCell[];
  rows: number[];
  lines: number;
  storm?: GiftStorm;
}

interface Props {
  layout: ClassicLayout;
  state: ClassicState;
  clearing: ClassicClear | null;
  theme: BoardTheme;
  skin: Skin;
}

export const CLEAR_MS = 240;

const SWEEP_START_S = 0.03;
const SWEEP_S = CLEAR_MS / 1000 - SWEEP_START_S - 0.05;
const SPARK_LIFE_S = 0.18;
const SPARKS_PER_CELL = 3;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  start: number;
}

function sweepX(t: number, boardX: number, boardW: number): number {
  'worklet';
  return boardX + Math.min(1, Math.max(0, (t - SWEEP_START_S) / SWEEP_S)) * boardW;
}

function clearOpacityValue(p: number): number {
  'worklet';
  return p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
}
const FLASH_COLOR = '#FFE680';
const STORM_COLOR = '#BFE3FF';
const STORM_FLASH_MS = 650;
const TWINKLE_MS = 600;
const GHOST_INSET = 3;
const GHOST_FILL = 0.1;
const GHOST_STROKE = 0.55;

function MiniPiece({
  shape,
  x,
  y,
  w,
  h,
  size,
  skin,
  opacity,
  gift = -1,
  bolt = -1,
  twinkle,
}: {
  shape: ClassicShape;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  skin: Skin;
  opacity?: number;
  gift?: number;
  bolt?: number;
  twinkle?: SharedValue<number>;
}) {
  const cells = normalize(shapeCells(shape, 0));
  const { rows, cols } = shapeSize(cells);
  const giftCell = gift >= 0 ? cells[gift] : undefined;
  const boltCell = bolt >= 0 ? cells[bolt] : undefined;
  return (
    <Group transform={[{ translateX: x + (w - cols * size) / 2 }, { translateY: y + (h - rows * size) / 2 }]}>
      <PieceBlocks cells={cells} color={shapeColor(shape)} size={size} skin={skin} opacity={opacity} />
      {giftCell && (
        <Group opacity={opacity ?? 1}>
          <GiftBow x={giftCell[1] * size} y={giftCell[0] * size} size={size} twinkle={twinkle} />
        </Group>
      )}
      {boltCell && (
        <Group opacity={opacity ?? 1}>
          <BoltMark x={boltCell[1] * size} y={boltCell[0] * size} size={size} twinkle={twinkle} />
        </Group>
      )}
    </Group>
  );
}

function ClassicBurst({
  clearing,
  skin,
  cell,
  boardX,
  boardY,
  boardW,
  boardH,
  framePad,
  hidden,
  cols,
  rainbow,
}: {
  clearing: ClassicClear;
  skin: Skin;
  cell: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  framePad: number;
  hidden: number;
  cols: number;
  rainbow: SharedValue<number>;
}) {
  const clearProgress = useSharedValue(0);
  const frameFlash = useSharedValue(0);
  const stormFlash = useSharedValue(0);
  useEffect(() => {
    if (clearing.storm) {
      stormFlash.value = withSequence(
        withTiming(0.85, { duration: STORM_FLASH_MS * 0.2 }),
        withTiming(0, { duration: STORM_FLASH_MS * 0.8, easing: Easing.out(Easing.cubic) }),
      );
    }
    clearProgress.value = withTiming(1, { duration: CLEAR_MS, easing: Easing.linear });
    if (clearing.lines >= 2) {
      frameFlash.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 180 }));
    }
  }, [clearing, clearProgress, frameFlash, stormFlash]);
  const sparks = useMemo(() => {
    const rand = mulberry32(clearing.id * 2654435761);
    const unit = cell / 38;
    const list: Spark[] = [];
    for (const { row, col } of clearing.cells) {
      for (let i = 0; i < SPARKS_PER_CELL; i++) {
        const angle = rand() * Math.PI * 2;
        list.push({
          x: boardX + (col + 0.5) * cell,
          y: boardY + (row - hidden + 0.5) * cell,
          vx: Math.cos(angle) * 70 * unit,
          vy: Math.sin(angle) * 70 * unit - 40 * unit,
          start: SWEEP_START_S + ((col + 0.5) / cols) * SWEEP_S,
        });
      }
    }
    return list;
  }, [clearing, boardX, boardY, cell, hidden, cols]);
  const rowsY = useMemo(() => clearing.rows.map((r) => boardY + (r - hidden) * cell), [clearing, boardY, hidden, cell]);
  const boxes = useMemo(
    () => clearing.rows.map((r): Box => [boardX, boardY + (r - hidden) * cell, boardW, cell]),
    [clearing, boardX, boardY, boardW, cell, hidden],
  );
  const cellsClip = useDerivedValue(() => {
    const sx = sweepX((clearProgress.value * CLEAR_MS) / 1000, boardX, boardW);
    return Skia.XYWHRect(sx, boardY, Math.max(0, boardX + boardW - sx), boardH);
  });
  const burst = useDerivedValue(() => {
    const p = clearProgress.value;
    const t = (p * CLEAR_MS) / 1000;
    const phase = rainbow.value;
    return createPicture((canvas) => {
      if (p >= 1) return;
      drawRainbowBoxes(canvas, boxes, phase, [boardX, boardY, boardW, boardH], cell, clearOpacityValue(p));
      const sx = sweepX(t, boardX, boardW);
      const band = cell * 1.2;
      const shader = Skia.Shader.MakeLinearGradient(
        vec(sx - band, 0),
        vec(sx, 0),
        [Skia.Color('rgba(255,255,255,0)'), Skia.Color('rgba(255,255,255,0.9)')],
        null,
        TileMode.Clamp,
      );
      const paint = Skia.Paint();
      paint.setShader(shader);
      for (const y of rowsY) canvas.drawRect(Skia.XYWHRect(sx - band, y, band + 4, cell), paint);
      const dot = Skia.Paint();
      dot.setColor(Skia.Color('#FFFFFF'));
      for (const d of sparks) {
        const life = t - d.start;
        if (life < 0 || life > SPARK_LIFE_S) continue;
        const k = life / SPARK_LIFE_S;
        dot.setAlphaf(1 - k);
        canvas.drawCircle(d.x + d.vx * life, d.y + d.vy * life, (cell / 12) * (1 - k * 0.5), dot);
      }
    });
  });
  return (
    <>
      <Group opacity={frameFlash}>
        <RoundedRect
          x={boardX - framePad / 2}
          y={boardY - framePad / 2}
          width={boardW + framePad}
          height={boardH + framePad}
          r={framePad * 1.5}
          color={FLASH_COLOR}
          style="stroke"
          strokeWidth={framePad}
        >
          <BlurMask blur={framePad} style="solid" />
        </RoundedRect>
      </Group>
      <Group clip={cellsClip}>
        {clearing.cells.map(({ row, col, color }) => (
          <Block
            key={`${row}-${col}`}
            x={boardX + col * cell}
            y={boardY + (row - hidden) * cell}
            size={cell}
            color={color}
            skin={skin}
          />
        ))}
      </Group>
      <Picture picture={burst} />
      {clearing.storm && (
        <Group opacity={stormFlash}>
          {clearing.storm.rows
            .filter((r) => r >= hidden)
            .map((r) => (
              <RoundedRect key={`r${r}`} x={boardX} y={boardY + (r - hidden) * cell} width={boardW} height={cell} r={cell * 0.2} color={STORM_COLOR}>
                <BlurMask blur={cell * 0.3} style="solid" />
              </RoundedRect>
            ))}
          {clearing.storm.cols.map((c) => (
            <RoundedRect key={`c${c}`} x={boardX + c * cell} y={boardY} width={cell} height={boardH} r={cell * 0.2} color={STORM_COLOR}>
              <BlurMask blur={cell * 0.3} style="solid" />
            </RoundedRect>
          ))}
        </Group>
      )}
    </>
  );
}

function ClassicBoardView({ layout, state, clearing, theme, skin }: Props) {
  const { cell, boardX, boardY, boardW, boardH, framePad, sideX, sideW, sideCell, holdY, nextY, boxH } = layout;
  const { cols, hidden } = state;
  const yOf = (row: number) => boardY + (row - hidden) * cell;

  const grid = useMemo(
    () =>
      state.cells.map((v, i) => {
        const row = Math.floor(i / cols);
        if (row < hidden) return null;
        const x = boardX + (i % cols) * cell;
        const y = boardY + (row - hidden) * cell;
        return v === 0 ? (
          <EmptyCell key={i} x={x} y={y} size={cell} theme={theme} />
        ) : (
          <Block key={i} x={x} y={y} size={cell} color={v - 1} skin={skin} />
        );
      }),
    [state.cells, cols, hidden, boardX, boardY, cell, theme, skin],
  );

  const active = state.active;
  const ghost = active ? ghostRow(state) : 0;
  const activeCells = active ? pieceCells(active) : [];
  const ghostCells = active ? pieceCells({ ...active, row: ghost }) : [];
  const color = active ? shapeColor(active.shape) : 0;
  const ghostColor = skin.colors[color % skin.colors.length].base;

  const previewRows = useMemo(() => {
    if (!active) return [];
    const filled = state.cells.slice();
    for (const [r, c] of ghostCells) if (r >= 0) filled[r * cols + c] = 1;
    const rows: number[] = [];
    for (let r = hidden; r < state.rows; r++) {
      let full = true;
      for (let c = 0; c < cols; c++) if (filled[r * cols + c] === 0) full = false;
      if (full) rows.push(r);
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cells, active?.shape, active?.rot, active?.col, ghost, cols, hidden, state.rows]);

  const previewBoxes = useSharedValue<Box[]>([]);
  const rainbow = useSharedValue(0);
  const glowing = previewRows.length > 0 || clearing !== null;
  useEffect(() => {
    previewBoxes.value = previewRows.map((r): Box => [boardX, boardY + (r - hidden) * cell, boardW, cell]);
  }, [previewRows, previewBoxes, boardX, boardY, boardW, cell, hidden]);
  useEffect(() => {
    if (!glowing) {
      cancelAnimation(rainbow);
      return;
    }
    rainbow.value = 0;
    rainbow.value = withRepeat(withTiming(1, { duration: RAINBOW_MS, easing: Easing.linear }), -1, false);
  }, [glowing, rainbow]);
  const glow = useDerivedValue(() => {
    const phase = rainbow.value;
    const area: Box = [boardX, boardY, boardW, boardH];
    const pending = previewBoxes.value;
    return createPicture((canvas) => {
      drawRainbowBoxes(canvas, pending, phase, area, cell);
    });
  });

  const twinkle = useSharedValue(1);
  useEffect(() => {
    twinkle.value = withRepeat(withSequence(withTiming(0.25, { duration: TWINKLE_MS }), withTiming(1, { duration: TWINKLE_MS })), -1);
  }, [twinkle]);
  const giftIndex = state.gift ?? -1;
  const boardGift =
    giftIndex >= 0 && Math.floor(giftIndex / cols) >= hidden && state.cells[giftIndex] !== 0
      ? { x: boardX + (giftIndex % cols) * cell, y: yOf(Math.floor(giftIndex / cols)) }
      : null;
  const activeGiftCell = active && (state.activeGift ?? -1) >= 0 ? activeCells[state.activeGift ?? 0] : undefined;
  const queueGifts = state.queueGifts ?? [];
  const boltIndex = state.bolt ?? -1;
  const boardBolt =
    boltIndex >= 0 && Math.floor(boltIndex / cols) >= hidden && state.cells[boltIndex] !== 0
      ? { x: boardX + (boltIndex % cols) * cell, y: yOf(Math.floor(boltIndex / cols)) }
      : null;
  const activeBoltCell = active && (state.activeBolt ?? -1) >= 0 ? activeCells[state.activeBolt ?? 0] : undefined;
  const queueBolts = state.queueBolts ?? [];

  const nextBoxH = sideCell * 2.6;

  return (
    <Canvas style={{ width: layout.width, height: layout.height }}>
      <RainbowWarmup x={boardX} y={boardY} w={boardW} h={boardH} cell={cell} pad={framePad} />
      <BoardFrame x={boardX} y={boardY} width={boardW} height={boardH} pad={framePad} theme={theme} />
      {grid}
      <Group clip={rect(boardX, boardY, boardW, boardH)}>
        {ghostCells.map(([r, c]) => (
          <Group key={`g${r}-${c}`}>
            <RoundedRect
              x={boardX + c * cell + GHOST_INSET}
              y={yOf(r) + GHOST_INSET}
              width={cell - GHOST_INSET * 2}
              height={cell - GHOST_INSET * 2}
              r={cell * 0.16}
              color={ghostColor}
              opacity={GHOST_FILL}
            />
            <RoundedRect
              x={boardX + c * cell + GHOST_INSET}
              y={yOf(r) + GHOST_INSET}
              width={cell - GHOST_INSET * 2}
              height={cell - GHOST_INSET * 2}
              r={cell * 0.16}
              color={ghostColor}
              opacity={GHOST_STROKE}
              style="stroke"
              strokeWidth={2}
            />
          </Group>
        ))}
        {boardGift && <GiftBow x={boardGift.x} y={boardGift.y} size={cell} twinkle={twinkle} />}
        {boardBolt && <BoltMark x={boardBolt.x} y={boardBolt.y} size={cell} twinkle={twinkle} />}
        {activeCells.map(([r, c]) => (
          <Block key={`a${r}-${c}`} x={boardX + c * cell} y={yOf(r)} size={cell} color={color} skin={skin} />
        ))}
        {activeGiftCell && (
          <GiftBow x={boardX + activeGiftCell[1] * cell} y={yOf(activeGiftCell[0])} size={cell} twinkle={twinkle} />
        )}
        {activeBoltCell && (
          <BoltMark x={boardX + activeBoltCell[1] * cell} y={yOf(activeBoltCell[0])} size={cell} twinkle={twinkle} />
        )}
        <Picture picture={glow} />
      </Group>
      {clearing && (
        <ClassicBurst
          key={`burst-${clearing.id}`}
          clearing={clearing}
          skin={skin}
          cell={cell}
          boardX={boardX}
          boardY={boardY}
          boardW={boardW}
          boardH={boardH}
          framePad={framePad}
          hidden={hidden}
          cols={cols}
          rainbow={rainbow}
        />
      )}

      <RoundedRect
        x={sideX - framePad}
        y={holdY - framePad / 2}
        width={sideW + framePad * 2}
        height={boxH + framePad}
        r={framePad * 1.5}
        color={theme.boardBg}
        opacity={0.75}
      />
      {state.hold && (
        <MiniPiece
          shape={state.hold}
          x={sideX}
          y={holdY}
          w={sideW}
          h={boxH}
          size={sideCell}
          skin={skin}
          opacity={state.holdUsed ? 0.35 : 1}
          gift={state.holdGift ?? -1}
          bolt={state.holdBolt ?? -1}
          twinkle={twinkle}
        />
      )}
      <RoundedRect
        x={sideX - framePad}
        y={nextY - framePad / 2}
        width={sideW + framePad * 2}
        height={nextBoxH * cfg.preview + framePad}
        r={framePad * 1.5}
        color={theme.boardBg}
        opacity={0.75}
      />
      {state.queue.slice(0, cfg.preview).map((shape, i) => (
        <MiniPiece
          key={`${i}-${shape}`}
          shape={shape}
          x={sideX}
          y={nextY + i * nextBoxH}
          w={sideW}
          h={nextBoxH}
          size={sideCell}
          skin={skin}
          gift={queueGifts[i] ?? -1}
          bolt={queueBolts[i] ?? -1}
          twinkle={twinkle}
        />
      ))}
    </Canvas>
  );
}

export const ClassicBoard = memo(ClassicBoardView);
