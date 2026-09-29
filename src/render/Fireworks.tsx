import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

const DURATION_MS = 1600;
const BURSTS = 3;
const PER_BURST = 44;
const GRAVITY = 420;
const COLORS = ['#FFD84D', '#FF5FA2', '#4FC3F7', '#7BD84F', '#FF8A1F', '#C08BFF', '#FFFFFF'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  delay: number;
}

function makeParticles(width: number, height: number): Particle[] {
  const out: Particle[] = [];
  for (let b = 0; b < BURSTS; b++) {
    const cx = width * (0.25 + 0.25 * b) + (Math.random() - 0.5) * width * 0.1;
    const cy = height * (0.25 + Math.random() * 0.2);
    const palette = [COLORS[(b * 2) % COLORS.length], COLORS[(b * 2 + 1) % COLORS.length], '#FFFFFF'];
    for (let i = 0; i < PER_BURST; i++) {
      const angle = (i / PER_BURST) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 140 + Math.random() * 200;
      out.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: 2 + Math.random() * 2.5,
        color: palette[i % palette.length],
        delay: b * 0.12,
      });
    }
  }
  return out;
}

export function Fireworks({ id, width, height }: { id: number; width: number; height: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const particles = useMemo(() => makeParticles(width, height), [id, width, height]);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear });
  }, [id, progress]);

  const picture = useDerivedValue(() => {
    const p = progress.value;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (const pt of particles) {
        const local = (p - pt.delay) / (1 - pt.delay);
        if (local <= 0 || local >= 1) continue;
        const t = (local * DURATION_MS) / 1000;
        const x = pt.x + pt.vx * t;
        const y = pt.y + pt.vy * t + 0.5 * GRAVITY * t * t;
        paint.setColor(Skia.Color(pt.color));
        paint.setAlphaf(Math.max(0, 1 - local * local));
        canvas.drawCircle(x, y, pt.size * (1 - local * 0.5), paint);
      }
    });
  });

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
