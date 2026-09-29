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

import { comboSfx, initSfx, playSfx } from '../audio/sfx';
import { markReviewPromptShown, requestStoreReview, reviewPromptDelay } from '../review/reviewPrompt';
import { solidRect, type Board, type CellRect } from '../core/board';
import type { PlaceResult } from '../core/game';
import { nextRotationMilestone } from '../core/milestones';
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
import { GameBoard, type ClearEvent, type ClearingCell } from '../render/GameBoard';
import { computeLayout, type BoardLayout } from '../render/layout';
import { COLORS, hudColors, rotationBadgeColor, skinById, STAGE_LOOKS, themeById } from '../render/theme';
import { useGameStore, type Mode } from '../store/gameStore';
import { useNoticeStore, type RewardKind } from '../store/noticeStore';
import { useProgressStore } from '../store/progressStore';
import { useRecordsStore, type GameResult } from '../store/recordsStore';
import { useSettingsStore } from '../store/settingsStore';
import { gameOverLine, type LineTone } from './gameOverLines';
import { Onboarding } from './Onboarding';

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

const LINE_ICONS = {
  newBest: { name: 'crown.fill', color: '#FFD84D' },
  close: { name: 'flame.fill', color: '#FF6B2C' },
  encourage: { name: 'hand.thumbsup.fill', color: '#3DCB4A' },
  tease: { name: 'face.smiling.inverse', color: '#FFD84D' },
} as const satisfies Record<LineTone, { name: SFSymbol; color: string }>;
const TOAST_MS = 1400;
const BADGE_PULSE_MS = 3000;
const BADGE_PULSES = 6;
const STAGE_SFX_DELAY_MS = 350;
const STAGE_FADE_MS = 700;
const CARD_LOOKS = {
  newBest: { bg: '#1E6B3F', button: '#FFD84D', buttonText: '#1B1F3B' },
  tied: { bg: '#262D57', button: '#3DCB4A', buttonText: '#FFFFFF' },
  below: { bg: '#5A2438', button: '#3DCB4A', buttonText: '#FFFFFF' },
} as const;
const REWARD_DELAY_MS = 450;
const REWARD_MS = 2800;
const REWARD_ICONS = {
  rotation: {
    name: 'arrow.clockwise.circle.fill',
    color: '#3DCB4A',
    title: 'Thêm lượt xoay!',
  },
  theme: { name: 'paintpalette.fill', color: '#4FC3F7', title: 'Theme mới!' },
  skin: { name: 'sparkles', color: '#FF5FD2', title: 'Skin mới!' },
} as const satisfies Record<RewardKind, { name: SFSymbol; color: string; title: string }>;
const RECORD_FIREWORKS_GAP_MS = 1100;
const RECORD_SFX_DELAY_MS = 500;
export const COMBO_SFX_DELAY_MS = 120;
const COMBO_COLORS = ['#4FC3F7', '#7BD84F', '#FFD84D', '#FF8A1F', '#FF4D6D', '#FF5FD2'];

function clearedCells(result: PlaceResult): ClearingCell[] {
  const { placed, cleared } = result;
  const n = placed.size;
  const seen = new Set<number>();
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

const NICE_MIN_CELLS = 6;

function niceRect(before: Board, result: PlaceResult): CellRect | null {
  const rect = solidRect(result.state.board);
  if (!rect || rect.rows < 2 || rect.cols < 2) return null;
  const area = rect.rows * rect.cols;
  const pieceCells = result.placed.cells.filter((v) => v !== 0).length - before.cells.filter((v) => v !== 0).length;
  if (area < NICE_MIN_CELLS || area <= pieceCells) return null;
  return solidRect(before) ? null : rect;
}

function popupLabel(result: PlaceResult): string | null {
  const { score } = result;
  if (score.perfectClearPoints > 0) return 'Amazing!';
  return null;
}

export function GameScreen({ mode }: { mode: Mode }) {
  const insets = useSafeAreaInsets();
  const { game, result } = useGameStore((s) => s.modes[mode]);
  const placeIn = useGameStore((s) => s.place);
  const rotateIn = useGameStore((s) => s.rotate);
  const startIn = useGameStore((s) => s.start);
  const rotations = useProgressStore((s) => s.rotations);
  const bestScore = useRecordsStore((s) => s.byMode[mode].bestScore);
  const best = Math.max(bestScore, game.score);
  const notice = useNoticeStore((s) => s.queue[0]);
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const onboarded = useSettingsStore((s) => s.onboarded);

  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [clearing, setClearing] = useState<ClearEvent | null>(null);
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

  useEffect(() => {
    initSfx();
    useGameStore.getState().resume(mode);
  }, [mode]);

  const nextMilestone = nextRotationMilestone(game.score);

  const badgePulse = useSharedValue(1);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgePulse.value }] }));
  useEffect(() => {
    if (useProgressStore.getState().rotations < 1) return;
    const beat = BADGE_PULSE_MS / BADGE_PULSES / 2;
    badgePulse.set(
      withRepeat(withSequence(withTiming(1.25, { duration: beat }), withTiming(1, { duration: beat })), BADGE_PULSES),
    );
  }, [game.seed, badgePulse]);
  const stage = stageColor(stageAt(game.score), game.seed ?? 0);
  const stageLook = stage ? STAGE_LOOKS[stage] : null;
  const hud = hudColors(stageLook?.tone ?? theme.tone);

  const losses = useRecordsStore((s) => s.byMode[mode].gamesBelowBest);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeLayout(width, height));
  };

  const onDrop = useCallback(
    (slot: number, row: number, col: number) => {
      const before = useGameStore.getState().modes[mode].game.board;
      const result = placeIn(mode, slot, row, col);
      if (!result) return false;
      const id = ++eventId.current;
      const { lines, combo, perfectClearPoints, total } = result.score;
      if (lines > 0) {
        setClearing({ id, cells: clearedCells(result), lines });
        setPopup({ id, points: total, label: popupLabel(result) });
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
      const nice = niceRect(before, result);
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
    [mode, placeIn, shakeX, bestPulse, setFireworks],
  );

  const onRotate = useCallback(
    (slot: number) => {
      if (useProgressStore.getState().rotations <= 0) {
        hapticWarning();
        useNoticeStore.getState().push('Hết lượt xoay');
        return false;
      }
      if (!rotateIn(mode, slot)) return false;
      hapticTap();
      playSfx('rotate');
      return true;
    },
    [mode, rotateIn],
  );

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
            {nextMilestone !== null && (
              <Text style={[styles.milestone, { color: hud.textDim }]}>
                {' '}
                · +1 xoay ở {nextMilestone.toLocaleString()}
              </Text>
            )}
          </Animated.View>
        </View>
        <Animated.View style={badgeStyle}>
          <Pressable
            onPress={() => {
              hapticTap();
              useNoticeStore
                .getState()
                .push(
                  rotations > 0
                    ? `Chạm vào khối trong khay để xoay (còn ${rotations} lượt)`
                    : 'Hết lượt xoay. Vượt mốc điểm để nhận thêm',
                );
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${rotations} lượt xoay`}
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
      </View>

      <View style={styles.boardArea} onLayout={onLayout}>
        {layout && (
          <Animated.View style={shakeStyle}>
            <GameBoard
              layout={layout}
              board={game.board}
              tray={game.tray}
              clearing={clearing}
              disabled={game.over || !onboarded}
              onDrop={onDrop}
              onRotate={onRotate}
              theme={theme}
              skin={skin}
            />
          </Animated.View>
        )}
        {layout && fireworks !== null && <Fireworks id={fireworks} width={layout.width} height={layout.height} />}
        {notice && !notice.reward && <Toast key={notice.id} text={notice.text} />}
        {layout && notice?.reward && (
          <RewardPopup
            key={notice.id}
            kind={notice.reward}
            text={notice.text}
            top={layout.boardY + layout.boardSize * 0.12}
            onShow={() => setFireworks(++eventId.current)}
          />
        )}
        {layout && popup && <ScorePopup key={popup.id} popup={popup} top={layout.boardY + layout.boardSize / 2 - 40} />}
        {layout && niceEvent && (
          <HeartPop
            key={niceEvent.id}
            x={layout.boardX + (niceEvent.rect.col + niceEvent.rect.cols / 2) * layout.cell}
            y={layout.boardY + (niceEvent.rect.row + niceEvent.rect.rows / 2) * layout.cell}
          />
        )}
        {layout && recordEvent !== null && (
          <RecordBanner key={recordEvent} top={Math.max(0, layout.boardY + layout.boardSize / 2 - 200)} />
        )}
        {layout && multiLines && (
          <LinesBanner key={multiLines.id} lines={multiLines.lines} top={layout.boardY + layout.boardSize / 2 + 20} />
        )}
        {layout && comboEvent && (
          <ComboBanner key={comboEvent.id} combo={comboEvent.combo} top={layout.boardY + layout.boardSize / 2 - 130} />
        )}
      </View>

      {over.showGameOver && (
        <GameOverOverlay
          score={game.score}
          best={best}
          result={result}
          losses={losses}
          stats={[
            { label: 'Nổ hũ', value: game.stats.linesCleared },
            { label: 'Combo cao nhất', value: game.stats.maxCombo > 0 ? `x${game.stats.maxCombo}` : '–' },
            { label: 'Lượt đặt', value: game.stats.placements },
          ]}
          recordFireworks={over.recordFireworks}
          showReview={over.showReview}
          onCloseReview={() => over.setShowReview(false)}
          onRestart={restart}
        />
      )}

      {!onboarded && <Onboarding onDone={() => useSettingsStore.getState().update({ onboarded: true })} />}
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
        playSfx('newRecord');
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
  const screen = useWindowDimensions();
  const cardLook = result?.newBest ? CARD_LOOKS.newBest : result?.tiedBest ? CARD_LOOKS.tied : CARD_LOOKS.below;
  const overLine = useMemo(
    () => (result ? gameOverLine(score, best, result.newBest, losses) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, score, best],
  );
  return (
    <>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardLook.bg }]}>
          <Text style={styles.cardTitle}>Hết chiêuuuu</Text>
          {result?.newBest && <NewBestBadge />}
          <Text style={styles.cardScore} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {score.toLocaleString()}
          </Text>
          <Text style={styles.cardSub}>Kỷ lục: {best.toLocaleString()}</Text>
          {overLine && (
            <View style={styles.overLineBox}>
              <SymbolView
                name={LINE_ICONS[overLine.tone].name}
                size={34}
                tintColor={LINE_ICONS[overLine.tone].color}
                style={styles.overLineIcon}
              />
              <Text style={styles.overLine}>{overLine.text}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            {stats.map((st) => (
              <Stat key={st.label} label={st.label} value={st.value} />
            ))}
          </View>
          <Pressable style={[styles.primaryButton, { backgroundColor: cardLook.button }]} onPress={onRestart}>
            <Text style={[styles.primaryText, { color: cardLook.buttonText }]}>Chơi lại</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Về menu</Text>
          </Pressable>
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

function ReviewPrompt({ onRate, onLater }: { onRate: () => void; onLater: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
      <View style={[styles.card, styles.reviewCard]}>
        <View style={styles.reviewStars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SymbolView key={i} name="star.fill" size={30} tintColor="#FFD84D" style={styles.reviewStar} />
          ))}
        </View>
        <Text style={styles.reviewTitle}>Bạn thích trò chơi chứ?</Text>
        <Pressable style={styles.primaryButton} onPress={onRate}>
          <Text style={styles.primaryText}>Đánh giá</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onLater}>
          <Text style={styles.secondaryText}>Để sau</Text>
        </Pressable>
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

export function Toast({ text }: { text: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: TOAST_MS });
    const t = setTimeout(() => useNoticeStore.getState().shift(), TOAST_MS);
    return () => clearTimeout(t);
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.1 ? progress.value * 10 : progress.value > 0.8 ? (1 - progress.value) * 5 : 1,
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, style]}>
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  );
}

export function RewardPopup({ kind, text, top, onShow }: { kind: RewardKind; text: string; top: number; onShow: () => void }) {
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
  return (
    <Animated.View pointerEvents="none" style={[styles.reward, { top }, style]}>
      <View style={[styles.rewardCard, { borderColor: icon.color }]}>
        <SymbolView name={icon.name} size={44} tintColor={icon.color} style={styles.rewardIcon} />
        <Text style={styles.rewardTitle}>{icon.title}</Text>
        <Text style={styles.rewardText}>{text}</Text>
        {kind !== 'rotation' && <Text style={styles.rewardHint}>Đã áp dụng. Đổi lại trong Bộ sưu tập</Text>}
      </View>
    </Animated.View>
  );
}

export function ScorePopup({ popup, top }: { popup: Popup; top: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 900 });
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.7 ? 1 : 1 - (progress.value - 0.7) / 0.3,
    transform: [{ translateY: -60 * progress.value }, { scale: 0.8 + Math.min(progress.value * 4, 1) * 0.2 }],
  }));
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
      <Text style={styles.newBest}>Kỷ lục mới!</Text>
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

export function StageBackground({ color }: { color: string | null }) {
  const [shown, setShown] = useState(color);
  const [from, setFrom] = useState(color);
  if (color !== shown) {
    setFrom(shown);
    setShown(color);
  }
  if (!shown) return null;
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
  return (
    <PopBanner top={top}>
      <View style={styles.recordRow}>
        <SymbolView name="crown.fill" size={34} tintColor="#FFD84D" style={styles.recordIcon} />
        <Text style={[styles.bannerBig, { color: '#FFD84D' }]}>Kỷ lục mới!</Text>
      </View>
    </PopBanner>
  );
}

export function LinesBanner({ lines, top }: { lines: number; top: number }) {
  return (
    <PopBanner top={top}>
      <Text style={styles.bannerWord}>Nổ hũ </Text>
      <Text style={[styles.bannerBig, { color: lines >= 3 ? '#FF4D6D' : COLORS.accent }]}>x{lines}!</Text>
    </PopBanner>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
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
  milestone: { color: COLORS.textDim, fontSize: 13, fontWeight: '600' },
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
    width: 280,
    borderRadius: 22,
    borderWidth: 3,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(38, 45, 87, 0.97)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  rewardIcon: { width: 44, height: 44 },
  rewardTitle: {
    color: '#FFD84D',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  rewardText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  rewardHint: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
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
    width: 300,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  cardTitle: { color: COLORS.textDim, fontSize: 18, fontWeight: '700' },
  cardScore: {
    color: COLORS.text,
    fontSize: 52,
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
  primaryButton: {
    marginTop: 24,
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: '#3DCB4A',
    alignItems: 'center',
  },
  reviewCard: { backgroundColor: '#262D57' },
  reviewStars: { flexDirection: 'row', gap: 6 },
  reviewStar: { width: 30, height: 30 },
  reviewTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  secondaryButton: {
    marginTop: 10,
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.textDim, fontSize: 16, fontWeight: '700' },
});
