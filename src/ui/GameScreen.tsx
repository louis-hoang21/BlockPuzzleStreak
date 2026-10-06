import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { comboSfx, initSfx, playSfx } from '../audio/sfx';
import { markReviewPromptShown, requestStoreReview, reviewPromptDelay } from '../review/reviewPrompt';
import balance from '../../config/balance.json';
import type { CellRect } from '../core/board';
import { hasMove, rescueSlots, stormEnergy, type PlaceResult } from '../core/game';
import { stageAt, stageColor } from '../core/stages';
import {
  hapticCelebrate,
  hapticClear,
  hapticCombo,
  hapticGameOver,
  hapticPlace,
  hapticTap,
  hapticWarning,
} from '../haptics';
import { Fireworks } from '../render/Fireworks';
import { ThemeBackdrop } from '../render/Backdrops';
import { GameBoard, type ClearEvent, type ClearingCell, type StormWave } from '../render/GameBoard';
import { computeLayout, type BoardLayout } from '../render/layout';
import { COLORS, hudColors, rotationBadgeColor, skinById, STAGE_LOOKS, themeById } from '../render/theme';
import { useGameStore, type Mode } from '../store/gameStore';
import { useNoticeStore, type Notice, type NoticeTone, type RewardKind } from '../store/noticeStore';
import { useRecordsStore, type GameResult } from '../store/recordsStore';
import { useSettingsStore } from '../store/settingsStore';
import { t, useT } from '../i18n';
import { gameOverLine, type LineTone } from './gameOverLines';
import { Onboarding, TUTORIAL_VERSION } from './Onboarding';
import { StormMeter } from './StormMeter';

export interface Popup {
  id: number;
  points: number;
  label: string | null;
}

interface ComboEvent {
  id: number;
  combo: number;
}

const GAME_OVER_DELAY_MS = 700;
const NO_SLOTS: number[] = [];

const LINE_ICONS = {
  newBest: { name: 'crown.fill', color: '#FFD84D' },
  close: { name: 'flame.fill', color: '#FF6B2C' },
  encourage: { name: 'hand.thumbsup.fill', color: '#3DCB4A' },
  tease: { name: 'face.smiling.inverse', color: '#FFD84D' },
} as const satisfies Record<LineTone, { name: SFSymbol; color: string }>;
const TOAST_MS = 1400;
const SCORE_POPUP_MS = 2200;
const SCORE_HOLD = 0.7;
const BADGE_PULSE_MS = 3000;
const BADGE_PULSES = 6;
const STAGE_SFX_DELAY_MS = 350;
const HEART_MULTIPLIER = balance.heart.multiplier;
const STORM_SFX_DELAY_MS = 350;
const STORM_COLOR = '#3FA9F5';
const STAGE_FADE_MS = 700;
const CARD_LOOK = {
  bg: '#5A2438',
  button: '#3DCB4A',
  buttonText: '#FFFFFF',
} as const;
const REWARD_DELAY_MS = 250;
const REWARD_MS = 1600;
const APPLY_PROMPT_MS = 3000;
const ROTATION_GAIN_MS = 1600;
const REWARD_ICONS = {
  rotation: {
    name: 'arrow.clockwise.circle.fill',
    color: '#3DCB4A',
    title: { en: 'More rotations!', vi: 'Thêm lượt xoay!' },
  },
  theme: { name: 'paintpalette.fill', color: '#4FC3F7' },
  skin: { name: 'sparkles', color: '#FF5FD2' },
} as const satisfies Record<RewardKind, { name: SFSymbol; color: string; title?: { en: string; vi: string } }>;
const RECORD_FIREWORKS_GAP_MS = 1100;
const RECORD_SFX_DELAY_MS = 500;
export const COMBO_SFX_DELAY_MS = 120;
const GIFT_SFX_DELAY_MS = 180;
const COMBO_COLORS = ['#4FC3F7', '#7BD84F', '#FFD84D', '#FF8A1F', '#FF4D6D', '#FF5FD2'];

function clearedCells(result: PlaceResult): ClearingCell[] {
  const { placed, cleared } = result;
  const n = placed.size;
  const seen = new Set<number>();
  const out: ClearingCell[] = [];
  const add = (row: number, col: number) => {
    const i = row * n + col;
    if (seen.has(i) || placed.cells[i] === 0) return;
    seen.add(i);
    out.push({ row, col, color: placed.cells[i] - 1 });
  };
  for (const r of cleared.rows) for (let c = 0; c < n; c++) add(r, c);
  for (const c of cleared.cols) for (let r = 0; r < n; r++) add(r, c);
  return out;
}

function popupLabel(result: PlaceResult): string | null {
  const { score } = result;
  if (score.perfectClearPoints > 0) return 'Amazing!';
  if (score.heart) return t(`x${HEART_MULTIPLIER} points`, `x${HEART_MULTIPLIER} điểm`);
  if (result.gift) return t('Gift blast!', 'Nổ quà!');
  return null;
}

export function GameScreen({ mode }: { mode: Mode }) {
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { game, result } = useGameStore((s) => s.modes[mode]);
  const rotations = game.rotations;
  const placeIn = useGameStore((s) => s.place);
  const rotateIn = useGameStore((s) => s.rotate);
  const startIn = useGameStore((s) => s.start);
  const bestScore = useRecordsStore((s) => s.byMode[mode].bestScore);
  const best = Math.max(bestScore, game.score);
  const notice = useNoticeStore((s) => s.queue[0]);
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const onboarded = useSettingsStore((s) => s.onboarded && s.tutorialVersion >= TUTORIAL_VERSION);

  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [clearing, setClearing] = useState<ClearEvent | null>(null);
  const [storm, setStorm] = useState<StormWave | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [comboEvent, setComboEvent] = useState<ComboEvent | null>(null);
  const [multiLines, setMultiLines] = useState<{
    id: number;
    lines: number;
  } | null>(null);
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const [recordEvent, setRecordEvent] = useState<number | null>(null);
  const [niceEvent, setNiceEvent] = useState<{
    id: number;
    rect: CellRect;
  } | null>(null);
  const bestPulse = useSharedValue(1);
  const bestStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bestPulse.value }],
  }));
  const [fireworks, setFireworks] = useState<number | null>(null);
  const eventId = useRef(0);
  const over = useGameOverFlow(game.over, result);
  const giveUpIn = useGameStore((s) => s.giveUp);
  const stuck = !game.over && !hasMove(game.board, game.tray);
  const [offer, setOffer] = useState<'rotate' | 'storm' | null>(null);
  const [rescuing, setRescuing] = useState(false);
  if (!stuck && (offer || rescuing)) {
    setOffer(null);
    setRescuing(false);
  }
  const canRotate = useMemo(() => stuck && rescueSlots(game).length > 0, [stuck, game]);
  useEffect(() => {
    if (!stuck || rescuing) return;
    const t = setTimeout(() => {
      hapticWarning();
      setOffer(canRotate ? 'rotate' : 'storm');
    }, GAME_OVER_DELAY_MS);
    return () => clearTimeout(t);
  }, [stuck, rescuing, canRotate]);
  const hintSlots = useMemo(() => (rescuing && stuck ? rescueSlots(game) : NO_SLOTS), [rescuing, stuck, game]);

  useEffect(() => {
    initSfx();
    useGameStore.getState().resume(mode);
  }, [mode]);

  const badgePulse = useSharedValue(1);
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));
  useEffect(() => {
    if (useGameStore.getState().modes[mode].game.rotations < 1) return;
    const beat = BADGE_PULSE_MS / BADGE_PULSES / 2;
    badgePulse.set(
      withRepeat(withSequence(withTiming(1.25, { duration: beat }), withTiming(1, { duration: beat })), BADGE_PULSES),
    );
  }, [mode, game.seed, badgePulse]);
  const stage = stageColor(stageAt(game.score), game.seed ?? 0);
  const stageLook = stage ? STAGE_LOOKS[stage] : null;
  const hud = hudColors(stageLook?.tone ?? theme.tone);

  const losses = useRecordsStore((s) => s.byMode[mode].gamesBelowBest);
  const meter = stormEnergy(game);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeLayout(width, height));
  };

  const onDrop = useCallback(
    (slot: number, row: number, col: number) => {
      const result = placeIn(mode, slot, row, col);
      if (!result) return false;
      const id = ++eventId.current;
      const { lines, combo, perfectClearPoints, total } = result.score;
      if (lines > 0 || result.heart) setPopup({ id, points: total, label: popupLabel(result) });
      if (lines > 0) {
        setClearing({
          id,
          cells: clearedCells(result),
          rows: result.cleared.rows,
          cols: result.cleared.cols,
          lines,
        });
        if (combo >= 2) setComboEvent({ id, combo });
        if (lines >= 2) setMultiLines({ id, lines });
        if (lines >= 3) {
          const a = 10;
          shakeX.set(
            withSequence(
              withTiming(a, { duration: 40 }),
              withTiming(-a, { duration: 60 }),
              withTiming(a * 0.6, { duration: 60 }),
              withTiming(-a * 0.6, { duration: 60 }),
              withTiming(a * 0.25, { duration: 50 }),
              withTiming(0, { duration: 50 }),
            ),
          );
        }
      }
      const score = result.state.score;
      const oldBest = useRecordsStore.getState().byMode[mode].bestScore;
      const passedRecord = oldBest > 0 && score - total <= oldBest && score > oldBest;
      const newStage = stageAt(score) > stageAt(score - total);
      if (perfectClearPoints > 0 || passedRecord || newStage) setFireworks(id);
      if (newStage) {
        const a = 14;
        shakeX.set(
          withSequence(
            withTiming(a, { duration: 45 }),
            withTiming(-a, { duration: 70 }),
            withTiming(a * 0.7, { duration: 70 }),
            withTiming(-a * 0.7, { duration: 70 }),
            withTiming(a * 0.4, { duration: 60 }),
            withTiming(-a * 0.2, { duration: 60 }),
            withTiming(0, { duration: 50 }),
          ),
        );
      }
      if (result.gift) {
        const a = 12;
        shakeX.set(
          withSequence(
            withTiming(a, { duration: 40 }),
            withTiming(-a, { duration: 60 }),
            withTiming(a * 0.6, { duration: 60 }),
            withTiming(-a * 0.6, { duration: 60 }),
            withTiming(0, { duration: 60 }),
          ),
        );
        setTimeout(() => {
          hapticCelebrate();
          playSfx('rotate');
        }, GIFT_SFX_DELAY_MS);
      }
      const nice = result.heart;
      if (nice) setNiceEvent({ id, rect: nice });
      if (passedRecord) {
        setRecordEvent(id);
        bestPulse.set(
          withSequence(
            withTiming(1.5, { duration: 160 }),
            withTiming(1, { duration: 220 }),
            withTiming(1.3, { duration: 140 }),
            withTiming(1, { duration: 200 }),
          ),
        );
      }

      if (perfectClearPoints > 0) {
        hapticCelebrate();
        playSfx('fireworks');
        setTimeout(() => playSfx('amazing'), 250);
      } else if (lines > 0) {
        if (combo >= 2) hapticCombo(combo);
        else hapticClear(lines);
        playSfx('clear');
      } else {
        if (!nice) hapticPlace();
        playSfx('place');
      }
      if (combo >= 2) setTimeout(() => playSfx(comboSfx(combo)), COMBO_SFX_DELAY_MS);
      if (newStage) {
        setTimeout(
          () => {
            hapticCelebrate();
            playSfx('fireworks');
          },
          lines > 0 ? STAGE_SFX_DELAY_MS : 0,
        );
      }
      if (passedRecord) {
        const delay = lines > 0 || perfectClearPoints > 0 ? RECORD_SFX_DELAY_MS : 0;
        setTimeout(() => {
          hapticCelebrate();
          playSfx('newRecord');
        }, delay);
      }
      return true;
    },
    [
      mode,
      placeIn,
      shakeX,
      bestPulse,
      setFireworks,
      setClearing,
      setPopup,
      setComboEvent,
      setMultiLines,
      setNiceEvent,
      setRecordEvent,
    ],
  );

  const onRotate = useCallback(
    (slot: number) => {
      if (useGameStore.getState().modes[mode].game.rotations <= 0) {
        hapticWarning();
        useNoticeStore.getState().push(t('No rotations left', 'Hết lượt xoay'), undefined, undefined, 'error');
        return false;
      }
      if (!rotateIn(mode, slot)) return false;
      hapticTap();
      playSfx('rotate');
      return true;
    },
    [mode, rotateIn],
  );

  const callStorm = () => {
    const result = useGameStore.getState().storm(mode);
    if (!result) return;
    setOffer(null);
    setRescuing(false);
    setClearing(null);
    setStorm({ id: ++eventId.current, before: result.before });
    const g = 6;
    shakeX.set(
      withSequence(
        withTiming(g, { duration: 50 }),
        withTiming(-g, { duration: 70 }),
        withTiming(g * 0.6, { duration: 70 }),
        withTiming(-g * 0.6, { duration: 70 }),
        withTiming(0, { duration: 60 }),
      ),
    );
    hapticTap();
    setTimeout(() => {
      hapticCelebrate();
      playSfx('rotate');
    }, STORM_SFX_DELAY_MS);
  };

  const acceptRotate = () => {
    hapticTap();
    setOffer(null);
    setRescuing(true);
    const beat = BADGE_PULSE_MS / BADGE_PULSES / 2;
    badgePulse.set(
      withRepeat(withSequence(withTiming(1.25, { duration: beat }), withTiming(1, { duration: beat })), BADGE_PULSES),
    );
    useNoticeStore.getState().push(t('Tap the bouncing block to rotate it', 'Chạm vào khối đang nhấp nhô để xoay'));
  };

  const declineRotate = () => {
    hapticTap();
    if (meter.ready) {
      setOffer('storm');
      return;
    }
    setOffer(null);
    giveUpIn(mode);
  };

  const declineStorm = () => {
    hapticTap();
    setOffer(null);
    giveUpIn(mode);
  };

  const restart = () => {
    hapticTap();
    over.reset();
    setClearing(null);
    setPopup(null);
    setComboEvent(null);
    setMultiLines(null);
    setRecordEvent(null);
    setNiceEvent(null);
    setFireworks(null);
    startIn(mode);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar style={(stageLook?.tone ?? theme.tone) === 'light' ? 'dark' : 'light'} />
      <StageBackground color={stageLook?.background ?? null} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" style={styles.iconButton}>
          <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={styles.icon} />
        </Pressable>
        <View style={styles.scoreBox}>
          <Text
            style={[styles.score, { color: hud.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {game.score.toLocaleString()}
          </Text>
          <Animated.View style={[styles.bestRow, bestStyle]}>
            <SymbolView name="crown.fill" size={14} tintColor={hud.accent} style={styles.bestIcon} />
            <Text
              style={[styles.best, { color: hud.accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {best.toLocaleString()}
            </Text>
          </Animated.View>
          {notice && !notice.reward && (
            <Toast key={`toast-${notice.id}`} text={notice.text} tone={notice.tone} compact />
          )}
        </View>
        <Animated.View style={badgeStyle}>
          <Pressable
            onPress={() => {
              hapticTap();
              const notices = useNoticeStore.getState();
              if (rotations > 0) {
                notices.push(
                  tr(
                    `Tap a block in the tray to rotate it (${rotations} left)`,
                    `Chạm vào khối trong khay để xoay (còn ${rotations} lượt)`,
                  ),
                );
              } else {
                notices.push(
                  tr('No rotations left. Hit score milestones to earn more', 'Hết lượt xoay. Vượt mốc điểm để nhận thêm'),
                  undefined,
                  undefined,
                  'error',
                );
              }
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tr(`${rotations} rotations`, `${rotations} lượt xoay`)}
            style={({ pressed }) => [
              styles.rotations,
              { backgroundColor: rotationBadgeColor(theme) },
              pressed && { opacity: 0.7 },
            ]}
          >
            <SymbolView
              name="arrow.clockwise"
              size={16}
              weight="bold"
              tintColor={COLORS.text}
              style={styles.rotationsIcon}
            />
            <Text style={styles.rotationsText}>{rotations}</Text>
          </Pressable>
        </Animated.View>
        {notice?.reward === 'rotation' && (
          <RotationGain
            key={`gain-${notice.id}`}
            text={notice.text}
            onShow={() =>
              badgePulse.set(
                withRepeat(withSequence(withTiming(1.25, { duration: 150 }), withTiming(1, { duration: 150 })), 3),
              )
            }
          />
        )}
      </View>

      <View style={styles.boardArea} onLayout={onLayout}>
        {layout && (
          <Animated.View style={shakeStyle}>
            <GameBoard
              layout={layout}
              board={game.board}
              tray={game.tray}
              clearing={clearing}
              storm={storm}
              gift={game.gift}
              disabled={game.over || !onboarded || offer !== null}
              onDrop={onDrop}
              onRotate={onRotate}
              hintSlots={hintSlots}
              theme={theme}
              skin={skin}
            />
          </Animated.View>
        )}
        {layout && (
          <StormMeter
            x={layout.trayX}
            y={layout.meterY}
            width={layout.trayWidth}
            height={layout.meterHeight}
            energy={meter.energy}
            need={meter.need}
            ready={meter.ready}
            done={meter.done}
            disabled={game.over || !onboarded || offer === 'rotate'}
            onPress={callStorm}
            tone={stageLook?.tone ?? theme.tone}
            textColor={hud.text}
          />
        )}
        {layout && fireworks !== null && <Fireworks id={fireworks} width={layout.width} height={layout.height} />}
        {layout && notice?.reward && notice.reward !== 'rotation' && !notice.apply && (
          <RewardPopup
            key={`reward-${notice.id}`}
            kind={notice.reward}
            text={notice.text}
            top={layout.boardY + layout.boardSize * 0.12}
            onShow={() => setFireworks(++eventId.current)}
          />
        )}
        {layout && popup && (
          <ScorePopup key={`score-${popup.id}`} popup={popup} top={layout.boardY + layout.boardSize / 2 - 40} />
        )}
        {layout && niceEvent && (
          <HeartPop
            key={`heart-${niceEvent.id}`}
            x={layout.boardX + (niceEvent.rect.col + niceEvent.rect.cols / 2) * layout.cell}
            y={layout.boardY + (niceEvent.rect.row + niceEvent.rect.rows / 2) * layout.cell}
          />
        )}
        {layout && recordEvent !== null && (
          <RecordBanner key={`record-${recordEvent}`} top={Math.max(0, layout.boardY + layout.boardSize / 2 - 200)} />
        )}
        {layout && multiLines && (
          <LinesBanner
            key={`lines-${multiLines.id}`}
            lines={multiLines.lines}
            top={layout.boardY + layout.boardSize / 2 + 20}
          />
        )}
        {layout && comboEvent && (
          <ComboBanner
            key={`combo-${comboEvent.id}`}
            combo={comboEvent.combo}
            top={layout.boardY + layout.boardSize / 2 - 130}
          />
        )}
      </View>

      {offer === 'rotate' && stuck && !rescuing && (
        <RotateOffer rotations={rotations} onUse={acceptRotate} onSkip={declineRotate} />
      )}
      {offer === 'storm' && stuck && meter.ready && <StormOffer onUse={callStorm} onSkip={declineStorm} />}

      {over.showGameOver && (
        <GameOverOverlay
          score={game.score}
          best={best}
          result={result}
          losses={losses}
          stats={[
            { label: tr('Lines cleared', 'Hàng nổ'), value: game.stats.linesCleared },
            {
              label: tr('Best combo', 'Combo cao nhất'),
              value: game.stats.maxCombo > 0 ? `x${game.stats.maxCombo}` : '–',
            },
            { label: tr('Blocks placed', 'Lượt đặt'), value: game.stats.placements },
          ]}
          recordFireworks={over.recordFireworks}
          showReview={over.showReview}
          onCloseReview={() => over.setShowReview(false)}
          onRestart={restart}
        />
      )}

      {notice?.apply && <ApplyPrompt key={`apply-${notice.id}`} notice={notice} />}

      {!onboarded && <Onboarding onDone={() => useSettingsStore.getState().update({ onboarded: true, tutorialVersion: TUTORIAL_VERSION })} />}
    </View>
  );
}

export function useGameOverFlow(isOver: boolean, result: GameResult | null) {
  const [showGameOver, setShowGameOver] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [recordFireworks, setRecordFireworks] = useState<number | null>(null);
  const ids = useRef(0);
  useEffect(() => {
    if (!isOver) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = setTimeout(() => {
      if (result?.newBest) {
        hapticCelebrate();
        playSfx('newRecordWin');
        setRecordFireworks(++ids.current);
        timers.push(setTimeout(() => setRecordFireworks(++ids.current), RECORD_FIREWORKS_GAP_MS));
      } else {
        hapticGameOver();
        playSfx(result?.tiedBest ? 'tieRecord' : 'gameOver');
      }
      setShowGameOver(true);
      const delay = reviewPromptDelay();
      if (delay !== null) {
        timers.push(
          setTimeout(() => {
            markReviewPromptShown();
            setShowReview(true);
          }, delay),
        );
      }
    }, GAME_OVER_DELAY_MS);
    return () => {
      clearTimeout(t);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver]);
  const reset = () => {
    setShowGameOver(false);
    setShowReview(false);
    setRecordFireworks(null);
  };
  return { showGameOver, showReview, setShowReview, recordFireworks, reset };
}

export function GameOverOverlay({
  score,
  best,
  result,
  losses,
  stats,
  recordFireworks,
  showReview,
  onCloseReview,
  onRestart,
}: {
  score: number;
  best: number;
  result: GameResult | null;
  losses: number;
  stats: { label: string; value: number | string }[];
  recordFireworks: number | null;
  showReview: boolean;
  onCloseReview: () => void;
  onRestart: () => void;
}) {
  const tr = useT();
  const screen = useWindowDimensions();
  const overLine = useMemo(
    () => (result ? gameOverLine(score, best, result.newBest, losses) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, score, best],
  );
  return (
    <>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: CARD_LOOK.bg }]}>
          <Text style={styles.cardTitle}>{tr('Out of moves!', 'Hết chiêuuuu')}</Text>
          {result?.newBest && <NewBestBadge />}
          <Text style={styles.cardScore} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {score.toLocaleString()}
          </Text>
          <Text style={styles.cardSub}>{tr('Best', 'Kỷ lục')}: {best.toLocaleString()}</Text>
          {overLine && (
            <View style={styles.overLineBox}>
              <SymbolView
                name={LINE_ICONS[overLine.tone].name}
                size={34}
                tintColor={LINE_ICONS[overLine.tone].color}
                style={styles.overLineIcon}
              />
              <Text style={styles.overLine}>{tr(overLine.text)}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            {stats.map((st) => (
              <Stat key={st.label} label={st.label} value={st.value} />
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>{tr('Menu', 'Về menu')}</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, { backgroundColor: CARD_LOOK.button }]} onPress={onRestart}>
              <Text style={[styles.primaryText, { color: CARD_LOOK.buttonText }]}>{tr('Play again', 'Chơi lại')}</Text>
            </Pressable>
          </View>
        </View>
        {recordFireworks !== null && <Fireworks id={recordFireworks} width={screen.width} height={screen.height} />}
      </View>
      {showReview && (
        <ReviewPrompt
          onRate={() => {
            hapticTap();
            onCloseReview();
            requestStoreReview();
          }}
          onLater={() => {
            hapticTap();
            onCloseReview();
          }}
        />
      )}
    </>
  );
}

function StormOffer({ onUse, onSkip }: { onUse: () => void; onSkip: () => void }) {
  const tr = useT();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <View style={[styles.rewardCard, { borderColor: STORM_COLOR }]}>
        <SymbolView name="tornado" size={36} tintColor={STORM_COLOR} style={styles.rewardIcon} />
        <Text style={styles.rewardTitle}>{tr('Out of space!', 'Hết chỗ rồi!')}</Text>
        <Text style={styles.rewardText}>{tr('Your storm meter is full', 'Thanh bão của bạn đang đầy')}</Text>
        <Text style={styles.applyQuestion}>
          {tr('Call a storm to sweep or reshuffle the board?', 'Gọi bão để quét sạch hoặc xáo lại bàn nhé?')}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onSkip}>
            <Text style={styles.secondaryText}>{tr('No thanks', 'Không cần')}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onUse}>
            <Text style={styles.primaryText}>{tr('Call storm', 'Gọi bão')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function RotateOffer({ rotations, onUse, onSkip }: { rotations: number; onUse: () => void; onSkip: () => void }) {
  const tr = useT();
  const icon = REWARD_ICONS.rotation;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <View style={[styles.rewardCard, { borderColor: icon.color }]}>
        <SymbolView name={icon.name} size={36} tintColor={icon.color} style={styles.rewardIcon} />
        <Text style={styles.rewardTitle}>{tr('Hold on!', 'Khoan đã!')}</Text>
        <Text style={styles.rewardText}>
          {tr(`You still have ${rotations} unused rotations`, `Bạn còn ${rotations} lượt xoay chưa dùng`)}
        </Text>
        <Text style={styles.applyQuestion}>{tr('Rotate a block to keep going?', 'Xoay khối để đặt tiếp nhé?')}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onSkip}>
            <Text style={styles.secondaryText}>{tr('No thanks', 'Không cần')}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onUse}>
            <Text style={styles.primaryText}>{tr('Rotate', 'Xoay khối')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function ReviewPrompt({ onRate, onLater }: { onRate: () => void; onLater: () => void }) {
  const tr = useT();
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
      <View style={[styles.card, styles.reviewCard]}>
        <View style={styles.reviewStars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SymbolView key={i} name="star.fill" size={30} tintColor="#FFD84D" style={styles.reviewStar} />
          ))}
        </View>
        <Text style={styles.reviewTitle}>{tr('Enjoying the game?', 'Bạn thích trò chơi chứ?')}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onLater}>
            <Text style={styles.secondaryText}>{tr('Later', 'Để sau')}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onRate}>
            <Text style={styles.primaryText}>{tr('Rate', 'Đánh giá')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Toast({ text, tone, compact = false }: { text: string; tone?: NoticeTone; compact?: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: TOAST_MS });
    const t = setTimeout(() => useNoticeStore.getState().shift(), TOAST_MS);
    return () => clearTimeout(t);
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.1 ? progress.value * 10 : progress.value > 0.8 ? (1 - progress.value) * 5 : 1,
  }));
  if (compact) {
    return (
      <Animated.View pointerEvents="none" style={[styles.toastCompactWrap, style]}>
        <View style={[styles.toastCompact, tone === 'error' && styles.toastError]}>
          <Text
            style={[styles.toastCompactText, tone === 'error' && styles.toastErrorText]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {text}
          </Text>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, style]}>
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  );
}

function RotationGain({ text, onShow }: { text: string; onShow: () => void }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    hapticCelebrate();
    playSfx('fireworks');
    onShow();
    progress.set(withTiming(1, { duration: ROTATION_GAIN_MS }));
    const t = setTimeout(() => useNoticeStore.getState().shift(), ROTATION_GAIN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.1 ? progress.value * 10 : progress.value > 0.8 ? (1 - progress.value) * 5 : 1,
    transform: [{ translateY: (progress.value < 0.1 ? 1 - progress.value * 10 : 0) * -6 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.rotationGain, style]}>
      <SymbolView
        name={REWARD_ICONS.rotation.name}
        size={14}
        tintColor={REWARD_ICONS.rotation.color}
        style={styles.rotationGainIcon}
      />
      <Text style={styles.rotationGainText} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

export function RewardPopup({
  kind,
  text,
  top,
  onShow,
}: {
  kind: RewardKind;
  text: string;
  top: number;
  onShow: () => void;
}) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(0.4);
  useEffect(() => {
    const show = setTimeout(() => {
      hapticCelebrate();
      playSfx('fireworks');
      onShow();
    }, REWARD_DELAY_MS);
    const done = setTimeout(() => useNoticeStore.getState().shift(), REWARD_DELAY_MS + REWARD_MS);
    progress.set(withDelay(REWARD_DELAY_MS, withTiming(1, { duration: REWARD_MS })));
    scale.set(
      withDelay(REWARD_DELAY_MS, withSequence(withTiming(1.12, { duration: 170 }), withTiming(1, { duration: 150 }))),
    );
    return () => {
      clearTimeout(show);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : progress.value < 0.85 ? 1 : 1 - (progress.value - 0.85) / 0.15,
    transform: [{ scale: scale.value }],
  }));
  const icon = REWARD_ICONS[kind];
  const tr = useT();
  return (
    <Animated.View pointerEvents="none" style={[styles.reward, { top }, style]}>
      <View style={[styles.rewardCard, { borderColor: icon.color }]}>
        <SymbolView name={icon.name} size={36} tintColor={icon.color} style={styles.rewardIcon} />
        {'title' in icon && <Text style={styles.rewardTitle}>{tr(icon.title)}</Text>}
        <Text style={styles.rewardText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

export function ApplyPrompt({ notice }: { notice: Notice }) {
  const tr = useT();
  useEffect(() => {
    hapticCelebrate();
    playSfx('fireworks');
    const t = setTimeout(() => useNoticeStore.getState().shift(), APPLY_PROMPT_MS);
    return () => clearTimeout(t);
  }, []);
  const icon = REWARD_ICONS[notice.reward ?? 'skin'];
  const answer = (yes: boolean) => {
    hapticTap();
    if (yes && notice.apply) useSettingsStore.getState().update(notice.apply);
    useNoticeStore.getState().shift();
  };
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <View style={[styles.rewardCard, { borderColor: icon.color }]}>
        <SymbolView name={icon.name} size={36} tintColor={icon.color} style={styles.rewardIcon} />
        <Text style={styles.rewardText}>{notice.text}</Text>
        <Text style={styles.applyQuestion}>{tr('Use it now?', 'Dùng ngay bây giờ?')}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={() => answer(false)}>
            <Text style={styles.secondaryText}>{tr('No', 'Không')}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => answer(true)}>
            <Text style={styles.primaryText}>{tr('Yes', 'Có')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function ScorePopup({ popup, top }: { popup: Popup; top: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: SCORE_POPUP_MS });
  }, [progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const out = p < SCORE_HOLD ? 0 : (p - SCORE_HOLD) / (1 - SCORE_HOLD);
    const pop = p < 0.04 ? 0.6 + (p / 0.04) * 0.55 : p < 0.08 ? 1.15 - ((p - 0.04) / 0.04) * 0.15 : 1;
    return {
      opacity: 1 - out,
      transform: [{ translateY: -40 * out }, { scale: pop }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.popup, { top }, style]}>
      <Text style={styles.popupPoints}>+{popup.points.toLocaleString()}</Text>
      {popup.label && <Text style={styles.popupLabel}>{popup.label}</Text>}
    </Animated.View>
  );
}

const BANNER_MS = 1300;
const HEART_MS = 1100;
const HEART_SIZE = 64;

function NewBestBadge() {
  const tr = useT();
  const scale = useSharedValue(0.3);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 160 }),
      withTiming(1, { duration: 160 }),
      withRepeat(withSequence(withTiming(1.08, { duration: 500 }), withTiming(1, { duration: 500 })), -1),
    );
  }, [scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.newBestRow, style]}>
      <SymbolView name="crown.fill" size={22} tintColor="#FFD84D" style={styles.newBestIcon} />
      <Text style={styles.newBest}>{tr('New record!', 'Kỷ lục mới!')}</Text>
    </Animated.View>
  );
}

export function PopBanner({ top, children }: { top: number; children: ReactNode }) {
  const scale = useSharedValue(0.3);
  const tilt = useSharedValue(0);
  const progress = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withTiming(1.35, { duration: 150 }), withTiming(1, { duration: 160 }));
    tilt.value = withDelay(
      150,
      withSequence(withTiming(-6, { duration: 70 }), withTiming(5, { duration: 90 }), withTiming(0, { duration: 80 })),
    );
    progress.value = withTiming(1, { duration: BANNER_MS });
  }, [scale, tilt, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.75 ? 1 : 1 - (progress.value - 0.75) / 0.25,
    transform: [
      {
        translateY: progress.value < 0.75 ? 0 : -40 * ((progress.value - 0.75) / 0.25),
      },
      { scale: scale.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { top }, style]}>
      {children}
    </Animated.View>
  );
}

export function ComboBanner({ combo, top }: { combo: number; top: number }) {
  const color = COMBO_COLORS[Math.min(combo, COMBO_COLORS.length + 1) - 2];
  return (
    <PopBanner top={top}>
      <Text style={[styles.bannerBig, { color }]}>x{combo}</Text>
      <Text style={styles.bannerWord}> Combo</Text>
    </PopBanner>
  );
}

function HeartPop({ x, y }: { x: number; y: number }) {
  const scale = useSharedValue(0.2);
  const progress = useSharedValue(0);
  useEffect(() => {
    scale.set(
      withSequence(
        withTiming(1.4, { duration: 180 }),
        withTiming(1, { duration: 160 }),
        withTiming(1.15, { duration: 140 }),
        withTiming(1, { duration: 140 }),
      ),
    );
    progress.set(withTiming(1, { duration: HEART_MS }));
  }, [scale, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.7 ? 1 : 1 - (progress.value - 0.7) / 0.3,
    transform: [{ translateY: -30 * progress.value }, { scale: scale.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.heart, { left: x - HEART_SIZE / 2, top: y - HEART_SIZE / 2 }, style]}
    >
      <SymbolView name="heart.fill" size={HEART_SIZE} tintColor="#FF4D6D" style={styles.heartIcon} />
    </Animated.View>
  );
}

function StageFadeOut({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withTiming(0, { duration: STAGE_FADE_MS }));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

export function StageBackground({ color }: { color: string | null }) {
  const [shown, setShown] = useState(color);
  const [from, setFrom] = useState(color);
  if (color !== shown) {
    setFrom(shown);
    setShown(color);
  }
  if (!shown) return from ? <StageFadeOut key={`out-${from}`} color={from} /> : null;
  return (
    <>
      {from && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: from }]} />}
      <Animated.View
        key={shown}
        pointerEvents="none"
        entering={FadeIn.duration(STAGE_FADE_MS)}
        style={[StyleSheet.absoluteFill, { backgroundColor: shown }]}
      />
    </>
  );
}

export function RecordBanner({ top }: { top: number }) {
  const tr = useT();
  return (
    <PopBanner top={top}>
      <View style={styles.recordRow}>
        <SymbolView name="crown.fill" size={34} tintColor="#FFD84D" style={styles.recordIcon} />
        <Text style={[styles.bannerBig, { color: '#FFD84D' }]}>{tr('New record!', 'Kỷ lục mới!')}</Text>
      </View>
    </PopBanner>
  );
}

export function LinesBanner({ lines, top }: { lines: number; top: number }) {
  const tr = useT();
  return (
    <PopBanner top={top}>
      <Text style={styles.bannerWord}>{tr('Blast ', 'Nổ ')}</Text>
      <Text style={[styles.bannerBig, { color: lines >= 3 ? '#FF4D6D' : COLORS.accent }]}>x{lines}!</Text>
    </PopBanner>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 22, height: 22 },
  scoreBox: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  score: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bestRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  heart: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  heartIcon: { width: HEART_SIZE, height: HEART_SIZE },
  recordIcon: { width: 34, height: 34, marginRight: 8 },
  bestIcon: { width: 14, height: 14, marginRight: 4 },
  best: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rotations: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotationsIcon: { width: 16, height: 16, marginRight: 4 },
  rotationGain: {
    position: 'absolute',
    top: '100%',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  rotationGainIcon: { width: 14, height: 14, marginRight: 4 },
  rotationGainText: {
    color: '#1B1F3B',
    fontSize: 12,
    fontWeight: '800',
  },
  rotationsText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  boardArea: { flex: 1 },
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  reward: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  rewardCard: {
    width: 260,
    borderRadius: 20,
    borderWidth: 3,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(38, 45, 87, 0.97)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  rewardIcon: { width: 36, height: 36 },
  rewardTitle: {
    color: '#FFD84D',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  rewardText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  applyQuestion: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  toastCompactWrap: {
    position: 'absolute',
    left: -48,
    right: -48,
    bottom: '100%',
    marginBottom: -10,
    alignItems: 'center',
  },
  toastCompact: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFC23D',
    borderWidth: 1.5,
    borderColor: '#FFE7A3',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  toastCompactText: {
    color: '#3A2300',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  toastError: {
    backgroundColor: '#A3274C',
    borderColor: '#D9668A',
  },
  toastErrorText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(60, 0, 20, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toastText: {
    color: '#1B1F3B',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  overLineBox: { alignItems: 'center', marginTop: 14 },
  overLineIcon: { width: 34, height: 34 },
  overLine: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  newBestRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  newBestIcon: { width: 22, height: 22, marginRight: 6 },
  newBest: { color: '#FFD84D', fontSize: 22, fontWeight: '900' },
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  popup: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  popupPoints: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  bannerBig: {
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  bannerWord: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  popupLabel: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 10, 30, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 276,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
  },
  cardTitle: { color: COLORS.textDim, fontSize: 18, fontWeight: '700' },
  cardScore: {
    color: COLORS.text,
    fontSize: 44,
    fontWeight: '900',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  cardSub: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  buttonRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 20 },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    backgroundColor: '#3DCB4A',
    alignItems: 'center',
  },
  reviewCard: { backgroundColor: '#262D57' },
  reviewStars: { flexDirection: 'row', gap: 6 },
  reviewStar: { width: 30, height: 30 },
  reviewTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
});
