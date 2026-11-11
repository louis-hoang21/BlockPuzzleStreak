import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import balance from '../../config/balance.json';
import { initSfx, playSfx } from '../audio/sfx';
import {
  cachedPuzzle,
  clearedRatio,
  dayKey,
  levelsForStreak,
  loadPuzzle,
  minutesForStreak,
  placeInPuzzle,
  puzzleFor,
  puzzleStars,
  type PuzzleResult,
  type PuzzleState,
} from '../core/stormPuzzle';
import { STORM_PUZZLE_NAME } from '../core/modes';
import { hapticCelebrate, hapticClear, hapticGameOver, hapticPlace, hapticTap } from '../haptics';
import { useLang, useT } from '../i18n';
import {
  loadPuzzleRecords,
  puzzleStreak,
  puzzleVariant,
  reshufflePuzzle,
  savePuzzleStars,
  type PuzzleRecords,
} from '../persistence/stormPuzzle';
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

type Outcome = { kind: 'timeout' | 'lost' | 'level' | 'done'; stars: number; percent: number };

const [ONE_STAR, TWO_STARS] = balance.puzzle.stars.map((v) => Math.round(v * 100));

const percentOf = (puzzle: PuzzleState) => Math.floor((clearedRatio(puzzle) + 1e-9) * 100);

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function StormPuzzleScreen() {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const lang = useLang();
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const hud = hudColors(theme.tone);
  const today = useMemo(() => dayKey(), []);
  const [records, setRecords] = useState<PuzzleRecords>(() => loadPuzzleRecords());
  const streak = useMemo(() => puzzleStreak(records, today), [records, today]);
  const levels = levelsForStreak(streak);
  const minutes = minutesForStreak(streak);
  const limitMs = minutes * 60_000;
  const [variant, setVariant] = useState(() => puzzleVariant(today));
  const [level, setLevel] = useState(0);
  const [levelStars, setLevelStars] = useState<number[]>([]);
  const [puzzle, setPuzzle] = useState<PuzzleState | null>(() => puzzleFor({ day: today, level: 0, variant }));
  const [deadline, setDeadline] = useState(() => Date.now() + limitMs);
  const [now, setNow] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [clearing, setClearing] = useState<ClearEvent | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const eventId = useRef(0);
  const finished = useRef(false);
  const loadToken = useRef(0);
  const inRun = useRef(false);

  const running = puzzle !== null && !puzzle.over && outcome === null;

  useEffect(() => {
    initSfx();
  }, []);

  useEffect(() => {
    inRun.current = outcome === null ? level > 0 || (puzzle?.placed ?? 0) > 0 : outcome.kind === 'level';
  }, [outcome, level, puzzle]);

  useEffect(
    () => () => {
      if (inRun.current) reshufflePuzzle(today);
    },
    [today],
  );

  const prefetch = useCallback(
    (lv: number, v: number) => {
      if (lv < levels) loadPuzzle({ day: today, level: lv, variant: v }).catch(() => {});
    },
    [levels, today],
  );

  useEffect(() => {
    prefetch(1, variant);
  }, [prefetch, variant]);

  const finish = useCallback(
    (current: PuzzleState, stars: number, timeout: boolean) => {
      if (finished.current) return;
      finished.current = true;
      const percent = percentOf(current);
      if (stars === 0) {
        hapticGameOver();
        playSfx('gameOver');
        const next = reshufflePuzzle(today);
        setVariant(next);
        prefetch(0, next);
        setOutcome({ kind: timeout ? 'timeout' : 'lost', stars: 0, percent });
        return;
      }
      const all = [...levelStars, stars];
      setLevelStars(all);
      hapticCelebrate();
      if (all.length < levels) {
        playSfx('tieRecord');
        setOutcome({ kind: 'level', stars, percent });
        return;
      }
      const dayStars = Math.min(...all);
      playSfx(dayStars === 3 ? 'newRecordWin' : 'tieRecord');
      setRecords(savePuzzleStars(today, dayStars));
      setOutcome({ kind: 'done', stars: dayStars, percent });
    },
    [levelStars, levels, prefetch, today],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || !puzzle) return;
    const t = setTimeout(() => finish(puzzle, 0, true), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [running, puzzle, deadline, finish]);

  useEffect(() => {
    if (!puzzle?.over || outcome) return;
    const t = setTimeout(() => finish(puzzle, puzzleStars(puzzle), false), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [puzzle, outcome, finish]);

  const startLevel = (lv: number, v: number) => {
    hapticTap();
    finished.current = false;
    setOutcome(null);
    setClearing(null);
    setLevel(lv);
    if (lv === 0) setLevelStars([]);
    const key = { day: today, level: lv, variant: v };
    const token = ++loadToken.current;
    const apply = (next: PuzzleState) => {
      if (token !== loadToken.current) return;
      setPuzzle(next);
      const start = Date.now();
      setNow(start);
      setDeadline(start + limitMs);
      prefetch(lv + 1, v);
    };
    const hit = cachedPuzzle(key);
    if (hit) {
      apply(hit);
      return;
    }
    setPuzzle(null);
    loadPuzzle(key).then(apply, () => {});
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeLayout(width, height));
  };

  const onDrop = useCallback(
    (slot: number, row: number, col: number) => {
      if (!puzzle || outcome) return false;
      const result = placeInPuzzle(puzzle, slot, row, col);
      if (!result) return false;
      setPuzzle(result.state);
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
    [puzzle, outcome],
  );

  const onRotate = useCallback(() => false, []);

  const percent = puzzle ? percentOf(puzzle) : 0;
  const liveStars = puzzle ? puzzleStars(puzzle) : 0;
  const rules = tr(
    `1 star: clear ${ONE_STAR}% of the blocks. 2 stars: ${TWO_STARS}%. 3 stars: clear the grid completely.`,
    `1 sao: dọn ${ONE_STAR}% số khối. 2 sao: ${TWO_STARS}%. 3 sao: dọn sạch lưới.`,
  );
  const todayPlan = tr(
    `Streak ${streak} ${streak === 1 ? 'day' : 'days'} · today ${levels} ${levels === 1 ? 'level' : 'levels'}, ${minutes} min each`,
    `Chuỗi ${streak} ngày · hôm nay ${levels} màn, ${minutes} phút mỗi màn`,
  );

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
            {prettyDay(today, lang)} · {tr('Level', 'Màn')} {level + 1}/{levels} · {clock(outcome?.kind === 'timeout' ? 0 : deadline - now)}
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
        {layout && puzzle && (
          <GameBoard
            layout={layout}
            board={puzzle.board}
            wear={puzzle.wear}
            tray={puzzle.tray}
            clearing={clearing}
            storm={null}
            disabled={!running}
            onDrop={onDrop}
            onRotate={onRotate}
            hintSlots={NO_SLOTS}
            theme={theme}
            skin={skin}
          />
        )}
        {layout && puzzle && (
          <View style={[styles.info, { left: layout.trayX, top: layout.meterY, width: layout.trayWidth, height: layout.meterHeight }]}>
            <Text style={[styles.infoText, { color: hud.text }]}>
              {tr('Cleared', 'Đã dọn')} {percent}% · {tr('Blocks', 'Khối')} {puzzle.placed}/{puzzle.total}
            </Text>
            <Stars count={liveStars} size={14} />
          </View>
        )}
        {!puzzle && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={hud.text} />
          </View>
        )}
      </View>

      {outcome && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {outcome.kind === 'timeout'
                ? tr("Time's up!", 'Hết giờ!')
                : outcome.kind === 'lost'
                  ? tr('Not yet', 'Chưa đạt')
                  : outcome.kind === 'level'
                    ? tr(`Level ${level + 1}/${levels} done`, `Xong màn ${level + 1}/${levels}`)
                    : tr('Solved!', 'Đã giải xong!')}
            </Text>
            <Stars count={outcome.stars} size={34} />
            <Text style={styles.cardBody}>
              {outcome.kind === 'timeout'
                ? tr(
                    `You ran out of time. Play again and the blocks will be rearranged.`,
                    `Hết thời gian màn này. Chơi lại, các khối sẽ được xếp lại.`,
                  )
                : outcome.kind === 'lost'
                  ? tr(
                      `Cleared ${outcome.percent}%, you need ${ONE_STAR}% for 1 star. Play again and the blocks will be rearranged.`,
                      `Dọn được ${outcome.percent}%, cần ${ONE_STAR}% để có 1 sao. Chơi lại, các khối sẽ được xếp lại.`,
                    )
                  : outcome.kind === 'level'
                    ? tr(
                        `Cleared ${outcome.percent}%. ${levels - level - 1} more to earn today's stars.`,
                        `Dọn được ${outcome.percent}%. Còn ${levels - level - 1} màn nữa để nhận sao hôm nay.`,
                      )
                    : outcome.stars === 3
                      ? tr('Every level cleared completely. Perfect!', 'Dọn sạch mọi màn. Hoàn hảo!')
                      : levels > 1
                        ? tr(`Today's stars come from your lowest level. ${rules}`, `Sao hôm nay tính theo màn thấp nhất. ${rules}`)
                        : rules}
            </Text>
            {outcome.kind !== 'level' && <Calendar records={records} today={today} />}
            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={() => router.back()} accessibilityRole="button">
                <Text style={styles.secondaryText}>{tr('Home', 'Về')}</Text>
              </Pressable>
              <Pressable
                style={styles.primary}
                onPress={() => (outcome.kind === 'level' ? startLevel(level + 1, variant) : startLevel(0, variant))}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{outcome.kind === 'level' ? tr('Next level', 'Màn tiếp') : tr('Play again', 'Chơi lại')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {showCalendar && !outcome && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('Puzzle calendar', 'Lịch giải đố')}</Text>
            <Text style={styles.cardBody}>
              {tr('A new puzzle every day, the same for every player.', 'Mỗi ngày một đề mới, giống nhau cho mọi người chơi.')} {rules}
            </Text>
            <Text style={styles.cardBody}>{todayPlan}</Text>
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
            <View key={key} style={[styles.day, got > 0 && styles.solved]}>
              {key === today && <View pointerEvents="none" style={styles.today} />}
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
  loadingBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
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
  today: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 2, borderColor: '#3FA9F5' },
  solved: { backgroundColor: '#F3DDB4' },
  dayText: { color: INK_DIM, fontSize: 13, fontWeight: '600' },
  solvedText: { color: INK, fontWeight: '800' },
  dayStars: { color: STAR, fontSize: 8, lineHeight: 9 },
});
