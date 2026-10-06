import { FillType, Group, LinearGradient, Path, RoundedRect, rect, rrect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { BoardTheme } from './theme';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  pad: number;
  theme: BoardTheme;
}

const WOOD_LIGHT = '#C98A4E';
const WOOD_MID = '#A86A35';
const WOOD_DARK = '#7A4520';
const WOOD_SHADOW = '#3E2210';
const GRAIN = '#5E3418';
const GRAIN_LINES = 9;

export function BoardFrame({ x, y, width, height, pad, theme }: Props) {
  if (theme.frameStyle === 'wood') return <WoodFrame x={x} y={y} width={width} height={height} pad={pad} theme={theme} />;
  return (
    <>
      <RoundedRect
        x={x - pad}
        y={y - pad}
        width={width + pad * 2}
        height={height + pad * 2}
        r={pad * 2}
        color={theme.boardFrame}
      />
      <RoundedRect
        x={x - pad / 2}
        y={y - pad / 2}
        width={width + pad}
        height={height + pad}
        r={pad * 1.5}
        color={theme.boardBg}
      />
    </>
  );
}

function WoodFrame({ x, y, width, height, pad, theme }: Props) {
  const ox = x - pad;
  const oy = y - pad;
  const ow = width + pad * 2;
  const oh = height + pad * 2;
  const outerR = pad * 1.6;
  const lip = pad * 0.35;
  const ix = x - lip;
  const iy = y - lip;
  const iw = width + lip * 2;
  const ih = height + lip * 2;
  const innerR = pad * 0.8;

  const { ring, grain } = useMemo(() => {
    const ringBuilder = Skia.PathBuilder.Make().setFillType(FillType.EvenOdd);
    ringBuilder.addRRect(rrect(rect(ox, oy, ow, oh), outerR, outerR));
    ringBuilder.addRRect(rrect(rect(ix, iy, iw, ih), innerR, innerR));
    const ringPath = ringBuilder.build();
    const grainBuilder = Skia.PathBuilder.Make();
    for (let i = 0; i < GRAIN_LINES; i++) {
      const gy = oy + (oh * (i + 0.5)) / GRAIN_LINES;
      const wave = pad * 0.25 * (i % 2 === 0 ? 1 : -1);
      grainBuilder.moveTo(ox, gy);
      grainBuilder.cubicTo(ox + ow * 0.3, gy + wave, ox + ow * 0.7, gy - wave, ox + ow, gy);
    }
    for (let i = 0; i < 3; i++) {
      const gx = ox + pad * (0.25 + i * 0.25);
      grainBuilder.moveTo(gx, oy);
      grainBuilder.lineTo(gx, oy + oh);
      grainBuilder.moveTo(ox + ow - pad * (0.25 + i * 0.25), oy);
      grainBuilder.lineTo(ox + ow - pad * (0.25 + i * 0.25), oy + oh);
    }
    return { ring: ringPath, grain: grainBuilder.build() };
  }, [ox, oy, ow, oh, outerR, ix, iy, iw, ih, innerR, pad]);

  return (
    <Group>
      <RoundedRect x={ox} y={oy + pad * 0.35} width={ow} height={oh} r={outerR} color={WOOD_SHADOW} opacity={0.45} />
      <Path path={ring}>
        <LinearGradient start={vec(ox, oy)} end={vec(ox + ow, oy + oh)} colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]} />
      </Path>
      <Group clip={ring}>
        <Path path={grain} style="stroke" strokeWidth={1} color={GRAIN} opacity={0.35} />
      </Group>
      <RoundedRect
        x={ox + 1}
        y={oy + 1}
        width={ow - 2}
        height={oh - 2}
        r={outerR}
        style="stroke"
        strokeWidth={1.5}
        color="#F0C38A"
        opacity={0.5}
      />
      <RoundedRect x={ix} y={iy} width={iw} height={ih} r={innerR}>
        <LinearGradient start={vec(ix, iy)} end={vec(ix, iy + ih)} colors={[WOOD_SHADOW, theme.boardBg]} positions={[0, 0.08]} />
      </RoundedRect>
      <RoundedRect
        x={ix}
        y={iy}
        width={iw}
        height={ih}
        r={innerR}
        style="stroke"
        strokeWidth={2}
        color={WOOD_SHADOW}
        opacity={0.6}
      />
    </Group>
  );
}
