import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  rect,
  rrect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { mulberry32 } from '../core/rng';

const PLANETS = [
  { x: 0.08, y: 0.1, r: 0.09, color: '#F2A65A', stripe: '#F8C98E', ring: true },
  { x: 0.4, y: 0.07, r: 0.07, color: '#E88B84', stripe: '#F3B2AC', ring: true },
  { x: 0.93, y: 0.2, r: 0.05, color: '#E48AC4', stripe: '#F0B6DA', ring: false },
  { x: 0.84, y: 0.62, r: 0.1, color: '#F2A65A', stripe: '#F8C98E', ring: true },
  { x: 0.2, y: 0.9, r: 0.08, color: '#E48AC4', stripe: '#F0B6DA', ring: true },
  { x: 0.62, y: 0.95, r: 0.09, color: '#8DD86A', stripe: '#B6EA9C', ring: false },
  { x: 0.06, y: 0.52, r: 0.035, color: '#6FC7C9', stripe: '#9EDBDC', ring: false },
];

const CLOUDS = [
  { cx: 0.02, cy: 0.78, color: '#8FD3E8' },
  { cx: 0.16, cy: 0.84, color: '#9C9BE8' },
  { cx: 0.98, cy: 0.34, color: '#8FD3E8' },
  { cx: 0.84, cy: 0.3, color: '#9C9BE8' },
];

function star5(cx: number, cy: number, r: number) {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  return b.close().build();
}

export function SpaceBackdrop({ opacity = 0.55 }: { opacity?: number }) {
  const { width: w, height: h } = useWindowDimensions();

  const stars = useMemo(() => {
    const rng = mulberry32(20260928);
    return Array.from({ length: 110 }, () => ({
      x: rng() * w,
      y: rng() * h,
      r: 0.5 + rng() * 1.4,
      glow: rng() < 0.08,
    }));
  }, [w, h]);

  const shootingStar = useMemo(() => star5(w * 0.58, h * 0.33, 9), [w, h]);
  const trail = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(w * 0.6, h * 0.325)
        .lineTo(w * 0.72, h * 0.25)
        .build(),
    [w, h],
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={opacity}>
        {CLOUDS.map((c, i) => (
          <Group key={i}>
            {[0, 1, 2, 3].map((k) => (
              <Circle
                key={k}
                cx={w * c.cx + (k - 1.5) * w * 0.07}
                cy={h * c.cy + (k % 2) * w * 0.05}
                r={w * (0.1 + (k % 3) * 0.02)}
                color={c.color}
                opacity={0.8}>
                <BlurMask blur={12} style="normal" />
              </Circle>
            ))}
          </Group>
        ))}

        {stars.map((s, i) =>
          s.glow ? (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r * 2.2} color="white" opacity={0.9}>
              <BlurMask blur={3} style="normal" />
            </Circle>
          ) : (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="white" opacity={0.75} />
          ),
        )}

        {PLANETS.map((p, i) => {
          const cx = w * p.x;
          const cy = h * p.y;
          const r = w * p.r;
          return (
            <Group key={i}>
              <Group clip={rrect(rect(cx - r, cy - r, r * 2, r * 2), r, r)}>
                <Circle cx={cx} cy={cy} r={r} color={p.color} />
                <Oval
                  x={cx - r * 1.2}
                  y={cy - r * 0.35}
                  width={r * 2.4}
                  height={r * 0.35}
                  color={p.stripe}
                  opacity={0.7}
                />
                <Oval
                  x={cx - r * 1.2}
                  y={cy + r * 0.2}
                  width={r * 2.4}
                  height={r * 0.25}
                  color={p.stripe}
                  opacity={0.6}
                />
              </Group>
              {p.ring && (
                <Oval
                  x={cx - r * 1.55}
                  y={cy - r * 0.32}
                  width={r * 3.1}
                  height={r * 0.64}
                  color="white"
                  style="stroke"
                  strokeWidth={Math.max(1.5, r * 0.07)}
                  opacity={0.9}
                  transform={[{ rotate: -0.25 }]}
                  origin={vec(cx, cy)}
                />
              )}
            </Group>
          );
        })}

        <Path path={trail} style="stroke" strokeWidth={2.5} strokeCap="round">
          <LinearGradient
            start={vec(w * 0.6, h * 0.325)}
            end={vec(w * 0.72, h * 0.25)}
            colors={['#FFD84D', 'rgba(255,216,77,0)']}
          />
        </Path>
        <Path path={shootingStar} color="#FFD84D" />
      </Group>
    </Canvas>
  );
}
