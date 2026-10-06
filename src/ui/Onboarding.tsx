import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hapticTap } from '../haptics';
import { useT, type Localized } from '../i18n';

interface Step {
  icon: SFSymbol;
  title: Localized;
  body: Localized;
  special?: boolean;
}

export const TUTORIAL_VERSION = 3;

const STEPS: Step[] = [
  {
    icon: 'hand.draw.fill',
    title: { en: 'Drag toast onto the grid', vi: 'Kéo khối bánh mì lên lưới' },
    body: {
      en: 'Drag a block from the tray onto the 8x8 grid. The shadow shows where it will land.',
      vi: 'Kéo một khối từ khay lên lưới 8x8. Bóng mờ cho biết khối sẽ nằm ở đâu.',
    },
  },
  {
    icon: 'square.grid.3x3.fill',
    title: { en: 'Clear lines, chain combos', vi: 'Nổ hàng, nối combo' },
    body: {
      en: 'Full rows or columns clear: 1 line 300, 2 lines 1,000, 3 lines 2,000 points. Clear on back-to-back turns for x2, x3 combos...',
      vi: 'Hàng hoặc cột đầy sẽ nổ: 1 đường 300, 2 đường 1.000, 3 đường 2.000 điểm. Nổ ở các lượt liên tiếp để nhân combo x2, x3...',
    },
  },
  {
    icon: 'arrow.clockwise',
    title: { en: 'Rotate blocks', vi: 'Xoay khối' },
    body: {
      en: 'Tap a block in the tray to rotate it 90°, using 1 rotation. Pass score milestones to earn more rotations.',
      vi: 'Chạm vào khối trong khay để xoay 90°, tốn 1 lượt xoay. Vượt mốc điểm để nhận thêm lượt xoay.',
    },
    special: true,
  },
  {
    icon: 'tornado',
    title: { en: 'Storm meter', vi: 'Thanh năng lượng bão' },
    body: {
      en: 'Every clear charges the meter below the tray. When it fills, tap it to call a storm that sweeps the board clean or reshuffles it. Great for getting out of a jam!',
      vi: 'Mỗi lần nổ hàng nạp năng lượng vào thanh dưới khay. Thanh đầy thì chạm vào để gọi bão: quét sạch bàn hoặc xáo lại các khối. Cứu bàn lúc kẹt cực hay!',
    },
    special: true,
  },
  {
    icon: 'heart.fill',
    title: { en: 'Heart x4', vi: 'Trái tim x4' },
    body: {
      en: 'Arrange the blocks on the grid into a solid rectangle: a heart appears and that turn scores x4.',
      vi: 'Xếp sao cho các khối trên lưới tạo thành một hình chữ nhật đặc: trái tim xuất hiện và lượt đó được x4 điểm.',
    },
    special: true,
  },
  {
    icon: 'star.fill',
    title: { en: 'Unlock themes and skins', vi: 'Mở khoá theme và skin' },
    body: {
      en: 'High scores, long combos and board clears unlock new themes and skins in the Collection.',
      vi: 'Điểm cao, combo dài và nổ sạch bàn sẽ mở thêm theme, skin mới trong Bộ sưu tập.',
    },
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const tr = useT();
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
          <SymbolView name={step.icon} size={40} tintColor={ACCENT} style={styles.icon} />
        </View>
        {step.special && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tr("What's special", 'Điểm đặc biệt')}</Text>
          </View>
        )}
        <Text style={styles.title}>{tr(step.title)}</Text>
        <Text style={styles.body}>{tr(step.body)}</Text>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.buttonRow}>
          {!last && (
            <Pressable style={styles.skip} onPress={onDone} accessibilityRole="button">
              <Text style={styles.skipText}>{tr('Skip', 'Bỏ qua')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.primary} onPress={next} accessibilityRole="button">
            <Text style={styles.primaryText}>{last ? tr('Start playing', 'Bắt đầu chơi') : tr('Next', 'Tiếp')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const ACCENT = '#E07A1F';
const CARD = '#FFF4DE';
const INK = '#4E2F17';
const INK_DIM = '#7A5535';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(40, 22, 8, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    padding: 20,
    backgroundColor: CARD,
    borderWidth: 4,
    borderColor: '#A86A35',
    alignItems: 'center',
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F3DDB4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 40, height: 40 },
  badge: { marginTop: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#3FA9F5' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  title: { color: INK, fontSize: 22, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  body: { color: INK_DIM, fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E3C79B' },
  dotActive: { backgroundColor: ACCENT, width: 20 },
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
    borderColor: 'rgba(78, 47, 23, 0.3)',
    alignItems: 'center',
  },
  skipText: { color: INK, fontSize: 14, fontWeight: '700' },
});
