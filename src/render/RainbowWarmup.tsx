import { BlurStyle, createPicture, PaintStyle, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { drawRainbowBoxes, type Box } from './rainbow';

const WARMUP_MS = 1200;
const WARMUP_STRENGTH = 0.01;

interface Props {
  x: number;
  y: number;
  w: number;
  h: number;
  cell: number;
  pad: number;
}

export function RainbowWarmup({ x, y, w, h, cell, pad }: Props) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setActive(false), WARMUP_MS);
    return () => clearTimeout(id);
  }, []);
  const picture = useMemo(
    () =>
      createPicture((canvas) => {
        const boxes: Box[] = [
          [x, y, w, cell],
          [x, y, cell, h],
        ];
        drawRainbowBoxes(canvas, boxes, 0, [x, y, w, h], cell, WARMUP_STRENGTH);

        const frame = Skia.Paint();
        frame.setColor(Skia.Color('#FFE680'));
        frame.setAlphaf(WARMUP_STRENGTH);
        frame.setStyle(PaintStyle.Stroke);
        frame.setStrokeWidth(pad);
        frame.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, pad, true));
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - pad / 2, y - pad / 2, w + pad, h + pad), pad * 1.5, pad * 1.5), frame);

        const band = Skia.Paint();
        band.setColor(Skia.Color('#FFFFFF'));
        band.setAlphaf(WARMUP_STRENGTH);
        band.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, cell * 0.3, true));
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, cell), cell * 0.2, cell * 0.2), band);
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, cell, h), cell * 0.2, cell * 0.2), band);
      }),
    [x, y, w, h, cell, pad],
  );
  if (!active) return null;
  return <Picture picture={picture} />;
}
