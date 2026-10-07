import { Circle, FillType, Group, Oval, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Shape } from '../core/pieces';
import { ageOf, SPOIL_AT, turnsLeft, wearOf } from '../core/spoil';
import { Block } from './Block';
import type { BlockStyle, Skin } from './theme';

type SpoilKind = 'burn' | 'rot' | 'wilt' | 'freeze';

export function spoilKind(style: BlockStyle): SpoilKind {
  if (style === 'toast') return 'burn';
  if (style === 'sushi') return 'rot';
  if (style === 'flower') return 'wilt';
  return 'freeze';
}

const TINT: Record<SpoilKind, string> = {
  burn: '#8A4A14',
  rot: '#5F6E16',
  wilt: '#6E604F',
  freeze: '#D6F1FF',
};

const FADE: Record<SpoilKind, { warnFrom: number; warnSpan: number; spoiled: number; marks: number }> = {
  burn: { warnFrom: 0.03, warnSpan: 0.08, spoiled: 0.14, marks: 1 },
  rot: { warnFrom: 0.02, warnSpan: 0.06, spoiled: 0.1, marks: 0.6 },
  wilt: { warnFrom: 0.1, warnSpan: 0.45, spoiled: 0.58, marks: 1 },
  freeze: { warnFrom: 0.1, warnSpan: 0.45, spoiled: 0.6, marks: 1 },
};

interface Props {
  x: number;
  y: number;
  size: number;
  color: number;
  skin: Skin;
  wear?: number;
}

export function WornBlock({ x, y, size, color, skin, wear }: Props) {
  const state = wearOf(wear);
  const crack = useMemo(() => (state === 'cracked' ? crackPaths(x, y, size) : null), [state, x, y, size]);
  if (state === 'fresh') return <Block x={x} y={y} size={size} color={color} skin={skin} />;

  const kind = spoilKind(skin.style);
  const strong = state !== 'warn';
  const left = turnsLeft(wear);
  const fade = FADE[kind];
  const warmth = fade.warnFrom + (fade.warnSpan * ageOf(wear)) / SPOIL_AT;
  const body = (
    <>
      <Block x={x} y={y} size={size} color={color} skin={skin} worn />
      <RoundedRect
        x={x + size * 0.015}
        y={y + size * 0.015}
        width={size * 0.97}
        height={size * 0.97}
        r={size * 0.04}
        color={TINT[kind]}
        opacity={strong ? fade.spoiled : warmth}
      />
      {strong && (
        <Group opacity={fade.marks}>
          <Marks x={x} y={y} size={size} kind={kind} />
        </Group>
      )}
      {left !== null && <TurnDots x={x} y={y} size={size} count={left} />}
    </>
  );
  if (!crack) return <Group>{body}</Group>;
  return (
    <Group>
      <Group clip={crack.ring}>{body}</Group>
      <Group clip={crack.clip}>{body}</Group>
      <Path path={crack.edge} color={kind === 'freeze' ? '#FFFFFF' : '#1A0C03'} style="stroke" strokeWidth={size * 0.05} />
    </Group>
  );
}

export function WornPiece({
  cells,
  color,
  size,
  skin,
  wears,
}: {
  cells: Shape;
  color: number;
  size: number;
  skin: Skin;
  wears: readonly number[];
}) {
  return (
    <>
      {cells.map(([r, c], k) => (
        <WornBlock key={`${r}-${c}`} x={c * size} y={r * size} size={size} color={color} skin={skin} wear={wears[k]} />
      ))}
    </>
  );
}

function TurnDots({ x, y, size, count }: { x: number; y: number; size: number; count: number }) {
  const r = size * 0.055;
  const step = size * 0.14;
  const startX = x + size / 2 - ((count - 1) * step) / 2;
  const cy = y + size * 0.8;
  return (
    <Group>
      {Array.from({ length: count }, (_, k) => (
        <Group key={k}>
          <Circle cx={startX + k * step} cy={cy} r={r + size * 0.02} color="#2A1406" opacity={0.75} />
          <Circle cx={startX + k * step} cy={cy} r={r} color="#FFFFFF" />
        </Group>
      ))}
    </Group>
  );
}

function crackPaths(x: number, y: number, size: number) {
  const points: [number, number][] = [
    [0, 0.5],
    [0.18, 0.4],
    [0.32, 0.55],
    [0.5, 0.42],
    [0.66, 0.58],
    [0.82, 0.44],
    [1, 0.52],
  ];
  const edge = Skia.Path.Make();
  points.forEach(([px, py], i) => {
    if (i === 0) edge.moveTo(x + px * size, y + py * size);
    else edge.lineTo(x + px * size, y + py * size);
  });
  const clip = edge.copy();
  clip.lineTo(x + size, y + size);
  clip.lineTo(x, y + size);
  clip.close();
  const outer = size * 0.015;
  const inner = outer + size * 0.025;
  const r = size * 0.04;
  const ring = Skia.Path.Make();
  ring.addRRect(Skia.RRectXY(Skia.XYWHRect(x + outer, y + outer, size - outer * 2, size - outer * 2), r, r));
  ring.addRRect(Skia.RRectXY(Skia.XYWHRect(x + inner, y + inner, size - inner * 2, size - inner * 2), r, r));
  ring.setFillType(FillType.EvenOdd);
  return { clip, edge, ring };
}

function Marks({ x, y, size, kind }: { x: number; y: number; size: number; kind: SpoilKind }) {
  const s = size;
  switch (kind) {
    case 'burn': {
      const streaks = Skia.Path.Make();
      for (const k of [0.3, 0.52, 0.74]) {
        streaks.moveTo(x + s * (k - 0.14), y + s * 0.22);
        streaks.lineTo(x + s * (k + 0.06), y + s * 0.8);
      }
      return (
        <Path path={streaks} color="#6B3A16" style="stroke" strokeWidth={s * 0.04} strokeCap="round" opacity={0.5} />
      );
    }
    case 'rot':
      return (
        <Group>
          <Circle cx={x + s * 0.3} cy={y + s * 0.32} r={s * 0.11} color="#2F3A08" />
          <Circle cx={x + s * 0.66} cy={y + s * 0.58} r={s * 0.14} color="#2F3A08" />
          <Circle cx={x + s * 0.38} cy={y + s * 0.72} r={s * 0.07} color="#B9C94A" />
          <Circle cx={x + s * 0.74} cy={y + s * 0.26} r={s * 0.06} color="#B9C94A" />
        </Group>
      );
    case 'wilt':
      return (
        <Group>
          <Oval x={x + s * 0.2} y={y + s * 0.5} width={s * 0.24} height={s * 0.34} color="#3E3226" opacity={0.75} />
          <Oval x={x + s * 0.56} y={y + s * 0.56} width={s * 0.22} height={s * 0.3} color="#3E3226" opacity={0.75} />
          <Circle cx={x + s * 0.5} cy={y + s * 0.3} r={s * 0.08} color="#3E3226" opacity={0.6} />
        </Group>
      );
    case 'freeze': {
      const flake = Skia.Path.Make();
      const cx = x + s * 0.5;
      const cy = y + s * 0.5;
      const r = s * 0.3;
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI / 3) * k;
        flake.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
        flake.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      return (
        <Group>
          <RoundedRect
            x={x + s * 0.06}
            y={y + s * 0.06}
            width={s * 0.88}
            height={s * 0.88}
            r={s * 0.06}
            color="#FFFFFF"
            style="stroke"
            strokeWidth={s * 0.05}
            opacity={0.9}
          />
          <Path path={flake} color="#FFFFFF" style="stroke" strokeWidth={s * 0.06} strokeCap="round" />
        </Group>
      );
    }
  }
}
