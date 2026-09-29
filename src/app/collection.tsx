import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { skinUnlock, themeUnlock, type Unlock } from '../core/cosmetics';
import { hapticTap, hapticWarning } from '../haptics';
import { Block } from '../render/Block';
import { EmptyCell } from '../render/EmptyCell';
import { COLORS, SKINS, THEMES, skinById, type BoardTheme, type Skin } from '../render/theme';
import { useProgressStore } from '../store/progressStore';
import { useSettingsStore } from '../store/settingsStore';
import { ScreenHeader } from '../ui/ScreenHeader';

function unlockText(unlock: Unlock | undefined): string {
  if (!unlock) return '';
  switch (unlock.type) {
    case 'default':
      return 'Mặc định';
    case 'score':
      return 'score' in unlock && unlock.score ? `Đạt ${unlock.score.toLocaleString()} điểm` : '';
    case 'perfectClear':
      return 'count' in unlock ? `Perfect Clear lần ${unlock.count}` : '';
    case 'combo':
      return 'multiplier' in unlock ? `Đạt combo x${unlock.multiplier}` : '';
    default:
      return '';
  }
}

const PREVIEW = 72;

function ThemePreview({ theme, skin }: { theme: BoardTheme; skin: Skin }) {
  const cell = (PREVIEW - 8) / 3;
  const filled: Record<number, number> = { 3: 0, 6: 1, 7: 3, 8: 2 };
  return (
    <Canvas style={{ width: PREVIEW, height: PREVIEW }}>
      <RoundedRect x={0} y={0} width={PREVIEW} height={PREVIEW} r={12} color={theme.boardFrame} />
      <RoundedRect x={3} y={3} width={PREVIEW - 6} height={PREVIEW - 6} r={10} color={theme.boardBg} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 4 + (i % 3) * cell;
        const y = 4 + Math.floor(i / 3) * cell;
        return i in filled ? (
          <Block key={i} x={x} y={y} size={cell} color={filled[i]} skin={skin} />
        ) : (
          <EmptyCell key={i} x={x} y={y} size={cell} theme={theme} />
        );
      })}
    </Canvas>
  );
}

function SkinPreview({ skin }: { skin: Skin }) {
  const size = PREVIEW / 2;
  return (
    <Canvas style={{ width: PREVIEW, height: PREVIEW }}>
      <RoundedRect x={0} y={0} width={PREVIEW} height={PREVIEW} r={12} color="#141833" />
      <Group>
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} x={(i % 2) * size} y={Math.floor(i / 2) * size} size={size} color={i} skin={skin} />
        ))}
      </Group>
    </Canvas>
  );
}

interface ItemProps {
  name: string;
  unlocked: boolean;
  selected: boolean;
  condition: string;
  preview: React.ReactNode;
  onPress: () => void;
}

function Item({ name, unlocked, selected, condition, preview, onPress }: ItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unlocked ? name : `${name}, đang khoá: ${condition}`}
      style={[styles.item, selected && styles.itemSelected]}>
      <View style={!unlocked && styles.locked}>{preview}</View>
      {!unlocked && (
        <View style={styles.lockBadge}>
          <SymbolView name="lock.fill" size={14} tintColor="#FFFFFF" style={styles.lockIcon} />
        </View>
      )}
      <Text style={styles.itemName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.itemSub, selected && styles.itemSubSelected]} numberOfLines={1}>
        {selected ? 'Đang dùng' : unlocked ? 'Chạm để dùng' : condition}
      </Text>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const unlockedThemes = useProgressStore((s) => s.unlockedThemes);
  const unlockedSkins = useProgressStore((s) => s.unlockedSkins);
  const { theme: themeId, skin: skinId, update } = useSettingsStore();
  const skin = skinById(skinId);

  const pick = (unlocked: boolean, apply: () => void) => {
    if (!unlocked) {
      hapticWarning();
      return;
    }
    hapticTap();
    apply();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Bộ sưu tập" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.section}>Theme</Text>
        <View style={styles.grid}>
          {THEMES.map((t) => {
            const unlocked = unlockedThemes.includes(t.id);
            return (
              <Item
                key={t.id}
                name={t.name}
                unlocked={unlocked}
                selected={t.id === themeId}
                condition={unlockText(themeUnlock(t.id))}
                preview={<ThemePreview theme={t} skin={skin} />}
                onPress={() => pick(unlocked, () => update({ theme: t.id }))}
              />
            );
          })}
        </View>
        <Text style={styles.section}>Skin</Text>
        <View style={styles.grid}>
          {SKINS.map((s) => {
            const unlocked = unlockedSkins.includes(s.id);
            return (
              <Item
                key={s.id}
                name={s.name}
                unlocked={unlocked}
                selected={s.id === skinId}
                condition={unlockText(skinUnlock(s.id))}
                preview={<SkinPreview skin={s} />}
                onPress={() => pick(unlocked, () => update({ skin: s.id }))}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  section: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  item: {
    width: '30%',
    flexGrow: 1,
    maxWidth: '32%',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#262D57',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemSelected: { borderColor: '#3DCB4A' },
  locked: { opacity: 0.35 },
  lockBadge: {
    position: 'absolute',
    top: 36,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: { width: 14, height: 14 },
  itemName: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  itemSub: { color: COLORS.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  itemSubSelected: { color: '#3DCB4A' },
});
