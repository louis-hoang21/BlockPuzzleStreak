import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initSfx, playSfx } from '../audio/sfx';
import { cachedPuzzle, loadPuzzle, mapKey, mapTune, piecesLeft, puzzleStars, withBudget, type PuzzleState } from '../core/stormPuzzle';
import { hapticCelebrate, hapticGameOver, hapticTap } from '../haptics';
import { useT } from '../i18n';
import { levelStars, loadMapRecords, saveLevelStars } from '../persistence/puzzleMap';
import { markPuzzleIntroSeen, puzzleIntroSeen } from '../persistence/stormPuzzle';
import { ThemeBackdrop } from '../render/Backdrops';
import { hudColors, skinById, themeById } from '../render/theme';
import { useSettingsStore } from '../store/settingsStore';
import {
  clock,
  endReason,
  howToPlay,
  kit,
  lostTitle,
  Overlay,
  PuzzleStage,
  RESULT_DELAY_MS,
  Stars,
  usePuzzleFx,
  type Reason,
} from './puzzleKit';

type Outcome = { won: boolean; reason: Reason; stars: number; best: number; left: number; seeds: number };

function ready(level: number): PuzzleState | null {
  const hit = cachedPuzzle(mapKey(level));
  return hit ? withBudget(hit, mapTune(level).extra) : null;
}

export function StormLevelScreen({ start }: { start: number }) {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const hud = hudColors(theme.tone);
  const [level, setLevel] = useState(start);
  const tune = mapTune(level);
  const limitMs = tune.minutes * 60_000;
  const [puzzle, setPuzzle] = useState<PuzzleState | null>(() => ready(start));
  const [deadline, setDeadline] = useState(() => Date.now() + limitMs);
  const [now, setNow] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [intro, setIntro] = useState(() => !puzzleIntroSeen());
  const fx = usePuzzleFx();
  const finished = useRef(false);
  const loadToken = useRef(0);
  const booted = useRef(false);
  const { reset, place } = fx;

  const running = puzzle !== null && !puzzle.over && outcome === null && !intro;

  useEffect(() => {
    initSfx();
  }, []);

  const startLevel = useCallback(
    (lv: number) => {
      finished.current = false;
      setOutcome(null);
      reset();
      setLevel(lv);
      const token = ++loadToken.current;
      const apply = (next: PuzzleState) => {
        if (token !== loadToken.current) return;
        setPuzzle(withBudget(next, mapTune(lv).extra));
        const at = Date.now();
        setNow(at);
        setDeadline(at + mapTune(lv).minutes * 60_000);
        loadPuzzle(mapKey(lv + 1)).catch(() => {});
      };
      const hit = cachedPuzzle(mapKey(lv));
      if (hit) {
        apply(hit);
        return;
      }
      setPuzzle(null);
      loadPuzzle(mapKey(lv)).then(apply, () => {});
    },
    [reset],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const token = loadToken.current;
    const first = puzzle ? Promise.resolve(null) : loadPuzzle(mapKey(start));
    first
      .then((loaded) => {
        if (loaded && token === loadToken.current) {
          setPuzzle(withBudget(loaded, mapTune(start).extra));
          const at = Date.now();
          setNow(at);
          setDeadline(at + mapTune(start).minutes * 60_000);
        }
        return loadPuzzle(mapKey(start + 1));
      })
      .catch(() => {});
  }, [puzzle, start]);

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
        setOutcome({ won: false, reason, stars: 0, best: levelStars(loadMapRecords(), level), left, seeds });
        return;
      }
      hapticCelebrate();
      const records = saveLevelStars(level, stars);
      playSfx(stars === 3 ? 'newRecordWin' : 'tieRecord');
      setOutcome({ won: true, reason, stars, best: levelStars(records, level), left, seeds });
    },
    [level],
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

  const closeIntro = () => {
    hapticTap();
    markPuzzleIntroSeen();
    setIntro(false);
    const at = Date.now();
    setNow(at);
    setDeadline(at + limitMs);
  };

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

  const toMap = () => {
    hapticTap();
    router.back();
  };

  const retry = () => {
    hapticTap();
    startLevel(level);
  };

  const next = () => {
    hapticTap();
    startLevel(level + 1);
  };

  return (
    <View style={[kit.container, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={theme.tone === 'light' ? 'dark' : 'light'} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <View style={kit.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={tr('Back to map', 'Về bản đồ')} style={kit.iconButton}>
          <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={kit.icon} />
        </Pressable>
        <View style={kit.titleBox}>
          <Text style={[kit.title, { color: hud.text }]} numberOfLines={1}>
            {tr('Level', 'Màn')} {level}
          </Text>
          <Text style={[kit.subtitle, { color: hud.textDim }]}>{clock(outcome?.reason === 'timeout' ? 0 : deadline - now)}</Text>
        </View>
        <View style={kit.iconButton} />
      </View>

      <PuzzleStage puzzle={puzzle} fx={fx} running={running} onDrop={onDrop} theme={theme} skin={skin} text={hud.text} />

      {outcome && (
        <Overlay>
          <Text style={kit.cardTitle}>{outcome.won ? tr(`Level ${level} done!`, `Xong màn ${level}!`) : lostTitle(tr, outcome.reason)}</Text>
          <Stars count={outcome.stars} size={34} />
          <Text style={kit.cardBody}>
            {outcome.won
              ? tr(`${outcome.left} pieces to spare.`, `Còn dư ${outcome.left} khối.`) +
                (outcome.best > outcome.stars ? tr(` Your best here is ${outcome.best} stars.`, ` Kỷ lục màn này: ${outcome.best} sao.`) : '')
              : tr(
                  `${outcome.seeds} dotted ${outcome.seeds === 1 ? 'block' : 'blocks'} left. Try the same level again.`,
                  `Còn ${outcome.seeds} khối có chấm. Thử lại màn này nhé.`,
                )}
          </Text>
          <View style={kit.row}>
            <Pressable style={kit.secondary} onPress={toMap} accessibilityRole="button">
              <Text style={kit.secondaryText}>{tr('Map', 'Bản đồ')}</Text>
            </Pressable>
            <Pressable style={kit.secondary} onPress={retry} accessibilityRole="button">
              <Text style={kit.secondaryText}>{tr('Retry', 'Chơi lại')}</Text>
            </Pressable>
          </View>
          {outcome.won && (
            <Pressable style={[kit.primary, kit.single]} onPress={next} accessibilityRole="button">
              <Text style={kit.primaryText}>{tr('Next level', 'Màn tiếp')}</Text>
            </Pressable>
          )}
        </Overlay>
      )}

      {intro && !outcome && (
        <Overlay>
          <Text style={kit.cardTitle}>{tr('How to play', 'Cách chơi')}</Text>
          <Text style={kit.cardBody}>{howToPlay(tr)}</Text>
          <Pressable style={[kit.primary, kit.single]} onPress={closeIntro} accessibilityRole="button">
            <Text style={kit.primaryText}>{tr('Start', 'Bắt đầu')}</Text>
          </Pressable>
        </Overlay>
      )}
    </View>
  );
}
