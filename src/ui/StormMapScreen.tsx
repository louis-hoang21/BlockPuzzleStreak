import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STORM_PUZZLE_NAME } from '../core/modes';
import { dayKey, isHardLevel, loadPuzzle, mapKey } from '../core/stormPuzzle';
import { hapticTap } from '../haptics';
import { useT } from '../i18n';
import { levelStars, loadMapRecords, nextLevel, totalStars, type MapRecords } from '../persistence/puzzleMap';
import { loadPuzzleRecords, puzzleStreak, puzzleVariant, type PuzzleRecords } from '../persistence/stormPuzzle';
import { ThemeBackdrop } from '../render/Backdrops';
import { hudColors, themeById } from '../render/theme';
import { useSettingsStore } from '../store/settingsStore';
import { INK, INK_DIM, kit, STAR, Stars } from './puzzleKit';

const GAP = 104;
const NODE = 31;
const CURRENT = 38;
const AHEAD = 12;
const MIN_LEVELS = 24;
const DOTS = 3;
const PAD = 48;
const SWING = [0.5, 0.7, 0.8, 0.7, 0.5, 0.3, 0.2, 0.3];

const DONE = '#FF9A3D';
const DONE_EDGE = '#B85A12';
const OPEN = '#3DCB4A';
const OPEN_EDGE = '#1E8A2B';
const LOCKED = '#B9A58C';
const LOCKED_EDGE = '#8A7660';
const CROWN = '#FFC21A';
const CROWN_SIZE = 20;

export function StormMapScreen() {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const theme = themeById(useSettingsStore((s) => s.theme));
  const hud = hudColors(theme.tone);
  const today = useMemo(() => dayKey(), []);
  const [map, setMap] = useState<MapRecords>(() => loadMapRecords());
  const [daily, setDaily] = useState<PuzzleRecords>(() => loadPuzzleRecords());
  const [width, setWidth] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const viewHeight = useRef(0);
  const current = nextLevel(map);
  const count = Math.max(MIN_LEVELS, current + AHEAD);
  const height = PAD * 2 + (count - 1) * GAP;
  const streak = puzzleStreak(daily, today);
  const todayStars = daily.days[today] ?? 0;

  useFocusEffect(
    useCallback(() => {
      const records = loadMapRecords();
      setMap(records);
      setDaily(loadPuzzleRecords());
      loadPuzzle(mapKey(nextLevel(records)))
        .then(() => loadPuzzle({ day: today, level: 0, variant: puzzleVariant(today) }))
        .catch(() => {});
    }, [today]),
  );

  const nodeY = (level: number) => height - PAD - (level - 1) * GAP;
  const nodeX = (level: number) => width * SWING[(level - 1) % SWING.length];

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    viewHeight.current = e.nativeEvent.layout.height;
  };

  const focusCurrent = () => {
    scroll.current?.scrollTo({ y: Math.max(0, nodeY(current) - viewHeight.current * 0.6), animated: false });
  };

  const open = (level: number) => {
    hapticTap();
    router.push({ pathname: '/game/storm-level', params: { level: String(level) } });
  };

  const levels = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <View style={[kit.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar style={theme.tone === 'light' ? 'dark' : 'light'} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <View style={kit.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={tr('Back', 'Quay lại')} style={kit.iconButton}>
          <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={kit.icon} />
        </Pressable>
        <View style={kit.titleBox}>
          <Text style={[kit.title, { color: hud.text }]} numberOfLines={1}>
            {tr(STORM_PUZZLE_NAME)}
          </Text>
          <Text style={[kit.subtitle, { color: hud.textDim }]}>
            ★ {totalStars(map)} · {tr('Level', 'Màn')} {current}
          </Text>
        </View>
        <View style={kit.iconButton} />
      </View>

      <Pressable
        onPress={() => {
          hapticTap();
          router.push('/game/storm-daily');
        }}
        accessibilityRole="button"
        style={styles.daily}
      >
        <SymbolView name="calendar" size={26} tintColor={DONE_EDGE} style={styles.dailyIcon} />
        <View style={styles.dailyText}>
          <Text style={styles.dailyTitle}>{tr('Daily challenge', 'Thử thách hôm nay')}</Text>
          <Text style={styles.dailySub}>
            {tr(`Streak ${streak} ${streak === 1 ? 'day' : 'days'}`, `Chuỗi ${streak} ngày`)}
            {todayStars > 0 ? '' : tr(' · not solved yet', ' · chưa giải')}
          </Text>
        </View>
        {todayStars > 0 ? <Stars count={todayStars} size={14} /> : <Text style={styles.dailyGo}>{tr('Play', 'Chơi')}</Text>}
      </Pressable>

      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={{ height: height + insets.bottom }}
        onLayout={onLayout}
        onContentSizeChange={focusCurrent}
        showsVerticalScrollIndicator={false}
      >
        {width > 0 &&
          levels.slice(0, -1).flatMap((level) =>
            Array.from({ length: DOTS }, (_, k) => {
              const t = (k + 1) / (DOTS + 1);
              const x = nodeX(level) + (nodeX(level + 1) - nodeX(level)) * t;
              const y = nodeY(level) + (nodeY(level + 1) - nodeY(level)) * t;
              const lit = level < current;
              return (
                <View
                  key={`dot-${level}-${k}`}
                  pointerEvents="none"
                  style={[styles.dot, { left: x - 4, top: y - 4, backgroundColor: lit ? STAR : 'rgba(255, 255, 255, 0.45)' }]}
                />
              );
            }),
          )}
        {width > 0 &&
          levels.map((level) => {
            const stars = levelStars(map, level);
            const locked = level > current;
            const isCurrent = level === current;
            const size = isCurrent ? CURRENT : NODE;
            const hard = isHardLevel(level);
            const name = hard ? tr(`Hard level ${level}`, `Màn khó ${level}`) : tr(`Level ${level}`, `Màn ${level}`);
            return (
              <View key={level} style={[styles.slot, { left: nodeX(level) - CURRENT / 2, top: nodeY(level) - size / 2 }]}>
                <Pressable
                  disabled={locked}
                  onPress={() => open(level)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locked ? tr(`${name}, locked`, `${name}, chưa mở`) : tr(`${name}, ${stars} stars`, `${name}, ${stars} sao`)
                  }
                  style={({ pressed }) => [
                    styles.node,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: locked ? LOCKED : isCurrent ? OPEN : DONE,
                      borderColor: locked ? LOCKED_EDGE : isCurrent ? OPEN_EDGE : DONE_EDGE,
                    },
                    isCurrent && styles.currentNode,
                    pressed && styles.pressed,
                  ]}
                >
                  {locked ? (
                    <SymbolView name="lock.fill" size={11} tintColor="#FFFFFF" style={styles.lock} />
                  ) : (
                    <Text style={[styles.number, isCurrent && styles.currentNumber]}>{level}</Text>
                  )}
                </Pressable>
                {hard && (
                  <SymbolView
                    name="crown.fill"
                    size={CROWN_SIZE}
                    tintColor={CROWN}
                    style={[styles.crown, { top: -CROWN_SIZE + 4, left: (CURRENT - CROWN_SIZE) / 2 }]}
                  />
                )}
                {!locked && !isCurrent && (
                  <View style={styles.starRow}>
                    <Stars count={stars} size={12} />
                  </View>
                )}
                {isCurrent && <Text style={[styles.play, { color: hud.text }]}>{tr('Play', 'Chơi')}</Text>}
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  daily: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF4DE',
    borderWidth: 3,
    borderColor: '#A86A35',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dailyIcon: { width: 26, height: 26 },
  dailyText: { flex: 1 },
  dailyTitle: { color: INK, fontSize: 16, fontWeight: '900' },
  dailySub: { color: INK_DIM, fontSize: 12, fontWeight: '600', marginTop: 2 },
  dailyGo: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: OPEN,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  scroll: { flex: 1 },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  slot: { position: 'absolute', width: CURRENT, alignItems: 'center' },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  currentNode: { borderWidth: 3 },
  pressed: { transform: [{ scale: 0.94 }] },
  number: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  currentNumber: { fontSize: 15 },
  lock: { width: 11, height: 11 },
  crown: {
    position: 'absolute',
    width: CROWN_SIZE,
    height: CROWN_SIZE,
    shadowColor: '#5A2E08',
    shadowOpacity: 0.5,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
  },
  starRow: { marginTop: 3 },
  play: { marginTop: 3, fontSize: 11, fontWeight: '900' },
});
