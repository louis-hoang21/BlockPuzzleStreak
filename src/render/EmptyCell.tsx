import { Circle, Group, LinearGradient, Rect, RoundedRect, rect, rrect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { BoardTheme } from './theme';

interface Props {
  x: number;
  y: number;
  size: number;
  theme: BoardTheme;
}

export function EmptyCell({ x, y, size, theme }: Props) {
  const inset = 2;
  const s = size - inset * 2;
  const x0 = x + inset;
  const y0 = y + inset;
  const r = size * 0.14;

  if (theme.emptyCellStyle !== 'sunset') {
    return <RoundedRect x={x0} y={y0} width={s} height={s} r={r} color={theme.emptyCell} />;
  }
  return <SunsetCell x0={x0} y0={y0} s={s} r={r} />;
}

function SunsetCell({ x0, y0, s, r }: { x0: number; y0: number; s: number; r: number }) {
  const horizon = y0 + s * 0.68;
  const sunR = s * 0.3;
  const cx = x0 + s / 2;
  const stripe = s * 0.045;
  const sunClip = useMemo(() => {
    return Skia.PathBuilder.Make().addCircle(cx, horizon, sunR).build();
  }, [cx, horizon, sunR]);
  return (
    <Group clip={rrect(rect(x0, y0, s, s), r, r)}>
      <Rect x={x0} y={y0} width={s} height={s}>
        <LinearGradient start={vec(x0, y0)} end={vec(x0, y0 + s)} colors={['#3B1E54', '#7A2E5C', '#C4553A']} />
      </Rect>
      <Group clip={rect(x0, y0, s, horizon - y0)}>
        <Circle cx={cx} cy={horizon} r={sunR}>
          <LinearGradient start={vec(cx, horizon - sunR)} end={vec(cx, horizon)} colors={['#FFE08A', '#FF8A3D']} />
        </Circle>
        <Group clip={sunClip}>
          <Rect x={x0} y={horizon - sunR * 0.42} width={s} height={stripe} color="#9A3A57" />
          <Rect x={x0} y={horizon - sunR * 0.2} width={s} height={stripe * 1.3} color="#9A3A57" />
        </Group>
      </Group>
      <Rect x={x0} y={horizon} width={s} height={y0 + s - horizon} color="#4A2150" opacity={0.85} />
      <Rect x={x0} y={horizon} width={s} height={1} color="#FFB36B" opacity={0.7} />
    </Group>
  );
}
