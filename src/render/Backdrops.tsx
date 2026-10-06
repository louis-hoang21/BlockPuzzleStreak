import {
  BlurMask,
  Canvas,
  Circle,
  CornerPathEffect,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { mulberry32 } from '../core/rng';
import { SpaceBackdrop } from './SpaceBackdrop';

export type BackdropKind = 'night' | 'forest' | 'ocean' | 'space' | 'kitchen';

const FAINT = 0.55;

function ThemeBackdropView({ kind }: { kind: BackdropKind }) {
  switch (kind) {
    case 'night':
      return <NightBackdrop />;
    case 'forest':
      return <ForestBackdrop />;
    case 'ocean':
      return <OceanBackdrop />;
    case 'space':
      return <SpaceBackdrop />;
    case 'kitchen':
      return <KitchenBackdrop />;
  }
}

function sparklePath(cx: number, cy: number, r: number): SkPath {
  const k = r * 0.22;
  return Skia.PathBuilder.Make()
    .moveTo(cx, cy - r)
    .lineTo(cx + k, cy - k)
    .lineTo(cx + r, cy)
    .lineTo(cx + k, cy + k)
    .lineTo(cx, cy + r)
    .lineTo(cx - k, cy + k)
    .lineTo(cx - r, cy)
    .lineTo(cx - k, cy - k)
    .close()
    .build();
}

function useStars(count: number, seed: number) {
  const { width: w, height: h } = useWindowDimensions();
  return useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => ({ x: rng() * w, y: rng() * h, r: 0.5 + rng() * 1.3 }));
  }, [count, seed, w, h]);
}

function NightBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const stars = useStars(150, 101);
  const extras = useMemo(() => {
    const rng = mulberry32(102);
    const sparkles = Array.from({ length: 10 }, () => sparklePath(rng() * w, rng() * h * 0.9, 4 + rng() * 4));
    const pts = [
      [0.12, 0.2],
      [0.2, 0.16],
      [0.29, 0.19],
      [0.33, 0.27],
      [0.24, 0.3],
    ].map(([x, y]) => [x * w, y * h] as const);
    const b = Skia.PathBuilder.Make().moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) b.lineTo(x, y);
    b.lineTo(pts[2][0], pts[2][1]);
    const moon = { x: w * 0.82, y: h * 0.12, r: w * 0.09 };
    const moonCut = Skia.PathBuilder.Make()
      .addCircle(moon.x + moon.r * 0.45, moon.y - moon.r * 0.25, moon.r * 0.88)
      .build();
    return { sparkles, constellation: b.build(), pts, moon, moonCut };
  }, [w, h]);
  const { moon } = extras;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={FAINT}>
        {[0.05, 0.3, 0.6, 0.9].map((x, i) => (
          <Circle key={i} cx={w * x} cy={h * (0.95 + (i % 2) * 0.03)} r={w * 0.22} color="#3A4378">
            <BlurMask blur={18} style="normal" />
          </Circle>
        ))}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="white" opacity={0.75} />
        ))}
        {extras.sparkles.map((p, i) => (
          <Path key={i} path={p} color="#FFF3C4" />
        ))}
        <Path path={extras.constellation} color="#AFC3FF" style="stroke" strokeWidth={1} opacity={0.6} />
        {extras.pts.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.2} color="#DDE6FF" />
        ))}
        <Circle cx={moon.x} cy={moon.y} r={moon.r * 1.5} color="#FFE9A8" opacity={0.35}>
          <BlurMask blur={16} style="normal" />
        </Circle>
        <Group clip={extras.moonCut} invertClip>
          <Circle cx={moon.x} cy={moon.y} r={moon.r} color="#FFE9A8" />
        </Group>
      </Group>
    </Canvas>
  );
}

function pinePath(x: number, baseY: number, height: number, width: number): SkPath {
  const b = Skia.PathBuilder.Make();
  for (let k = 0; k < 3; k++) {
    const top = baseY - height + k * height * 0.26;
    const bottom = top + height * 0.46;
    const half = (width / 2) * (0.55 + k * 0.22);
    b.moveTo(x, top)
      .lineTo(x + half, bottom)
      .lineTo(x - half, bottom)
      .close();
  }
  b.addRect({ x: x - width * 0.06, y: baseY - height * 0.22, width: width * 0.12, height: height * 0.22 });
  return b.build();
}

function ForestBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const stars = useStars(45, 201);
  const scene = useMemo(() => {
    const rng = mulberry32(202);
    const layers = [
      { color: '#4E9E6C', base: h * 0.97, size: 0.16, count: 10 },
      { color: '#3A8458', base: h * 1.0, size: 0.21, count: 8 },
      { color: '#2A6B45', base: h * 1.03, size: 0.27, count: 6 },
    ].map((l, li) => {
      const b = Skia.PathBuilder.Make();
      for (let i = 0; i < l.count; i++) {
        const x = (i + 0.5 + (rng() - 0.5) * 0.5 + (li % 2) * 0.35) * (w / l.count);
        const height = h * l.size * (0.85 + rng() * 0.3);
        b.addPath(pinePath(x, l.base, height, height * 0.5));
      }
      return { color: l.color, path: b.build() };
    });
    const fireflies = Array.from({ length: 26 }, () => ({
      x: rng() * w,
      y: h * (0.25 + rng() * 0.65),
      r: 1.5 + rng() * 1.5,
    }));
    return { layers, fireflies };
  }, [w, h]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={0.75}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y * 0.5} r={s.r} color="white" opacity={0.6} />
        ))}
        <Circle cx={w * 0.2} cy={h * 0.11} r={w * 0.14} color="#E8F5C8" opacity={0.3}>
          <BlurMask blur={18} style="normal" />
        </Circle>
        <Circle cx={w * 0.2} cy={h * 0.11} r={w * 0.07} color="#EEF7D6" />
        {scene.layers.map((l, i) => (
          <Path key={i} path={l.path} color={l.color} />
        ))}
        {scene.fireflies.map((f, i) => (
          <Circle key={i} cx={f.x} cy={f.y} r={f.r * 2} color="#D8F27A" opacity={0.9}>
            <BlurMask blur={3} style="normal" />
          </Circle>
        ))}
      </Group>
    </Canvas>
  );
}

const DOLPHIN = Skia.Path.MakeFromSVGString(
  'M100 30 C96 28 92 27 88 26 C86 18 78 13 69 14 C64 14 60 15 56 16 C54 10 50 5 43 3 C46 8 47 13 45 18 ' +
    'C35 21 25 26 17 31 C13 27 7 24 0 25 C4 29 7 32 9 34 C6 37 2 41 0 44 C7 43 12 40 16 37 ' +
    'C30 42 52 44 70 40 C80 38 88 35 94 33 C97 32 99 31 100 30 Z ' +
    'M62 41 C60 47 56 51 50 53 C56 48 59 44 60 40 Z',
)!;
const DOLPHIN_BELLY = Skia.Path.MakeFromSVGString('M93 33 C82 36 62 39 40 39 C54 44 76 42 93 34 Z')!;

function starfishPath(cx: number, cy: number, r: number, rotate: number): SkPath {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = rotate - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  return b.close().build();
}

function fishParts(x: number, y: number, size: number) {
  const body = Skia.PathBuilder.Make()
    .addOval({ x: x - size, y: y - size * 0.6, width: size * 2, height: size * 1.2 })
    .build();
  const tail = Skia.PathBuilder.Make()
    .moveTo(x + size * 0.75, y)
    .quadTo(x + size * 1.5, y - size * 0.9, x + size * 1.55, y - size * 0.55)
    .lineTo(x + size * 1.55, y + size * 0.55)
    .quadTo(x + size * 1.5, y + size * 0.9, x + size * 0.75, y)
    .close()
    .build();
  return { body, tail, eye: { x: x - size * 0.45, y: y - size * 0.15, r: size * 0.18 } };
}

function coralPath(x: number, base: number, height: number, lean: number): SkPath {
  const b = Skia.PathBuilder.Make();
  const top = base - height;
  b.moveTo(x, base).quadTo(x + lean * 0.3, base - height * 0.5, x + lean, top);
  b.moveTo(x + lean * 0.15, base - height * 0.45).quadTo(
    x - height * 0.35,
    base - height * 0.6,
    x - height * 0.3,
    top + height * 0.25,
  );
  b.moveTo(x + lean * 0.35, base - height * 0.65).quadTo(
    x + height * 0.45,
    base - height * 0.75,
    x + height * 0.4,
    top + height * 0.1,
  );
  return b.build();
}

function OceanBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const scene = useMemo(() => {
    const rng = mulberry32(301);
    const ripples = [0.05, 0.1, 0.15].map((y, i) => {
      const b = Skia.PathBuilder.Make();
      for (let k = 0; k < 4; k++) {
        const x0 = w * (k * 0.28 + (i % 2) * 0.12);
        const yy = h * y + (k % 2) * 8;
        b.moveTo(x0, yy)
          .quadTo(x0 + w * 0.05, yy - 6, x0 + w * 0.1, yy)
          .quadTo(x0 + w * 0.15, yy + 6, x0 + w * 0.2, yy);
      }
      return b.build();
    });
    const jellies = [
      { x: 0.16, y: 0.2, r: 22, color: '#FFB3D9' },
      { x: 0.86, y: 0.14, r: 16, color: '#C9B3FF' },
      { x: 0.9, y: 0.78, r: 18, color: '#FFB3D9' },
    ].map((j) => {
      const cx = w * j.x;
      const cy = h * j.y;
      const tentacles = Skia.PathBuilder.Make();
      for (let k = 0; k < 4; k++) {
        const tx = cx - j.r * 0.6 + k * j.r * 0.4;
        tentacles
          .moveTo(tx, cy)
          .quadTo(tx - 6, cy + j.r * 0.8, tx, cy + j.r * 1.4)
          .quadTo(tx + 6, cy + j.r * 1.9, tx, cy + j.r * 2.4);
      }
      return { cx, cy, r: j.r, color: j.color, tentacles: tentacles.build() };
    });
    const fish = [
      { x: 0.3, y: 0.13, s: 10, color: '#FFB27F' },
      { x: 0.36, y: 0.16, s: 8, color: '#FFB27F' },
      { x: 0.27, y: 0.18, s: 7, color: '#FFB27F' },
      { x: 0.72, y: 0.26, s: 11, color: '#FFE08A' },
      { x: 0.45, y: 0.78, s: 10, color: '#9FE3D8' },
      { x: 0.66, y: 0.8, s: 9, color: '#FF9EB5' },
    ].map((f) => ({ ...fishParts(w * f.x, h * f.y, f.s), color: f.color }));
    const floor = h * 0.94;
    const sand = Skia.PathBuilder.Make()
      .moveTo(0, h)
      .lineTo(0, floor)
      .quadTo(w * 0.25, floor - 14, w * 0.5, floor)
      .quadTo(w * 0.75, floor + 14, w, floor - 6)
      .lineTo(w, h)
      .close()
      .build();
    const corals = [
      { x: 0.1, h: 0.12, lean: 10, color: '#FF8FA3' },
      { x: 0.24, h: 0.08, lean: -8, color: '#FFB36B' },
      { x: 0.76, h: 0.1, lean: 8, color: '#C79BFF' },
      { x: 0.9, h: 0.13, lean: -10, color: '#FF8FA3' },
    ].map((c) => ({ path: coralPath(w * c.x, floor + 4, h * c.h, c.lean), color: c.color }));
    const grass = [0.04, 0.17, 0.33, 0.62, 0.83, 0.97].map((x) => {
      const bx = w * x;
      return Skia.PathBuilder.Make()
        .moveTo(bx, floor + 6)
        .quadTo(bx + 10, floor - h * 0.04, bx - 2, floor - h * 0.08)
        .build();
    });
    const starfish = [
      { x: 0.3, dy: 22, r: 10, rotate: 0.3, color: '#FF9F6B' },
      { x: 0.52, dy: 16, r: 8, rotate: -0.2, color: '#FF8FA3' },
      { x: 0.7, dy: 26, r: 11, rotate: 0.6, color: '#FFD86B' },
    ].map((f) => ({ path: starfishPath(w * f.x, floor + f.dy, f.r, f.rotate), r: f.r, color: f.color }));
    const bubbles = Array.from({ length: 22 }, () => ({ x: rng() * w, y: h * (0.25 + rng() * 0.6), r: 2 + rng() * 5 }));
    const dolphins = [{ x: 0.04, y: 0.79, width: 0.32, rotate: 0.05, flip: false }].map((d) => ({
      x: w * d.x,
      y: h * d.y,
      scale: (w * d.width) / 100,
      rotate: d.rotate,
      flip: d.flip,
    }));
    return { ripples, jellies, fish, sand, corals, grass, starfish, bubbles, dolphins };
  }, [w, h]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={FAINT}>
        <Path path={Skia.PathBuilder.Make().addRect({ x: 0, y: 0, width: w, height: h }).build()}>
          <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={['#2A9BB8', '#1B6F8F', '#0E2A3D']} />
        </Path>
        {scene.ripples.map((p, i) => (
          <Path key={i} path={p} color="white" style="stroke" strokeWidth={2} strokeCap="round" opacity={0.35} />
        ))}
        {scene.bubbles.map((b, i) => (
          <Group key={i}>
            <Circle cx={b.x} cy={b.y} r={b.r} color="#DFF7FF" opacity={0.25} />
            <Circle cx={b.x} cy={b.y} r={b.r} color="#DFF7FF" style="stroke" strokeWidth={1.2} opacity={0.7} />
          </Group>
        ))}
        {scene.jellies.map((j, i) => (
          <Group key={i}>
            <Circle cx={j.cx} cy={j.cy} r={j.r * 1.6} color={j.color} opacity={0.35}>
              <BlurMask blur={10} style="normal" />
            </Circle>
            <Path path={j.tentacles} color={j.color} style="stroke" strokeWidth={2.5} strokeCap="round" />
            <Group clip={{ x: j.cx - j.r, y: j.cy - j.r, width: j.r * 2, height: j.r }}>
              <Circle cx={j.cx} cy={j.cy} r={j.r} color={j.color} />
            </Group>
          </Group>
        ))}
        {scene.fish.map((f, i) => (
          <Group key={i}>
            <Path path={f.tail} color={f.color} />
            <Path path={f.body} color={f.color} />
            <Circle cx={f.eye.x} cy={f.eye.y} r={f.eye.r} color="#1B1F3B" />
          </Group>
        ))}
        {scene.dolphins.map((d, i) => (
          <Group
            key={i}
            transform={[
              { translateX: d.x },
              { translateY: d.y },
              { rotate: d.rotate },
              { scaleX: d.flip ? -d.scale : d.scale },
              { scaleY: d.scale },
            ]}>
            <Path path={DOLPHIN} color="#8EC9E8" />
            <Path path={DOLPHIN_BELLY} color="#D5EEF8" />
            <Circle cx={84} cy={26} r={2.2} color="#1B1F3B" />
          </Group>
        ))}
        {scene.grass.map((p, i) => (
          <Path key={i} path={p} color="#5CC9A0" style="stroke" strokeWidth={4} strokeCap="round" />
        ))}
        {scene.corals.map((c, i) => (
          <Path key={i} path={c.path} color={c.color} style="stroke" strokeWidth={7} strokeCap="round" />
        ))}
        <Path path={scene.sand} color="#E7C98F" />
        {scene.starfish.map((f, i) => (
          <Path key={i} path={f.path} color={f.color}>
            <CornerPathEffect r={f.r * 0.3} />
          </Path>
        ))}
      </Group>
    </Canvas>
  );
}

function KitchenBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const scene = useMemo(() => {
    const rng = mulberry32(601);
    const rays = [0.05, 0.22, 0.4].map((offset, i) => {
      const x0 = w * offset;
      const spread = w * (0.12 + i * 0.03);
      return Skia.PathBuilder.Make()
        .moveTo(x0, 0)
        .lineTo(x0 + spread, 0)
        .lineTo(x0 + spread + w * 0.55, h * 0.75)
        .lineTo(x0 + w * 0.45, h * 0.75)
        .close()
        .build();
    });
    const bokeh = Array.from({ length: 9 }, () => ({
      x: rng() * w,
      y: h * (0.1 + rng() * 0.75),
      r: w * (0.03 + rng() * 0.05),
    }));
    const flour = Array.from({ length: 40 }, () => ({ x: rng() * w, y: rng() * h * 0.85, r: 0.6 + rng() * 1.4 }));
    const tableY = h * 0.88;
    const grain = Skia.PathBuilder.Make();
    for (let i = 0; i < 5; i++) {
      const gy = tableY + ((h - tableY) * (i + 0.6)) / 5;
      grain.moveTo(0, gy).cubicTo(w * 0.3, gy + 3, w * 0.7, gy - 3, w, gy);
    }
    return { rays, bokeh, flour, tableY, grain: grain.build() };
  }, [w, h]);
  const win = { x: -w * 0.04, y: h * 0.03, w: w * 0.36, h: h * 0.24 };
  const shelfY = h * 0.13;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={w} height={h} opacity={0.7}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={['#F7E6C8', '#EBCB9C', '#D9AE78']} />
      </Rect>
      <Group opacity={FAINT}>
        <Circle cx={win.x + win.w * 0.55} cy={win.y + win.h * 0.5} r={w * 0.35} color="#FFF6E0">
          <BlurMask blur={40} style="normal" />
        </Circle>
        <RoundedRect x={win.x} y={win.y} width={win.w} height={win.h} r={10} color="#FFFDF5" opacity={0.7} />
        <Rect x={win.x + win.w / 2 - 2} y={win.y} width={4} height={win.h} color="#C48A55" opacity={0.6} />
        <Rect x={win.x} y={win.y + win.h / 2 - 2} width={win.w} height={4} color="#C48A55" opacity={0.6} />
        <RoundedRect
          x={win.x}
          y={win.y}
          width={win.w}
          height={win.h}
          r={10}
          color="#B07A4A"
          style="stroke"
          strokeWidth={6}
          opacity={0.6}
        />
        {scene.rays.map((ray, i) => (
          <Path key={i} path={ray} color="#FFF8E6" opacity={0.35}>
            <BlurMask blur={14} style="normal" />
          </Path>
        ))}
        <Rect x={w * 0.58} y={shelfY} width={w * 0.46} height={8} color="#9C6638" opacity={0.7} />
        {[0.63, 0.74, 0.86].map((x, i) => (
          <RoundedRect
            key={i}
            x={w * x}
            y={shelfY - h * (0.045 + (i % 2) * 0.012)}
            width={w * 0.07}
            height={h * (0.045 + (i % 2) * 0.012)}
            r={6}
            color={['#E8D6B8', '#C9A27A', '#F0E2C8'][i]}
            opacity={0.8}
          />
        ))}
        {scene.bokeh.map((b, i) => (
          <Circle key={i} cx={b.x} cy={b.y} r={b.r} color="#FFF1D2" opacity={0.35}>
            <BlurMask blur={8} style="normal" />
          </Circle>
        ))}
        {scene.flour.map((f, i) => (
          <Circle key={i} cx={f.x} cy={f.y} r={f.r} color="white" opacity={0.7} />
        ))}
        <Rect x={0} y={scene.tableY} width={w} height={h - scene.tableY}>
          <LinearGradient start={vec(0, scene.tableY)} end={vec(0, h)} colors={['#C98A4E', '#9C6235']} />
        </Rect>
        <Path path={scene.grain} style="stroke" strokeWidth={1.5} color="#6E3F1C" opacity={0.4} />
      </Group>
    </Canvas>
  );
}

export const ThemeBackdrop = memo(ThemeBackdropView);
