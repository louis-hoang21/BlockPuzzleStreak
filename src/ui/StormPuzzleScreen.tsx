import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initSfx, playSfx } from '../audio/sfx';
import {
  cachedPuzzle,
  dayKey,
  extraForStreak,
  levelsForStreak,
  loadPuzzle,
  minutesForStreak,
  piecesLeft,
  puzzleFor,
  puzzleStars,
  withBudget,
  type PuzzleState,
} from '../core/stormPuzzle';
import { hapticCelebrate, hapticGameOver, hapticTap } from '../haptics';
import { useLang, useT } from '../i18n';
import {
  loadPuzzleRecords,
  markPuzzleIntroSeen,
  puzzleIntroSeen,
  puzzleStreak,
  puzzleVariant,
  reshufflePuzzle,
  savePuzzleStars,
  type PuzzleRecords,
} from '../persistence/stormPuzzle';
import { ThemeBackdrop } from '../render/Backdrops';
import { hudColors, skinById, themeById } from '../render/theme';
import { useSettingsStore } from '../store/settingsStore';
import {
  clock,
  endReason,
  howToPlay,
  INK,
  INK_DIM,
  kit,
  lostTitle,
  Overlay,
  PuzzleStage,
  puzzleRules,
  RESULT_DELAY_MS,
  Stars,
  STAR,
  usePuzzleFx,
  type Reason,
} from './puzzleKit';

const WEEKDAYS = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function prettyDay(day: string, lang: 'en' | 'vi'): string {
  const [y, m, d] = day.split('-');
  return lang === 'en' ? `${MONTHS[Number(m) - 1].slice(0, 3)} ${Number(d)}, ${y}` : `${d}/${m}/${y}`;
}

type Outcome = { kind: 'lost' | 'level' | 'done'; reason: Reason; stars: number; left: number; seeds: number };

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
  const extra = extraForStreak(streak);
  const [variant, setVariant] = useState(() => puzzleVariant(today));
  const [level, setLevel] = useState(0);
  const [levelStars, setLevelStars] = useState<number[]>([]);
  const [puzzle, setPuzzle] = useState<PuzzleState | null>(() => withBudget(puzzleFor({ day: today, level: 0, variant }), extra));
  const [deadline, setDeadline] = useState(() => Date.now() + limitMs);
  const [now, setNow] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [intro, setIntro] = useState(() => !puzzleIntroSeen());
  const fx = usePuzzleFx();
  const finished = useRef(false);
  const loadToken = useRef(0);
  const inRun = useRef(false);

  const running = puzzle !== null && !puzzle.over && outcome === null && !intro;

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
    (current: PuzzleState, reason: Reason) => {
      if (finished.current) return;
      finished.current = true;
      const stars = puzzleStars(current);
      const left = piecesLeft(current);
      const seeds = current.seeds.length;
      if (stars === 0) {
        hapticGameOver();
        playSfx('gameOver');
        const next = reshufflePuzzle(today);
        setVariant(next);
        prefetch(0, next);
        setOutcome({ kind: 'lost', reason, stars: 0, left, seeds });
        return;
      }
      const all = [...levelStars, stars];
      setLevelStars(all);
      hapticCelebrate();
      if (all.length < levels) {
        playSfx('tieRecord');
        setOutcome({ kind: 'level', reason, stars, left, seeds });
        return;
      }
      const dayStars = Math.min(...all);
      playSfx(dayStars === 3 ? 'newRecordWin' : 'tieRecord');
      setRecords(savePuzzleStars(today, dayStars));
      setOutcome({ kind: 'done', reason, stars: dayStars, left, seeds });
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
    const t = setTimeout(() => finish(puzzle, 'timeout'), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [running, puzzle, deadline, finish]);

  useEffect(() => {
    if (!puzzle?.over || outcome) return;
    const t = setTimeout(() => finish(puzzle, endReason(puzzle)), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [puzzle, outcome, finish]);

  const startLevel = (lv: number, v: number) => {
    hapticTap();
    finished.current = false;
    setOutcome(null);
    fx.reset();
    setLevel(lv);
    if (lv === 0) setLevelStars([]);
    const key = { day: today, level: lv, variant: v };
    const token = ++loadToken.current;
    const apply = (next: PuzzleState) => {
      if (token !== loadToken.current) return;
      setPuzzle(withBudget(next, extra));
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

  const closeIntro = () => {
    hapticTap();
    markPuzzleIntroSeen();
    setIntro(false);
    const start = Date.now();
    setNow(start);
    setDeadline(start + limitMs);
  };

  const { place } = fx;
  const onDrop = useCallback(
    (slot: number, row: number, col: number) => {
      if (!puzzle || outcome) return false;
      const next = place(puzzle, slot, row, col);
      if (!next) return false;
      setPuzzle(next);
      return true;
    },
    [puzzle, outcome, place],
  );

  const rules = puzzleRules(tr);
  const ended =
    outcome?.reason === 'stuck'
      ? tr('No room left. ', 'Hết chỗ đặt. ')
      : outcome?.reason === 'timeout'
        ? tr("Time's up. ", 'Hết giờ. ')
        : outcome?.reason === 'clear'
          ? tr('All dotted blocks cleared! ', 'Đã phá hết khối có chấm! ')
          : '';
  const todayPlan = tr(
    `Streak ${streak} ${streak === 1 ? 'day' : 'days'} · today ${levels} ${levels === 1 ? 'level' : 'levels'}, ${minutes} min and ${extra} spare pieces each`,
    `Chuỗi ${streak} ngày · hôm nay ${levels} màn, mỗi màn ${minutes} phút và ${extra} khối dư`,
  );

  return (
    <View style={[kit.container, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={theme.tone === 'light' ? 'dark' : 'light'} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <View style={kit.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={tr('Back', 'Quay lại')} style={kit.iconButton}>
          <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={kit.icon} />
        </Pressable>
        <View style={kit.titleBox}>
          <Text style={[kit.title, { color: hud.text }]} numberOfLines={1}>
            {tr('Daily challenge', 'Thử thách hôm nay')}
          </Text>
          <Text style={[kit.subtitle, { color: hud.textDim }]}>
            {prettyDay(today, lang)} · {tr('Level', 'Màn')} {level + 1}/{levels} · {clock(outcome?.reason === 'timeout' ? 0 : deadline - now)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            setShowCalendar(true);
          }}
          hitSlop={12}
          accessibilityLabel={tr('Puzzle calendar', 'Lịch giải đố')}
          style={kit.iconButton}
        >
          <SymbolView name="calendar" size={22} tintColor={hud.text} style={kit.icon} />
        </Pressable>
      </View>

      <PuzzleStage puzzle={puzzle} fx={fx} running={running} onDrop={onDrop} theme={theme} skin={skin} text={hud.text} />

      {outcome && (
        <Overlay>
          <Text style={kit.cardTitle}>
            {outcome.kind === 'lost'
              ? lostTitle(tr, outcome.reason)
              : outcome.kind === 'level'
                ? tr(`Level ${level + 1}/${levels} done`, `Xong màn ${level + 1}/${levels}`)
                : tr('Solved!', 'Đã giải xong!')}
          </Text>
          <Stars count={outcome.stars} size={34} />
          <Text style={kit.cardBody}>
            {outcome.kind === 'lost'
              ? tr(
                  `${outcome.seeds} dotted ${outcome.seeds === 1 ? 'block' : 'blocks'} left. Play again and the blocks will be rearranged.`,
                  `Còn ${outcome.seeds} khối có chấm. Chơi lại, các khối sẽ được xếp lại.`,
                )
              : outcome.kind === 'level'
                ? ended +
                  tr(
                    `${outcome.left} pieces to spare. ${levels - level - 1} more to earn today's stars.`,
                    `Còn dư ${outcome.left} khối. Còn ${levels - level - 1} màn nữa để nhận sao hôm nay.`,
                  )
                : outcome.stars === 3
                  ? tr('3 stars on every level. Perfect!', '3 sao mọi màn. Hoàn hảo!')
                  : ended + (levels > 1 ? tr(`Today's stars come from your lowest level. ${rules}`, `Sao hôm nay tính theo màn thấp nhất. ${rules}`) : rules)}
          </Text>
          {outcome.kind !== 'level' && <Calendar records={records} today={today} />}
          <View style={kit.row}>
            <Pressable style={kit.secondary} onPress={() => router.back()} accessibilityRole="button">
              <Text style={kit.secondaryText}>{tr('Back', 'Về')}</Text>
            </Pressable>
            <Pressable
              style={kit.primary}
              onPress={() => (outcome.kind === 'level' ? startLevel(level + 1, variant) : startLevel(0, variant))}
              accessibilityRole="button"
            >
              <Text style={kit.primaryText}>{outcome.kind === 'level' ? tr('Next level', 'Màn tiếp') : tr('Play again', 'Chơi lại')}</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {intro && !outcome && (
        <Overlay>
          <Text style={kit.cardTitle}>{tr('How to play', 'Cách chơi')}</Text>
          <Text style={kit.cardBody}>{howToPlay(tr)}</Text>
          <Text style={kit.cardBody}>{todayPlan}</Text>
          <Pressable style={[kit.primary, kit.single]} onPress={closeIntro} accessibilityRole="button">
            <Text style={kit.primaryText}>{tr('Start', 'Bắt đầu')}</Text>
          </Pressable>
        </Overlay>
      )}

      {showCalendar && !outcome && (
        <Overlay>
          <Text style={kit.cardTitle}>{tr('Puzzle calendar', 'Lịch giải đố')}</Text>
          <Text style={kit.cardBody}>
            {tr('A new puzzle every day, the same for every player.', 'Mỗi ngày một đề mới, giống nhau cho mọi người chơi.')} {rules}
          </Text>
          <Text style={kit.cardBody}>{todayPlan}</Text>
          <Calendar records={records} today={today} />
          <Pressable style={[kit.primary, kit.single]} onPress={() => setShowCalendar(false)} accessibilityRole="button">
            <Text style={kit.primaryText}>{tr('Close', 'Đóng')}</Text>
          </Pressable>
        </Overlay>
      )}
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

const styles = StyleSheet.create({
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
