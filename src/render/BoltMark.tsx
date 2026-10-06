import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const BOLT = '#FFD43B';
const BOLT_LIGHT = '#FFF3A6';
const BOLT_DARK = '#8A5A00';
const GLOW = '#FFF6C8';

const POINTS: readonly [number, number][] = [
  [0.58, 0.1],
  [0.26, 0.54],
  [0.47, 0.54],
  [0.38, 0.9],
  [0.74, 0.42],
  [0.53, 0.42],
  [0.66, 0.1],
];

interface Props {
  x: number;
  y: number;
  size: number;
  twinkle?: SharedValue<number>;
}

export function BoltMark({ x, y, size: q, twinkle }: Props) {
  const { bolt, shine } = useMemo(() => {
    const path = Skia.PathBuilder.Make();
    POINTS.forEach(([a, b], i) => {
      if (i === 0) path.moveTo(x + a * q, y + b * q);
      else path.lineTo(x + a * q, y + b * q);
    });
    path.close();
    const light = Skia.PathBuilder.Make()
      .moveTo(x + 0.58 * q, y + 0.16 * q)
      .lineTo(x + 0.36 * q, y + 0.48 * q)
      .lineTo(x + 0.44 * q, y + 0.48 * q)
      .close();
    return { bolt: path.build(), shine: light.build() };
  }, [x, y, q]);

  return (
    <Group>
      <Circle cx={x + q / 2} cy={y + q / 2} r={q * 0.36} color={GLOW} opacity={twinkle ?? 0.6} />
      <Path path={bolt} color={BOLT} />
      <Path path={shine} color={BOLT_LIGHT} />
      <Path path={bolt} color={BOLT_DARK} style="stroke" strokeWidth={q * 0.05} strokeJoin="round" />
    </Group>
  );
}
