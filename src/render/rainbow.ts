import { BlurStyle, PaintStyle, Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';

export const RAINBOW = ['#FF4D4D', '#FF9F1C', '#FFE14D', '#4DDB6B', '#3DB8FF', '#8F6BFF', '#FF5FD2', '#FF4D4D'];
export const RAINBOW_MS = 1400;

export type Box = [x: number, y: number, w: number, h: number];

export function drawRainbowBoxes(canvas: SkCanvas, boxes: Box[], phase: number, area: Box, cell: number, strength = 1) {
  'worklet';
  if (boxes.length === 0) return;
  const [ax, ay, aw, ah] = area;
  const span = Math.max(aw, ah);
  const shift = phase * span * 2;
  const shader = Skia.Shader.MakeLinearGradient(
    vec(ax + shift, ay + shift),
    vec(ax + shift + span, ay + shift + span),
    RAINBOW.map((c) => Skia.Color(c)),
    null,
    TileMode.Mirror,
  );
  const fill = Skia.Paint();
  fill.setColor(Skia.Color('#FFFFFF'));
  fill.setAlphaf(0.2 * strength);
  const tint = Skia.Paint();
  tint.setShader(shader);
  tint.setAlphaf(0.28 * strength);
  const glow = Skia.Paint();
  glow.setShader(shader);
  glow.setStyle(PaintStyle.Stroke);
  glow.setStrokeWidth(5);
  glow.setAlphaf(strength);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, 4, true));
  const border = Skia.Paint();
  border.setShader(shader);
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(3);
  border.setAlphaf(strength);
  for (const [x, y, w, h] of boxes) {
    const box = Skia.RRectXY(Skia.XYWHRect(x, y, w, h), cell * 0.18, cell * 0.18);
    const edge = Skia.RRectXY(Skia.XYWHRect(x + 1.5, y + 1.5, w - 3, h - 3), cell * 0.16, cell * 0.16);
    canvas.drawRRect(box, fill);
    canvas.drawRRect(box, tint);
    canvas.drawRRect(edge, glow);
    canvas.drawRRect(edge, border);
  }
}
