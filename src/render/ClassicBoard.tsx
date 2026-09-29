import { Canvas, Group, rect, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import cfg from '../../config/classic.json';
import { ghostRow, pieceCells, type ClassicState, type ClearedCell } from '../core/classic/engine';
import { shapeCells, shapeColor, type ClassicShape } from '../core/classic/shapes';
import { normalize, shapeSize } from '../core/pieces';
import { Block, PieceBlocks } from './Block';
import type { ClassicLayout } from './classicLayout';
import { EmptyCell } from './EmptyCell';
import type { BoardTheme, Skin } from './theme';

export interface ClassicClear {
  id: number;
  cells: ClearedCell[];
}

interface Props {
  layout: ClassicLayout;
  state: ClassicState;
  clearing: ClassicClear | null;
  theme: BoardTheme;
  skin: Skin;
}

const CLEAR_MS = 320;

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

export function ClassicBoard({ layout, state, clearing, theme, skin }: Props) {
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
  useEffect(() => {
    if (!clearing) return;
    clearProgress.value = 0;
    clearProgress.value = withTiming(1, { duration: CLEAR_MS });
  }, [clearing, clearProgress]);
  const clearScale = useDerivedValue(() => [{ scale: 1 - clearProgress.value }]);
  const clearOpacity = useDerivedValue(() => 1 - clearProgress.value);
  const flashOpacity = useDerivedValue(() => Math.max(0, 0.7 - clearProgress.value * 1.6));

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
        {clearing && (
          <Group opacity={clearOpacity}>
            {clearing.cells.map(({ row, col, color: cc }) => {
              const x = boardX + col * cell;
              const y = yOf(row);
              return (
                <Group
                  key={`${clearing.id}-${row}-${col}`}
                  origin={{ x: x + cell / 2, y: y + cell / 2 }}
                  transform={clearScale}
                >
                  <Block x={x} y={y} size={cell} color={cc} skin={skin} />
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
