import {
  Circle,
  CornerPathEffect,
  Group,
  LinearGradient,
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
}

export function Block({ x, y, size, color, skin, opacity = 1 }: BlockProps) {
  const c = skin.colors[color % skin.colors.length];
  const inset = size * 0.05;
  const s = size - inset * 2;
  const r = size * 0.16;
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
            r={r * 0.6}
            color={c.light}
            opacity={0.35}
          />
        </Group>
      );
    case 'candy':
      return <PillBlock x0={x0} y0={y0} s={s} c={c} opacity={opacity} />;
    case 'gem':
      return <GemBlock x0={x0} y0={y0} s={s} c={c} opacity={opacity} />;
    case 'bevel':
    default:
      return (
        <Group opacity={opacity}>
          <RoundedRect x={x0} y={y0} width={s} height={s} r={r} color={c.dark} />
          <RoundedRect x={x0} y={y0} width={s} height={s - size * 0.1} r={r} color={c.base} />
          <RoundedRect
            x={x0 + size * 0.14}
            y={y0 + size * 0.09}
            width={s - size * 0.28}
            height={size * 0.13}
            r={size * 0.065}
            color={c.light}
            opacity={0.85}
          />
        </Group>
      );
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
      <Path path={backing} color="#0A0A19">
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
      <RoundedRect x={x0} y={y0} width={s} height={s} r={s * 0.14} color="#0A0A19" />
      <RoundedRect x={x0} y={y0} width={s} height={s} r={s * 0.14} color={c.dark} opacity={0.45} />
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
