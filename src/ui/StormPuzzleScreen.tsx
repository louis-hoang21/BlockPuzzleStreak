import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initSfx, playSfx } from '../audio/sfx';
import { dailyPuzzle, dayKey, placeInPuzzle, puzzleStars, type PuzzleResult, type PuzzleState } from '../core/stormPuzzle';
import { STORM_PUZZLE_NAME } from '../core/modes';
import { hapticCelebrate, hapticClear, hapticGameOver, hapticPlace, hapticTap } from '../haptics';
import { useLang, useT } from '../i18n';
import { loadPuzzleRecords, savePuzzleStars, type PuzzleRecords } from '../persistence/stormPuzzle';
import { ThemeBackdrop } from '../render/Backdrops';
import { GameBoard, type ClearEvent, type ClearingCell } from '../render/GameBoard';
import { computeLayout, type BoardLayout } from '../render/layout';
import { hudColors, skinById, themeById } from '../render/theme';
import { useSettingsStore } from '../store/settingsStore';


const NO_SLOTS: readonly number[] = [];
const WEEKDAYS = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STAR = '#FFB547';
const RESULT_DELAY_MS = 700;

function clearedCells({ placed, cleared, cracked }: PuzzleResult): ClearingCell[] {
  const n = placed.size;
  const seen = new Set<number>(cracked);
  const out: ClearingCell[] = [];
  const add = (row: number, col: number) => {
    const i = row * n + col;
    if (seen.has(i)) return;
    seen.add(i);
    out.push({ row, col, color: placed.cells[i] - 1 });
  };
  for (const r of cleared.rows) for (let c = 0; c < n; c++) add(r, c);
  for (const c of cleared.cols) for (let r = 0; r < n; r++) add(r, c);
  return out;
}

function prettyDay(day: string, lang: 'en' | 'vi'): string {
  const [y, m, d] = day.split('-');
  return lang === 'en' ? `${MONTHS[Number(m) - 1].slice(0, 3)} ${Number(d)}, ${y}` : `${d}/${m}/${y}`;
}

export function StormPuzzleScreen() {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const lang = useLang();
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const hud = hudColors(theme.tone);
  const today = useMemo(() => dayKey(), []);
  const [puzzle, setPuzzle] = useState<PuzzleState>(() => dailyPuzzle(today));
  const [records, setRecords] = useState<PuzzleRecords>(() => loadPuzzleRecords());
  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [clearing, setClearing] = useState<ClearEvent | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const eventId = useRef(0);

  useEffect(() => {
    initSfx();
  }, []);

  useEffect(() => {
    if (!puzzle.over) return;
    const stars = puzzleStars(puzzle);
    const t = setTimeout(() => {
      if (stars > 0) {
        hapticCelebrate();
        playSfx(stars === 3 ? 'newRecordWin' : 'tieRecord');
      } else {
        hapticGameOver();
        playSfx('gameOver');
      }
      setShowResult(true);
    }, RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [puzzle]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeLayout(width, height));
  };

  const onDrop = useCallback(
    (slot: number, row: number, col: number) => {
      const result = placeInPuzzle(puzzle, slot, row, col);
      if (!result) return false;
      setPuzzle(result.state);
      const earned = puzzleStars(result.state);
      if (earned > 0) setRecords(savePuzzleStars(result.state.day, earned));
      if (result.lines > 0) {
        setClearing({
          id: ++eventId.current,
          cells: clearedCells(result),
          rows: result.cleared.rows,
          cols: result.cleared.cols,
          lines: result.lines,
        });
        hapticClear(result.lines);
        playSfx('clear');
      } else {
        hapticPlace();
        playSfx('place');
      }
      return true;
    },
    [puzzle],
  );

  const onRotate = useCallback(() => false, []);

  const restart = () => {
    hapticTap();
    setShowResult(false);
    setClearing(null);
    setPuzzle(dailyPuzzle(today));
  };

  const stars = puzzleStars(puzzle);
  const best = records.days[today] ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={theme.tone === 'light' ? 'dark' : 'light'} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={tr('Back', 'Quay lại')} style={styles.iconButton}>
          <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={styles.icon} />
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={[styles.title, { color: hud.text }]} numberOfLines={1}>
            {tr(STORM_PUZZLE_NAME)}
          </Text>
          <Text style={[styles.subtitle, { color: hud.textDim }]}>
            {prettyDay(today, lang)} · {tr('Chain clears', 'Nổ liên hoàn')} {puzzle.chained}/{puzzle.total}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            setShowCalendar(true);
          }}
          hitSlop={12}
          accessibilityLabel={tr('Puzzle calendar', 'Lịch giải đố')}
          style={styles.iconButton}
        >
          <SymbolView name="calendar" size={22} tintColor={hud.text} style={styles.icon} />
        </Pressable>
      </View>

      <View style={styles.boardArea} onLayout={onLayout}>
        {layout && (
          <GameBoard
            layout={layout}
            board={puzzle.board}
            wear={puzzle.wear}
            tray={puzzle.tray}
            clearing={clearing}
            storm={null}
            disabled={puzzle.over}
            onDrop={onDrop}
            onRotate={onRotate}
            hintSlots={NO_SLOTS}
            theme={theme}
            skin={skin}
          />
        )}
        {layout && (
          <View style={[styles.info, { left: layout.trayX, top: layout.meterY, width: layout.trayWidth, height: layout.meterHeight }]}>
            <Text style={[styles.infoText, { color: hud.text }]}>
              {tr('Blocks', 'Khối')} {puzzle.placed}/{puzzle.total} · {tr('Score', 'Điểm')} {puzzle.score.toLocaleString()}
            </Text>
            <Stars count={best} size={14} />
          </View>
        )}
      </View>

      {showResult && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{stars > 0 ? tr('Solved!', 'Đã giải xong!') : tr('No room left', 'Hết chỗ đặt')}</Text>
            <Stars count={stars} size={34} />
            <Text style={styles.cardBody}>
              {stars === 3
                ? tr('All 12 blocks chained. Perfect!', 'Cả 12 khối đều nổ liên hoàn. Hoàn hảo!')
                : stars > 0
                  ? tr(
                      `Chained ${puzzle.chained}/${puzzle.total} blocks. Try again for 3 stars!`,
                      `Nổ liên hoàn ${puzzle.chained}/${puzzle.total} khối. Thử lại để đạt 3 sao!`,
                    )
                  : tr('Every block has a spot that clears. Try again!', 'Mỗi khối đều có một chỗ nổ. Thử lại nhé!')}
            </Text>
            <Calendar records={records} today={today} />
            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={() => router.back()} accessibilityRole="button">
                <Text style={styles.secondaryText}>{tr('Home', 'Về')}</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={restart} accessibilityRole="button">
                <Text style={styles.primaryText}>{tr('Play again', 'Chơi lại')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {showCalendar && !showResult && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('Puzzle calendar', 'Lịch giải đố')}</Text>
            <Text style={styles.cardBody}>
              {tr('A new puzzle every day, the same for every player.', 'Mỗi ngày một đề mới, giống nhau cho mọi người chơi.')}
            </Text>
            <Calendar records={records} today={today} />
            <Pressable style={[styles.primary, styles.single]} onPress={() => setShowCalendar(false)} accessibilityRole="button">
              <Text style={styles.primaryText}>{tr('Close', 'Đóng')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Stars({ count, size }: { count: number; size: number }) {
  const tr = useT();
  return (
    <View style={styles.stars} accessibilityLabel={tr(count === 1 ? '1 star' : `${count} stars`, `${count} sao`)}>
      {[0, 1, 2].map((i) => (
        <SymbolView key={i} name={i < count ? 'star.fill' : 'star'} size={size} tintColor={STAR} style={{ width: size, height: size }} />
      ))}
    </View>
  );
}

function Calendar({ records, today }: { records: PuzzleRecords; today: string }) {
  const tr = useT();
  const lang = useLang();
  const [y, m] = today.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <View style={styles.calendar}>
      <Text style={styles.month}>
        {tr(`${MONTHS[m - 1]} ${y}`, `Tháng ${m}/${y}`)}
      </Text>
      <View style={styles.grid}>
        {WEEKDAYS[lang].map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.day} />;
          const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const got = records.days[key] ?? 0;
          return (
            <View key={key} style={[styles.day, key === today && styles.today, got > 0 && styles.solved]}>
              <Text style={[styles.dayText, got > 0 && styles.solvedText]}>{d}</Text>
              {got > 0 && <Text style={styles.dayStars}>{'★'.repeat(got)}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const INK = '#4E2F17';
const INK_DIM = '#7A5535';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 22, height: 22 },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  boardArea: { flex: 1 },
  info: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  infoText: { fontSize: 14, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: 'rgba(40, 22, 8, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFF4DE',
    borderWidth: 4,
    borderColor: '#A86A35',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: { color: INK, fontSize: 22, fontWeight: '900' },
  cardBody: { color: INK_DIM, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 4 },
  primary: { flex: 1, borderRadius: 999, paddingVertical: 10, backgroundColor: '#3DCB4A', alignItems: 'center' },
  single: { alignSelf: 'stretch', flex: 0 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(78, 47, 23, 0.3)',
    alignItems: 'center',
  },
  secondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
  calendar: { alignSelf: 'stretch', marginTop: 4 },
  month: { color: INK, fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: INK_DIM, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  today: { borderWidth: 2, borderColor: '#3FA9F5' },
  solved: { backgroundColor: '#F3DDB4' },
  dayText: { color: INK_DIM, fontSize: 13, fontWeight: '600' },
  solvedText: { color: INK, fontWeight: '800' },
  dayStars: { color: STAR, fontSize: 8, lineHeight: 9 },
});
