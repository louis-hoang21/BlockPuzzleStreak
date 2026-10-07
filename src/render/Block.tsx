import {
  Circle,
  CornerPathEffect,
  Group,
  LinearGradient,
  Oval,
  Path,
  rect,
  RoundedRect,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Shape } from '../core/pieces';
import type { BlockColor, Skin } from './theme';

interface BlockProps {
  x: number;
  y: number;
  size: number;
  color: number;
  skin: Skin;
  opacity?: number;
  worn?: boolean;
}

export function Block({ x, y, size, color, skin, opacity = 1, worn = false }: BlockProps) {
  const c = skin.colors[color % skin.colors.length];
  const inset = size * 0.015;
  const s = size - inset * 2;
  const r = size * 0.04;
  const x0 = x + inset;
  const y0 = y + inset;

  switch (skin.style) {
    case 'flower':
      return <FlowerBlock x0={x0} y0={y0} s={s} c={c} opacity={opacity} />;
    case 'neon':
      return (
        <Group opacity={opacity}>
          <RoundedRect x={x0} y={y0} width={s} height={s} r={r} color="#0B0E22" />
          <RoundedRect
            x={x0 + 1.5}
            y={y0 + 1.5}
            width={s - 3}
            height={s - 3}
            r={r}
            color={c.base}
            style="stroke"
            strokeWidth={3}
          />
          <RoundedRect
            x={x0 + size * 0.2}
            y={y0 + size * 0.2}
            width={s - size * 0.4}
            height={s - size * 0.4}
            r={size * 0.06}
            color={c.light}
            opacity={0.35}
          />
        </Group>
      );
    case 'candy':
      return <PillBlock x0={x0} y0={y0} s={s} c={c} opacity={opacity} />;
    case 'wood':
      return <WoodBlock x={x} y={y} size={size} c={c} opacity={opacity} />;
    case 'brick':
      return <BrickBlock x={x} y={y} size={size} c={c} opacity={opacity} />;
    case 'sushi':
      return <SushiBlock x={x} y={y} size={size} c={c} opacity={opacity} />;
    case 'toast':
      return <ToastBlock x={x} y={y} size={size} c={c} opacity={opacity} worn={worn} />;
    case 'gem':
      return <GemBlock x0={x0} y0={y0} s={s} c={c} opacity={opacity} />;
    case 'bevel':
    default: {
      const bi = size * 0.015;
      const bs = size - bi * 2;
      const br = size * 0.04;
      const bx = x + bi;
      const by = y + bi;
      return (
        <Group opacity={opacity}>
          <RoundedRect x={bx} y={by} width={bs} height={bs} r={br} color={c.dark} />
          <RoundedRect x={bx} y={by} width={bs} height={bs - size * 0.1} r={br} color={c.base} />
          <RoundedRect
            x={bx + size * 0.12}
            y={by + size * 0.08}
            width={bs - size * 0.24}
            height={size * 0.12}
            r={size * 0.04}
            color={c.light}
            opacity={0.85}
          />
        </Group>
      );
    }
  }
}

interface StyleProps {
  x0: number;
  y0: number;
  s: number;
  c: BlockColor;
  opacity: number;
}

function polygon(points: [number, number][]): SkPath {
  return Skia.PathBuilder.Make()
    .addPoly(
      points.map(([x, y]) => vec(x, y)),
      true,
    )
    .build();
}

interface CellProps {
  x: number;
  y: number;
  size: number;
  c: BlockColor;
  opacity: number;
}

function WoodBlock({ x, y, size, c, opacity }: CellProps) {
  const inset = size * 0.015;
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  const fx = x0 + size * 0.06;
  const fy = y0 + size * 0.05;
  const fw = s - size * 0.12;
  const fh = s - size * 0.13;
  const grain = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    [0.24, 0.5, 0.76].forEach((t, k) => {
      const gy = fy + fh * t;
      const amp = fh * (k % 2 === 0 ? 0.06 : -0.05);
      b.moveTo(fx + fw * 0.08, gy);
      b.cubicTo(fx + fw * 0.35, gy - amp, fx + fw * 0.62, gy + amp, fx + fw * 0.92, gy);
    });
    b.addOval(rect(fx + fw * 0.56, fy + fh * 0.31, fw * 0.18, fh * 0.1));
    return b.build();
  }, [fx, fy, fw, fh]);

  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={size * 0.05} color={c.dark} />
      <RoundedRect x={fx} y={fy} width={fw} height={fh} r={size * 0.03}>
        <LinearGradient start={vec(fx, fy)} end={vec(fx, fy + fh)} colors={[c.light, c.base]} />
      </RoundedRect>
      <Path
        path={grain}
        color={c.dark}
        style="stroke"
        strokeWidth={Math.max(1, size * 0.03)}
        strokeCap="round"
        opacity={0.45}
      />
    </Group>
  );
}

function BrickBlock({ x, y, size, c, opacity }: CellProps) {
  const inset = size * 0.015;
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  const g = Math.max(1, size * 0.05);
  const h = (s - g * 3) / 2;
  const half = (s - g * 3) / 2;
  const bricks: [number, number, number][] = [
    [x0 + g, y0 + g, s - g * 2],
    [x0 + g, y0 + g * 2 + h, half],
    [x0 + g * 2 + half, y0 + g * 2 + h, half],
  ];
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={size * 0.04} color={c.dark} />
      {bricks.map(([bx, by, bw], i) => (
        <Group key={i}>
          <RoundedRect x={bx} y={by} width={bw} height={h} r={size * 0.025} color={c.base} />
          <RoundedRect x={bx} y={by} width={bw} height={h * 0.22} r={size * 0.02} color={c.light} opacity={0.75} />
          <RoundedRect x={bx} y={by + h * 0.8} width={bw} height={h * 0.2} r={size * 0.02} color={c.dark} opacity={0.4} />
          <Circle cx={bx + bw * 0.3} cy={by + h * 0.55} r={size * 0.02} color={c.dark} opacity={0.45} />
          <Circle cx={bx + bw * 0.72} cy={by + h * 0.45} r={size * 0.016} color={c.dark} opacity={0.45} />
        </Group>
      ))}
    </Group>
  );
}

function SushiBlock({ x, y, size, c, opacity }: CellProps) {
  const inset = size * 0.015;
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  const cx = x0 + s / 2;
  const cy = y0 + s / 2;
  const rice = s * 0.07;
  const fr = s * 0.24;
  const grains: [number, number, number][] = [
    [0.2, 0.26, 0],
    [0.76, 0.22, 1],
    [0.8, 0.72, 0],
    [0.24, 0.78, 1],
  ];
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={size * 0.04} color="#D3CAB3" />
      <RoundedRect x={x0} y={y0} width={s} height={s - rice} r={size * 0.04} color="#F4F0E4" />
      {grains.map(([gx, gy, k], i) => (
        <Oval
          key={i}
          x={x0 + s * gx - s * (k ? 0.03 : 0.05)}
          y={y0 + s * gy - s * (k ? 0.05 : 0.03)}
          width={s * (k ? 0.06 : 0.1)}
          height={s * (k ? 0.1 : 0.06)}
          color="#DCD5C2"
        />
      ))}
      <Circle cx={cx} cy={cy + s * 0.02} r={fr} color={c.dark} />
      <Circle cx={cx} cy={cy} r={fr} color={c.base} />
      <Circle cx={cx - fr * 0.3} cy={cy - fr * 0.32} r={fr * 0.32} color={c.light} opacity={0.8} />
    </Group>
  );
}

const TOAST_CRUST = { top: '#B5763C', bottom: '#8A5427' };
const WORN_CRUST = { top: '#E6BC86', bottom: '#C4935E' };

function ToastBlock({ x, y, size, c, opacity, worn }: CellProps & { worn: boolean }) {
  const crust = worn ? WORN_CRUST : TOAST_CRUST;
  const inset = size * 0.015;
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  const b = s * 0.09;
  const jx = x0 + s * 0.2;
  const jy = y0 + s * 0.2;
  const jw = s * 0.6;
  const jh = s * 0.52;
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={size * 0.07} color={crust.bottom} />
      <RoundedRect x={x0} y={y0} width={s} height={s * 0.94} r={size * 0.07} color={crust.top} />
      <RoundedRect x={x0 + b} y={y0 + b} width={s - b * 2} height={s - b * 2.3} r={s * 0.12}>
        <LinearGradient start={vec(x0, y0 + b)} end={vec(x0, y0 + s - b)} colors={['#F7E2B4', '#E9C688']} />
      </RoundedRect>
      <RoundedRect x={jx} y={jy} width={jw} height={jh} r={s * 0.16} color={c.base} />
      <Circle cx={jx + jw * 0.72} cy={jy + jh} r={s * 0.08} color={c.base} />
      <Circle cx={jx + jw * 0.3} cy={jy + jh * 0.98} r={s * 0.055} color={c.base} />
      <RoundedRect x={jx} y={jy + jh * 0.82} width={jw} height={jh * 0.18} r={s * 0.08} color={c.dark} opacity={0.35} />
      <RoundedRect
        x={jx + jw * 0.14}
        y={jy + jh * 0.14}
        width={jw * 0.4}
        height={jh * 0.16}
        r={jh * 0.08}
        color={c.light}
        opacity={0.85}
      />
    </Group>
  );
}

function GemBlock({ x0, y0, s, c, opacity }: StyleProps) {
  const { backing, facets, center } = useMemo(() => {
    const cx = x0 + s / 2;
    const cy = y0 + s / 2;
    const outer = s * 0.47;
    const ring = s * 0.33;
    const inner = s * 0.26;
    const half = (s * 0.06) / 2;
    const dirs = Array.from({ length: 6 }, (_, i) => {
      const a = ((-90 + 60 * i) * Math.PI) / 180;
      return { x: Math.cos(a), y: Math.sin(a) };
    });
    const at = (i: number, r: number, side: number): [number, number] => {
      const d = dirs[i % 6];
      return [cx + d.x * r - d.y * side, cy + d.y * r + d.x * side];
    };
    const facetBuilder = Skia.PathBuilder.Make();
    for (let i = 0; i < 6; i++) {
      facetBuilder.addPoly(
        [at(i, outer, half), at(i + 1, outer, -half), at(i + 1, ring, -half), at(i, ring, half)].map(([x, y]) =>
          vec(x, y),
        ),
        true,
      );
    }
    const facets = facetBuilder.build();
    const center = polygon(dirs.map((_, i) => at(i, inner, 0)));
    const backing = polygon(dirs.map((_, i) => at(i, s * 0.52, 0)));
    return { backing, facets, center };
  }, [x0, y0, s]);

  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={s * 0.04} color={c.dark} />
      <RoundedRect x={x0} y={y0} width={s} height={s * 0.94} r={s * 0.04} color={c.base} opacity={0.35} />
      <Path path={backing} color="#0A0A19" opacity={0.55}>
        <CornerPathEffect r={s * 0.1} />
      </Path>
      <Path path={backing} color={c.dark} opacity={0.65}>
        <CornerPathEffect r={s * 0.1} />
      </Path>
      <Path path={facets} color={c.base}>
        <CornerPathEffect r={s * 0.05} />
      </Path>
      <Path path={center} color={c.light}>
        <CornerPathEffect r={s * 0.06} />
      </Path>
    </Group>
  );
}

function PillBlock({ x0, y0, s, c, opacity }: StyleProps) {
  const cx = x0 + s / 2;
  const cy = y0 + s / 2;
  const len = s * 0.98;
  const thick = s * 0.42;
  const px = cx - len / 2;
  const py = cy - thick / 2;
  const r = thick / 2;
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={s * 0.04} color={c.dark} />
      <RoundedRect x={x0} y={y0} width={s} height={s * 0.94} r={s * 0.04} color={c.base} opacity={0.35} />
      <Group transform={[{ rotate: -Math.PI / 4 }]} origin={vec(cx, cy)}>
        <RoundedRect x={px} y={py + s * 0.05} width={len} height={thick} r={r} color="black" opacity={0.3} />
        <Group clip={rect(px, py, len / 2, thick)}>
          <RoundedRect x={px} y={py} width={len} height={thick} r={r} color={c.base} />
        </Group>
        <Group clip={rect(cx, py, len / 2, thick)}>
          <RoundedRect x={px} y={py} width={len} height={thick} r={r} color={c.light} />
        </Group>
        <RoundedRect x={cx - s * 0.012} y={py} width={s * 0.024} height={thick} r={0} color={c.dark} opacity={0.5} />
        <RoundedRect
          x={px + r * 0.6}
          y={py + thick * 0.16}
          width={len - r * 1.2}
          height={thick * 0.2}
          r={thick * 0.1}
          color="white"
          opacity={0.55}
        />
      </Group>
    </Group>
  );
}

function FlowerBlock({ x0, y0, s, c, opacity }: StyleProps) {
  const cx = x0 + s / 2;
  const cy = y0 + s / 2;
  const off = s * 0.22;
  const pr = s * 0.28;
  const petals: [number, number][] = [
    [cx, cy - off],
    [cx + off, cy],
    [cx, cy + off],
    [cx - off, cy],
  ];
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x0} y={y0} width={s} height={s} r={s * 0.04} color={c.dark} />
      <RoundedRect x={x0} y={y0} width={s} height={s * 0.94} r={s * 0.04} color={c.base} opacity={0.45} />
      {petals.map(([px, py], i) => (
        <Circle key={i} cx={px} cy={py + s * 0.03} r={pr} color={c.dark} opacity={0.5} />
      ))}
      {petals.map(([px, py], i) => (
        <Circle key={`p${i}`} cx={px} cy={py} r={pr}>
          <LinearGradient start={vec(px, py - pr)} end={vec(px, py + pr)} colors={[c.light, c.base]} />
        </Circle>
      ))}
      <Circle cx={cx} cy={cy} r={s * 0.13} color="white" opacity={0.95} />
      <Circle cx={cx - pr * 0.35} cy={cy - off - pr * 0.35} r={s * 0.055} color="white" opacity={0.8} />
    </Group>
  );
}

interface PieceProps {
  cells: Shape;
  color: number;
  size: number;
  skin: Skin;
  opacity?: number;
}

export function PieceBlocks({ cells, color, size, skin, opacity }: PieceProps) {
  return (
    <>
      {cells.map(([r, c]) => (
        <Block key={`${r}-${c}`} x={c * size} y={r * size} size={size} color={color} skin={skin} opacity={opacity} />
      ))}
    </>
  );
}
