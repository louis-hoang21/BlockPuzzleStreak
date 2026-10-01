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
import { mulberry32 } from '../core/rng';
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
  useEffect(() => {
    clearProgress.value = withTiming(1, { duration: CLEAR_MS, easing: Easing.linear });
    if (clearing.lines >= 2) {
      frameFlash.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 180 }));
    }
  }, [clearing, clearProgress, frameFlash]);
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
        {activeCells.map(([r, c]) => (
          <Block key={`a${r}-${c}`} x={boardX + c * cell} y={yOf(r)} size={cell} color={color} skin={skin} />
        ))}
        <Picture picture={glow} />
      </Group>
      {clearing && (
        <ClassicBurst
          key={clearing.id}
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
