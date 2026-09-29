import { BlurMask, Canvas, createPicture, Group, Picture, RoundedRect } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Board } from '../core/board';
import type { Piece } from '../core/pieceGenerator';
import { shapeSize, type Shape } from '../core/pieces';
import { Block, PieceBlocks } from './Block';
import { EmptyCell } from './EmptyCell';
import { drawRainbowBoxes, RAINBOW_MS, type Box } from './rainbow';
import { slotCenter, type BoardLayout } from './layout';
import type { BoardTheme, Skin } from './theme';

export interface ClearingCell {
  row: number;
  col: number;
  color: number;
}

export interface ClearEvent {
  id: number;
  cells: ClearingCell[];
  lines: number;
}

interface Props {
  layout: BoardLayout;
  board: Board;
  tray: readonly (Piece | null)[];
  clearing: ClearEvent | null;
  disabled: boolean;
  onDrop: (slot: number, row: number, col: number) => boolean;
  onRotate: (slot: number) => boolean;
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

const CLEAR_MS = 320;
const SPIN_MS = 180;
const FLASH_COLOR = '#FFE680';

function GameBoardView({ layout, board, tray, clearing, disabled, onDrop, onRotate, theme, skin }: Props) {
  const { cell, boardX, boardY, boardSize, framePad, trayX, trayY, trayWidth, trayHeight, trayCell, slotWidth, lift } =
    layout;
  const n = board.size;

  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const traySizes = useSharedValue<Size[]>([]);
  const trayShapes = useSharedValue<(Shape | null)[]>([]);
  const boardCells = useSharedValue<number[]>([]);
  const dragShape = useSharedValue<Shape>([]);
  const landed = useSharedValue(0);
  const dragOpacity = useSharedValue(1);
  const rainbow = useSharedValue(0);
  const activeSlot = useSharedValue(-1);
  const dragSize = useSharedValue({ rows: 1, cols: 1 });
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(0.5);
  const hoverRow = useSharedValue(-99);
  const hoverCol = useSharedValue(-99);

  useEffect(() => {
    traySizes.value = tray.map((p) => (p ? shapeSize(p.cells) : null));
    trayShapes.value = tray.map((p) => (p ? p.cells : null));
  }, [tray, traySizes, trayShapes]);
  useEffect(() => {
    boardCells.value = board.cells.slice();
  }, [board, boardCells]);

  const handleDrop = (slot: number, row: number, col: number) => {
    if (onDrop(slot, row, col)) {
      setDragSlot(null);
      return;
    }
    const home = slotCenter(layout, slot);
    landed.value = 0;
    dragOpacity.value = 1;
    dragX.value = withTiming(home.x, { duration: 160 });
    dragY.value = withTiming(home.y, { duration: 160 });
    dragScale.value = withTiming(0.5, { duration: 160 }, (finished) => {
      if (finished) scheduleOnRN(setDragSlot, null);
    });
  };

  const [spinSlot, setSpinSlot] = useState<number | null>(null);
  const spin = useSharedValue(1);
  const spinCenter = useSharedValue({ x: 0, y: 0 });

  const handleTap = (slot: number) => {
    if (!onRotate(slot)) return;
    spinCenter.value = slotCenter(layout, slot);
    setSpinSlot(slot);
    spin.value = 0;
    spin.value = withTiming(1, { duration: SPIN_MS });
  };

  const spinTransform = useDerivedValue(() => [
    { translateX: spinCenter.value.x },
    { translateY: spinCenter.value.y },
    { rotate: (-(1 - spin.value) * Math.PI) / 2 },
    { translateX: -spinCenter.value.x },
    { translateY: -spinCenter.value.y },
  ]);

  const gesture = useMemo(() => {
    const slotAt = (x: number, y: number) => {
      'worklet';
      if (y < trayY - cell * 0.5 || y > trayY + trayHeight + cell * 0.5) return -1;
      const slot = Math.min(traySizes.value.length - 1, Math.max(0, Math.floor((x - trayX) / slotWidth)));
      return traySizes.value[slot] ? slot : -1;
    };

    const pan = Gesture.Pan()
      .minDistance(6)
      .enabled(!disabled)
      .onStart((e) => {
        const slot = slotAt(e.x - e.translationX, e.y - e.translationY);
        if (slot < 0) return;
        activeSlot.value = slot;
        dragSize.value = traySizes.value[slot]!;
        dragShape.value = trayShapes.value[slot]!;
        landed.value = 0;
        dragOpacity.value = 1;
        rainbow.value = 0;
        rainbow.value = withRepeat(withTiming(1, { duration: RAINBOW_MS, easing: Easing.linear }), -1, false);
        dragX.value = trayX + slotWidth * (slot + 0.5);
        dragY.value = trayY + trayHeight / 2;
        dragX.value = withTiming(e.x, { duration: 90 });
        dragY.value = withTiming(e.y - lift, { duration: 90 });
        dragScale.value = withTiming(1, { duration: 120 });
        hoverRow.value = -99;
        hoverCol.value = -99;
        scheduleOnRN(setDragSlot, slot);
      })
      .onUpdate((e) => {
        if (activeSlot.value < 0) return;
        dragX.value = e.x;
        dragY.value = e.y - lift;
        const { rows, cols } = dragSize.value;
        const col = Math.round((e.x - (cols * cell) / 2 - boardX) / cell);
        const row = Math.round((e.y - lift - (rows * cell) / 2 - boardY) / cell);
        if (row !== hoverRow.value) hoverRow.value = row;
        if (col !== hoverCol.value) hoverCol.value = col;
      })
      .onFinalize(() => {
        const slot = activeSlot.value;
        if (slot < 0) return;
        const fits = previewAt(boardCells.value, n, dragShape.value, hoverRow.value, hoverCol.value).valid;
        activeSlot.value = -1;
        cancelAnimation(rainbow);
        if (fits) {
          landed.value = 1;
          dragOpacity.value = 0;
          scheduleOnRN(handleDrop, slot, hoverRow.value, hoverCol.value);
          return;
        }
        dragX.value = withTiming(trayX + slotWidth * (slot + 0.5), { duration: 160 });
        dragY.value = withTiming(trayY + trayHeight / 2, { duration: 160 });
        dragScale.value = withTiming(0.5, { duration: 160 }, (finished) => {
          if (finished) scheduleOnRN(setDragSlot, null);
        });
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

  const dragPiece = dragSlot !== null ? tray[dragSlot] : null;

  const preview = useDerivedValue(() =>
    activeSlot.value < 0 ? NO_PREVIEW : previewAt(boardCells.value, n, dragShape.value, hoverRow.value, hoverCol.value),
  );
  const ghostTransform = useDerivedValue(() => [
    { translateX: boardX + hoverCol.value * cell },
    { translateY: boardY + hoverRow.value * cell },
  ]);
  const ghostOpacity = useDerivedValue(() => (landed.value ? 1 : preview.value.valid ? 0.4 : 0));
  const dragPieceOpacity = useDerivedValue(() => dragOpacity.value);

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

  const dragTransform = useDerivedValue(() => [
    { translateX: dragX.value },
    { translateY: dragY.value },
    { scale: dragScale.value },
    { translateX: (-dragSize.value.cols * cell) / 2 },
    { translateY: (-dragSize.value.rows * cell) / 2 },
  ]);

  const clearProgress = useSharedValue(1);
  const frameFlash = useSharedValue(0);
  useEffect(() => {
    if (!clearing) return;
    clearProgress.value = 0;
    clearProgress.value = withTiming(1, { duration: CLEAR_MS });
    if (clearing.lines >= 2) {
      frameFlash.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0.25, { duration: 140 }),
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 380 }),
      );
    }
  }, [clearing, clearProgress, frameFlash]);
  const clearScale = useDerivedValue(() => [{ scale: 1 - clearProgress.value }]);
  const clearOpacity = useDerivedValue(() => 1 - clearProgress.value);
  const flashOpacity = useDerivedValue(() => Math.max(0, 0.7 - clearProgress.value * 1.6));

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
        <RoundedRect
          x={boardX - framePad}
          y={boardY - framePad}
          width={boardSize + framePad * 2}
          height={boardSize + framePad * 2}
          r={framePad * 2}
          color={theme.boardFrame}
        />
        <RoundedRect
          x={boardX - framePad / 2}
          y={boardY - framePad / 2}
          width={boardSize + framePad}
          height={boardSize + framePad}
          r={framePad * 1.5}
          color={theme.boardBg}
        />
        {cells}

        <Picture picture={highlight} />
        {dragPiece && (
          <Group transform={ghostTransform} opacity={ghostOpacity}>
            <PieceBlocks cells={dragPiece.cells} color={dragPiece.color} size={cell} skin={skin} />
          </Group>
        )}

        {clearing && (
          <Group opacity={clearOpacity}>
            {clearing.cells.map(({ row, col, color }) => {
              const x = boardX + col * cell;
              const y = boardY + row * cell;
              return (
                <Group
                  key={`${clearing.id}-${row}-${col}`}
                  origin={{ x: x + cell / 2, y: y + cell / 2 }}
                  transform={clearScale}
                >
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
        )}

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

        {tray.map((piece, slot) => {
          if (!piece || slot === dragSlot) return null;
          const { rows, cols } = shapeSize(piece.cells);
          const center = slotCenter(layout, slot);
          const blocks = (
            <Group
              transform={[
                { translateX: center.x - (cols * trayCell) / 2 },
                { translateY: center.y - (rows * trayCell) / 2 },
              ]}
            >
              <PieceBlocks cells={piece.cells} color={piece.color} size={trayCell} skin={skin} />
            </Group>
          );
          return slot === spinSlot ? (
            <Group key={slot} transform={spinTransform}>
              {blocks}
            </Group>
          ) : (
            <Group key={slot}>{blocks}</Group>
          );
        })}

        {dragPiece && (
          <Group transform={dragTransform} opacity={dragPieceOpacity}>
            <PieceBlocks cells={dragPiece.cells} color={dragPiece.color} size={cell} skin={skin} />
          </Group>
        )}
      </Canvas>
    </GestureDetector>
  );
}

export const GameBoard = memo(GameBoardView);
