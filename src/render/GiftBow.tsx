import { Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const RIBBON = '#E5243B';
const RIBBON_DARK = '#A3122A';
const RIBBON_LIGHT = '#FF6B7F';
const SPARKLE = '#FFF6C8';
const SPARKLES: readonly [number, number, number][] = [
  [0.12, 0.12, 0.06],
  [0.86, 0.18, 0.045],
  [0.82, 0.84, 0.05],
];

interface Props {
  x: number;
  y: number;
  size: number;
  twinkle?: SharedValue<number>;
}

export function GiftBow({ x, y, size: q, twinkle }: Props) {
  const cx = x + q / 2;
  const cy = y + q / 2;
  const w = q * 0.16;
  const { loops, tails, sparkles } = useMemo(() => {
    const loop = (sx: number) =>
      Skia.PathBuilder.Make()
        .moveTo(cx, cy)
        .cubicTo(cx + sx * q * 0.12, cy - q * 0.32, cx + sx * q * 0.42, cy - q * 0.22, cx + sx * q * 0.3, cy - q * 0.02)
        .close()
        .build();
    const tail = (sx: number) =>
      Skia.PathBuilder.Make()
        .moveTo(cx, cy)
        .lineTo(cx + sx * q * 0.22, cy + q * 0.3)
        .lineTo(cx + sx * q * 0.12, cy + q * 0.27)
        .lineTo(cx + sx * q * 0.06, cy + q * 0.33)
        .close()
        .build();
    const star = Skia.PathBuilder.Make();
    for (const [a, b, r] of SPARKLES) {
      const sx = x + a * q;
      const sy = y + b * q;
      const k = r * q;
      star
        .moveTo(sx, sy - k)
        .lineTo(sx + k * 0.25, sy - k * 0.25)
        .lineTo(sx + k, sy)
        .lineTo(sx + k * 0.25, sy + k * 0.25)
        .lineTo(sx, sy + k)
        .lineTo(sx - k * 0.25, sy + k * 0.25)
        .lineTo(sx - k, sy)
        .lineTo(sx - k * 0.25, sy - k * 0.25)
        .close();
    }
    return { loops: [loop(-1), loop(1)], tails: [tail(-1), tail(1)], sparkles: star.build() };
  }, [cx, cy, q, x, y]);

  return (
    <Group>
      <Rect x={cx - w / 2} y={y + q * 0.03} width={w} height={q * 0.91} color={RIBBON} />
      <Rect x={x + q * 0.03} y={cy - w / 2} width={q * 0.94} height={w} color={RIBBON} />
      <Rect x={cx - w / 2 + w * 0.15} y={y + q * 0.03} width={w * 0.25} height={q * 0.91} color={RIBBON_LIGHT} opacity={0.7} />
      <Rect x={x + q * 0.03} y={cy - w / 2 + w * 0.15} width={q * 0.94} height={w * 0.25} color={RIBBON_LIGHT} opacity={0.7} />
      {loops.map((p, i) => (
        <Group key={i}>
          <Path path={p} color={RIBBON} />
          <Path path={p} color={RIBBON_DARK} style="stroke" strokeWidth={q * 0.02} />
        </Group>
      ))}
      {tails.map((p, i) => (
        <Path key={i} path={p} color={RIBBON_DARK} />
      ))}
      <Circle cx={cx} cy={cy} r={q * 0.08} color={RIBBON} />
      <Circle cx={cx} cy={cy} r={q * 0.08} color={RIBBON_DARK} style="stroke" strokeWidth={q * 0.02} />
      <Circle cx={cx - q * 0.025} cy={cy - q * 0.025} r={q * 0.025} color={RIBBON_LIGHT} />
      <Path path={sparkles} color={SPARKLE} opacity={twinkle ?? 1} />
    </Group>
  );
}
