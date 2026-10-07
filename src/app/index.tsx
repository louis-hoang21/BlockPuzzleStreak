import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ImageBackground, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initSfx } from '../audio/sfx';
import { CLASSIC_ENABLED, CLASSIC_NAME, MODES, STORM_PUZZLE_NAME } from '../core/modes';
import { hapticTap } from '../haptics';
import { useT } from '../i18n';
import { dayKey, loadDailyPuzzle } from '../core/stormPuzzle';
import { MODE_BUTTON_COLORS, ModeButton } from '../ui/ModeButton';

const ART = require('../../assets/welcome.jpg');
const WARMUP_DELAY_MS = 400;
const LOADING_FALLBACK_MS = 3000;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function warmUp() {
  initSfx();
  await nextTick();
  await loadDailyPuzzle(dayKey());
  await nextTick();
  const { useGameStore } = await import('../store/gameStore');
  const store = useGameStore.getState();
  if (store.modes.jackpot.game.over) store.start('jackpot');
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(false);
      const t = setTimeout(() => {
        warmUp().catch(() => {});
      }, WARMUP_DELAY_MS);
      return () => clearTimeout(t);
    }, []),
  );

  const openPicker = () => {
    hapticTap();
    setPicking(true);
  };

  const closePicker = () => {
    hapticTap();
    setPicking(false);
  };

  const openMode = (href: Href, prepare?: () => Promise<unknown>) => {
    hapticTap();
    setPicking(false);
    setLoading(true);
    requestAnimationFrame(() =>
      setTimeout(() => {
        (prepare?.() ?? Promise.resolve()).catch(() => {}).finally(() => {
            router.push(href);
            setTimeout(() => setLoading(false), LOADING_FALLBACK_MS);
          });
      }, 0),
    );
  };

  return (
    <ImageBackground source={ART} resizeMode="cover" style={styles.container}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton icon="paintpalette.fill" label={tr('Collection', 'Bộ sưu tập')} href="/collection" />
        <IconButton icon="trophy.fill" label={tr('Records', 'Kỷ lục')} href="/records" />
        <IconButton icon="gearshape.fill" label={tr('Settings', 'Cài đặt')} href="/settings" />
      </View>
      <View style={[styles.start, { paddingBottom: insets.bottom + 48 }]}>
        <ModeButton label={tr('Start', 'Bắt đầu')} colors={MODE_BUTTON_COLORS.green} onPress={openPicker} chevron={false} />
      </View>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={closePicker}>
        <Pressable style={styles.backdrop} onPress={closePicker} accessibilityLabel={tr('Close', 'Đóng')}>
          <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal>
            <Text style={styles.title}>{tr('Choose a mode', 'Chọn chế độ chơi')}</Text>
            <View style={styles.modes}>
              <ModeButton label={tr(MODES[0].name)} colors={MODE_BUTTON_COLORS.green} onPress={() => openMode('/game/jackpot')} />
              <ModeButton
                label={tr(STORM_PUZZLE_NAME)}
                colors={MODE_BUTTON_COLORS.orange}
                onPress={() => openMode('/game/storm-puzzle', () => loadDailyPuzzle(dayKey()))}
              />
              {CLASSIC_ENABLED && (
                <ModeButton label={tr(CLASSIC_NAME)} colors={MODE_BUTTON_COLORS.blue} onPress={() => openMode('/game/classic')} />
              )}
            </View>
            <Pressable
              onPress={closePicker}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tr('Close', 'Đóng')}
              style={({ pressed }) => [styles.close, pressed && styles.iconButtonPressed]}>
              <SymbolView name="xmark" size={14} weight="heavy" tintColor="#7A4A1E" style={styles.closeIcon} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {loading && (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#B9773A" />
            <Text style={styles.loadingText}>{tr('Loading…', 'Đang tải…')}</Text>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

function IconButton({ icon, label, href }: { icon: SFSymbol; label: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        hapticTap();
        router.push(href);
      }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
      <SymbolView name={icon} size={20} tintColor="#FFFFFF" style={styles.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#F7DDA4' },
  topBar: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(12, 16, 45, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { opacity: 0.6 },
  icon: { width: 20, height: 20 },
  start: { alignSelf: 'center', width: 160 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40, 22, 6, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFF4DC',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#B9773A',
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 22, fontWeight: '900', color: '#7A4A1E', marginBottom: 18 },
  modes: { alignSelf: 'stretch', gap: 12 },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(122, 74, 30, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 14, height: 14 },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(40, 22, 6, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: '#FFF4DC',
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#B9773A',
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { fontSize: 16, fontWeight: '800', color: '#7A4A1E' },
});
