import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const FLAME = '#FF5A1F';
const FLAME_CORE = '#FFC23D';
const FLAME_DARK = '#7A1E00';
const FLAME_GLOW = '#FFD1B8';

const MIX = '#B66DFF';
const MIX_DARK = '#3D1470';
const MIX_GLOW = '#E9D4FF';

interface Props {
  x: number;
  y: number;
  size: number;
  twinkle?: SharedValue<number>;
}

export function FlameMark({ x, y, size: q, twinkle }: Props) {
  const { outer, inner } = useMemo(() => {
    const at = (a: number, b: number) => [x + a * q, y + b * q] as const;
    const o = Skia.PathBuilder.Make();
    o.moveTo(...at(0.5, 0.12));
    o.cubicTo(...at(0.62, 0.3), ...at(0.8, 0.42), ...at(0.78, 0.62));
    o.cubicTo(...at(0.77, 0.8), ...at(0.64, 0.9), ...at(0.5, 0.9));
    o.cubicTo(...at(0.36, 0.9), ...at(0.23, 0.8), ...at(0.22, 0.62));
    o.cubicTo(...at(0.21, 0.48), ...at(0.32, 0.4), ...at(0.36, 0.3));
    o.cubicTo(...at(0.4, 0.42), ...at(0.46, 0.44), ...at(0.48, 0.4));
    o.cubicTo(...at(0.5, 0.3), ...at(0.46, 0.2), ...at(0.5, 0.12));
    o.close();
    const i = Skia.PathBuilder.Make();
    i.moveTo(...at(0.5, 0.48));
    i.cubicTo(...at(0.58, 0.58), ...at(0.64, 0.66), ...at(0.62, 0.74));
    i.cubicTo(...at(0.6, 0.82), ...at(0.55, 0.85), ...at(0.5, 0.85));
    i.cubicTo(...at(0.44, 0.85), ...at(0.39, 0.82), ...at(0.38, 0.74));
    i.cubicTo(...at(0.37, 0.64), ...at(0.45, 0.58), ...at(0.5, 0.48));
    i.close();
    return { outer: o.build(), inner: i.build() };
  }, [x, y, q]);

  return (
    <Group>
      <Circle cx={x + q / 2} cy={y + q * 0.56} r={q * 0.36} color={FLAME_GLOW} opacity={twinkle ?? 0.6} />
      <Path path={outer} color={FLAME} />
      <Path path={inner} color={FLAME_CORE} />
      <Path path={outer} color={FLAME_DARK} style="stroke" strokeWidth={q * 0.05} strokeJoin="round" />
    </Group>
  );
}

export function MixMark({ x, y, size: q, twinkle }: Props) {
  const { arcs, heads } = useMemo(() => {
    const cx = x + q / 2;
    const cy = y + q / 2;
    const r = q * 0.25;
    const oval = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
    const a = Skia.PathBuilder.Make();
    a.addArc(oval, 200, 130);
    a.addArc(oval, 20, 130);
    const h = Skia.PathBuilder.Make();
    const head = (deg: number) => {
      const t = (deg * Math.PI) / 180;
      const px = cx + r * Math.cos(t);
      const py = cy + r * Math.sin(t);
      const tx = -Math.sin(t);
      const ty = Math.cos(t);
      const nx = Math.cos(t);
      const ny = Math.sin(t);
      const len = q * 0.14;
      const wide = q * 0.11;
      h.moveTo(px + tx * len, py + ty * len);
      h.lineTo(px + nx * wide, py + ny * wide);
      h.lineTo(px - nx * wide, py - ny * wide);
      h.close();
    };
    head(330);
    head(150);
    return { arcs: a.build(), heads: h.build() };
  }, [x, y, q]);

  return (
    <Group>
      <Circle cx={x + q / 2} cy={y + q / 2} r={q * 0.38} color={MIX_GLOW} opacity={twinkle ?? 0.6} />
      <Path path={arcs} color={MIX_DARK} style="stroke" strokeWidth={q * 0.15} strokeCap="round" />
      <Path path={heads} color={MIX_DARK} style="stroke" strokeWidth={q * 0.08} strokeJoin="round" />
      <Path path={arcs} color={MIX} style="stroke" strokeWidth={q * 0.09} strokeCap="round" />
      <Path path={heads} color={MIX} />
    </Group>
  );
}
