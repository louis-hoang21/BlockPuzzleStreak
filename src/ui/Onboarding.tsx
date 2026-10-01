import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hapticTap } from '../haptics';
import { COLORS } from '../render/theme';

interface Step {
  icon: SFSymbol;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: 'hand.draw.fill',
    title: 'Kéo khối lên lưới',
    body: 'Kéo một khối từ khay lên lưới 8x8. Bóng mờ cho biết khối sẽ nằm ở đâu.',
  },
  {
    icon: 'square.grid.3x3.fill',
    title: 'Lấp đầy hàng hoặc cột',
    body: 'Hàng hoặc cột đầy sẽ nổ và ghi điểm. Nổ nhiều hàng/cột cùng lúc, hoặc nổ liên tiếp để nhân combo.',
  },
  {
    icon: 'arrow.clockwise',
    title: 'Chạm để xoay',
    body: 'Chạm vào khối trong khay để xoay 90°, tốn 1 lượt xoay. Hết chỗ đặt mà không xoay được nữa là kết thúc ván.',
  },
  {
    icon: 'star.fill',
    title: 'Vượt mốc điểm',
    body: 'Mỗi ván bắt đầu với 0 lượt xoay, thua là mất hết. Đạt 5.000, 10.000, 15.000, 20.000, 25.000, 30.000, 40.000, 50.000 điểm được thêm lượt xoay. Điểm cao còn mở khoá theme và skin mới.',
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const next = () => {
    hapticTap();
    if (last) onDone();
    else setIndex(index + 1);
  };

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <SymbolView name={step.icon} size={40} tintColor={COLORS.accent} style={styles.icon} />
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.buttonRow}>
          {!last && (
            <Pressable style={styles.skip} onPress={onDone} accessibilityRole="button">
              <Text style={styles.skipText}>Bỏ qua</Text>
            </Pressable>
          )}
          <Pressable style={styles.primary} onPress={next} accessibilityRole="button">
            <Text style={styles.primaryText}>{last ? 'Bắt đầu chơi' : 'Tiếp'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 10, 30, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 320, borderRadius: 22, padding: 20, backgroundColor: '#262D57', alignItems: 'center' },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1B1F3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 40, height: 40 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  body: { color: COLORS.textDim, fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A4275' },
  dotActive: { backgroundColor: COLORS.accent, width: 20 },
  buttonRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 20 },
  primary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    backgroundColor: '#3DCB4A',
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  skip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
  },
  skipText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
});
