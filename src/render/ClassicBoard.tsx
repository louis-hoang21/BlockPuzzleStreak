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
import { ghostRow, pieceCells, type ClassicState, type ClearedCell } from '../core/classic/engine';
import { shapeCells, shapeColor, type ClassicShape } from '../core/classic/shapes';
import { normalize, shapeSize } from '../core/pieces';
import { Block, PieceBlocks } from './Block';
import type { ClassicLayout } from './classicLayout';
import { EmptyCell } from './EmptyCell';
import { drawRainbowBoxes, RAINBOW_MS, type Box } from './rainbow';
import type { BoardTheme, Skin } from './theme';

export interface ClassicClear {
  id: number;
  cells: ClearedCell[];
  rows: number[];
  lines: number;
}

interface Props {
  layout: ClassicLayout;
  state: ClassicState;
  clearing: ClassicClear | null;
  theme: BoardTheme;
  skin: Skin;
}

export const CLEAR_MS = 350;

const SWEEP_START_S = 0.03;
const POP_S = 0.1;
const SPARK_LIFE_S = 0.25;
const SPARKS_PER_CELL = 3;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  start: number;
}

function popDelay(col: number, cols: number): number {
  'worklet';
  const step = (CLEAR_MS / 1000 - SWEEP_START_S - POP_S) / Math.max(1, cols - 1);
  return SWEEP_START_S + col * step;
}

function ClearCell({
  x,
  y,
  size,
  color,
  skin,
  delay,
  progress,
}: {
  x: number;
  y: number;
  size: number;
  color: number;
  skin: Skin;
  delay: number;
  progress: SharedValue<number>;
}) {
  const phase = useDerivedValue(() => {
    const t = (progress.value * CLEAR_MS) / 1000;
    return t < delay ? -1 : Math.min(1, (t - delay) / POP_S);
  });
  const transform = useDerivedValue(() => {
    const p = phase.value;
    return [{ scale: p < 0 ? 1 : 1 + 0.25 * Math.sin(p * Math.PI) }];
  });
  const opacity = useDerivedValue(() => (phase.value < 0 ? 1 : 1 - phase.value));
  const flash = useDerivedValue(() => (phase.value < 0 ? 0 : 0.75 * (1 - phase.value)));
  return (
    <Group origin={{ x: x + size / 2, y: y + size / 2 }} transform={transform} opacity={opacity}>
      <Block x={x} y={y} size={size} color={color} skin={skin} />
      <RoundedRect
        x={x + 2}
        y={y + 2}
        width={size - 4}
        height={size - 4}
        r={size * 0.16}
        color="white"
        opacity={flash}
      />
    </Group>
  );
}

function clearOpacityValue(p: number): number {
  'worklet';
  return p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
}
const FLASH_COLOR = '#FFE680';

function MiniPiece({
  shape,
  x,
  y,
  w,
  h,
  size,
  skin,
  opacity,
}: {
  shape: ClassicShape;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  skin: Skin;
  opacity?: number;
}) {
  const cells = normalize(shapeCells(shape, 0));
  const { rows, cols } = shapeSize(cells);
  return (
    <Group transform={[{ translateX: x + (w - cols * size) / 2 }, { translateY: y + (h - rows * size) / 2 }]}>
      <PieceBlocks cells={cells} color={shapeColor(shape)} size={size} skin={skin} opacity={opacity} />
    </Group>
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

  const clearProgress = useSharedValue(1);
  const frameFlash = useSharedValue(0);
  useEffect(() => {
    if (!clearing) return;
    clearProgress.value = 0;
    clearProgress.value = withTiming(1, { duration: CLEAR_MS, easing: Easing.linear });
    if (clearing.lines >= 2) {
      frameFlash.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0.25, { duration: 140 }),
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 380 }),
      );
    }
  }, [clearing, clearProgress, frameFlash]);
  const sparks = useSharedValue<Spark[]>([]);
  const sweepRows = useSharedValue<number[]>([]);
  useEffect(() => {
    if (!clearing) return;
    const unit = cell / 38;
    const list: Spark[] = [];
    for (const { row, col } of clearing.cells) {
      for (let i = 0; i < SPARKS_PER_CELL; i++) {
        const angle = Math.random() * Math.PI * 2;
        list.push({
          x: boardX + (col + 0.5) * cell,
          y: boardY + (row - hidden + 0.5) * cell,
          vx: Math.cos(angle) * 70 * unit,
          vy: Math.sin(angle) * 70 * unit - 40 * unit,
          start: popDelay(col, cols),
        });
      }
    }
    sparks.value = list;
    sweepRows.value = clearing.rows.map((r) => boardY + (r - hidden) * cell);
  }, [clearing, sparks, sweepRows, boardX, boardY, cell, hidden, cols]);

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
  const clearBoxes = useSharedValue<Box[]>([]);
  const rainbow = useSharedValue(0);
  const glowing = previewRows.length > 0 || clearing !== null;
  useEffect(() => {
    previewBoxes.value = previewRows.map((r): Box => [boardX, boardY + (r - hidden) * cell, boardW, cell]);
  }, [previewRows, previewBoxes, boardX, boardY, boardW, cell, hidden]);
  useEffect(() => {
    clearBoxes.value = clearing
      ? clearing.rows.map((r): Box => [boardX, boardY + (r - hidden) * cell, boardW, cell])
      : [];
  }, [clearing, clearBoxes, boardX, boardY, boardW, cell, hidden]);
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
    const strength = clearProgress.value < 1 ? clearOpacityValue(clearProgress.value) : 0;
    const area: Box = [boardX, boardY, boardW, boardH];
    const pending = previewBoxes.value;
    const bursting = clearBoxes.value;
    const t = (clearProgress.value * CLEAR_MS) / 1000;
    const live = clearProgress.value < 1;
    const dots = sparks.value;
    const rowsY = sweepRows.value;
    return createPicture((canvas) => {
      drawRainbowBoxes(canvas, pending, phase, area, cell);
      if (strength > 0) drawRainbowBoxes(canvas, bursting, phase, area, cell, strength);
      if (!live) return;
      const sweepEnd = CLEAR_MS / 1000 - POP_S;
      if (t < sweepEnd + POP_S) {
        const sx = boardX + Math.min(1, t / sweepEnd) * boardW;
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
      }
      const dot = Skia.Paint();
      dot.setColor(Skia.Color('#FFFFFF'));
      for (const d of dots) {
        const life = t - d.start;
        if (life < 0 || life > SPARK_LIFE_S) continue;
        const k = life / SPARK_LIFE_S;
        dot.setAlphaf(1 - k);
        canvas.drawCircle(d.x + d.vx * life, d.y + d.vy * life, (cell / 12) * (1 - k * 0.5), dot);
      }
    });
  });

  const nextBoxH = sideCell * 2.6;

  return (
    <Canvas style={{ width: layout.width, height: layout.height }}>
      <RoundedRect
        x={boardX - framePad}
        y={boardY - framePad}
        width={boardW + framePad * 2}
        height={boardH + framePad * 2}
        r={framePad * 2}
        color={theme.boardFrame}
      />
      <RoundedRect
        x={boardX - framePad / 2}
        y={boardY - framePad / 2}
        width={boardW + framePad}
        height={boardH + framePad}
        r={framePad * 1.5}
        color={theme.boardBg}
      />
      {grid}
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

      <Group clip={rect(boardX, boardY, boardW, boardH)}>
        {ghostCells.map(([r, c]) => (
          <Block
            key={`g${r}-${c}`}
            x={boardX + c * cell}
            y={yOf(r)}
            size={cell}
            color={color}
            skin={skin}
            opacity={0.28}
          />
        ))}
        {activeCells.map(([r, c]) => (
          <Block key={`a${r}-${c}`} x={boardX + c * cell} y={yOf(r)} size={cell} color={color} skin={skin} />
        ))}
        {clearing &&
          clearing.cells.map(({ row, col, color: cc }) => (
            <ClearCell
              key={`${clearing.id}-${row}-${col}`}
              x={boardX + col * cell}
              y={yOf(row)}
              size={cell}
              color={cc}
              skin={skin}
              delay={popDelay(col, cols)}
              progress={clearProgress}
            />
          ))}
        <Picture picture={glow} />
      </Group>

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
        />
      ))}
    </Canvas>
  );
}

export const ClassicBoard = memo(ClassicBoardView);
