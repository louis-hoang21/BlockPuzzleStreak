/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/preserve-manual-memoization */
import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { StatusBar } from 'expo-status-bar';

import cfg from '../../config/classic.json';
import { comboSfx, initSfx, playSfx } from '../audio/sfx';
import {
  hardDrop,
  hold,
  move,
  rotate,
  tick,
  type ClassicEvent,
  type ClassicState,
  type Step,
} from '../core/classic/engine';
import { stageColor } from '../core/stages';
import { hapticCelebrate, hapticClear, hapticCombo, hapticPlace, hapticTap } from '../haptics';
import { Fireworks } from '../render/Fireworks';
import { ThemeBackdrop } from '../render/Backdrops';
import { ClassicBoard, CLEAR_MS, type ClassicClear } from '../render/ClassicBoard';
import { computeClassicLayout, type ClassicLayout } from '../render/classicLayout';
import {
  COLORS,
  hudColors,
  rotationBadgeColor,
  skinById,
  STAGE_LOOKS,
  themeById,
  type BoardTheme,
} from '../render/theme';
import { useClassicStore } from '../store/classicStore';
import { useRecordsStore } from '../store/recordsStore';
import { useNoticeStore } from '../store/noticeStore';
import { useProgressStore } from '../store/progressStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  COMBO_SFX_DELAY_MS,
  ComboBanner,
  GameOverOverlay,
  LinesBanner,
  PopBanner,
  RecordBanner,
  RewardPopup,
  ScorePopup,
  StageBackground,
  Toast,
  useGameOverFlow,
  type Popup,
} from './GameScreen';

type Phase = 'ready' | 'countdown' | 'running' | 'paused';

const RECORD_SFX_DELAY_MS = 500;
const LEVEL_SFX_DELAY_MS = 350;
const MAX_FRAME_MS = 100;
const SOFT_DROP_CELLS = 0.6;
const HARD_DROP_VELOCITY = 700;
const HARD_DROP_CELLS = 0.8;
const CONTROL_REPEAT_DELAY_MS = 220;
const CONTROL_REPEAT_MS = 70;

function shake(a: number) {
  return withSequence(
    withTiming(a, { duration: 40 }),
    withTiming(-a, { duration: 60 }),
    withTiming(a * 0.6, { duration: 60 }),
    withTiming(-a * 0.6, { duration: 60 }),
    withTiming(a * 0.25, { duration: 50 }),
    withTiming(0, { duration: 50 }),
  );
}

function initialGame(): ClassicState {
  const store = useClassicStore.getState();
  store.resume();
  return useClassicStore.getState().game;
}

export function ClassicScreen() {
  const insets = useSafeAreaInsets();
  const [stored] = useState(initialGame);
  const result = useClassicStore((s) => s.result);
  const bestScore = useRecordsStore((s) => s.byMode.classic.bestScore);
  const losses = useRecordsStore((s) => s.byMode.classic.gamesBelowBest);
  const theme = themeById(useSettingsStore((s) => s.theme));
  const skin = skinById(useSettingsStore((s) => s.skin));
  const showButtons = useSettingsStore((s) => s.classicButtons);
  const notice = useNoticeStore((s) => s.queue[0]);

  const engine = useRef<ClassicState>(stored);
  const [view, setView] = useState<ClassicState>(stored);
  const [phase, setPhase] = useState<Phase>(stored.stats.pieces > 0 ? 'paused' : 'ready');
  const [count, setCount] = useState(3);
  const [layout, setLayout] = useState<ClassicLayout | null>(null);
  const [clearing, setClearing] = useState<ClassicClear | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [comboEvent, setComboEvent] = useState<{ id: number; combo: number } | null>(null);
  const [multiLines, setMultiLines] = useState<{ id: number; lines: number } | null>(null);
  const [levelEvent, setLevelEvent] = useState<{ id: number; level: number } | null>(null);
  const [recordEvent, setRecordEvent] = useState<number | null>(null);
  const [fireworks, setFireworks] = useState<number | null>(null);
  const eventId = useRef(0);
  const soft = useRef(false);
  const holdUntil = useRef(0);
  const over = useGameOverFlow(view.over, result);

  const shakeX = useSharedValue(0);
  const dropY = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: dropY.value }],
  }));

  const best = Math.max(bestScore, view.score);
  const stageIndex = Math.floor((view.level - 1) / cfg.colorStageLevels);
  const stage = stageColor(stageIndex, view.seed);
  const stageLook = stage ? STAGE_LOOKS[stage] : null;
  const hud = hudColors(stageLook?.tone ?? theme.tone);

  useEffect(() => {
    initSfx();
  }, []);

  const pause = useCallback(() => {
    setPhase((p) => (p === 'running' || p === 'countdown' ? 'paused' : p));
    soft.current = false;
    if (!engine.current.over) useClassicStore.getState().commit(engine.current, true);
  }, []);

  useFocusEffect(useCallback(() => pause, [pause]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  const handleEvents = useCallback(
    (prev: ClassicState, next: ClassicState, events: ClassicEvent[]) => {
      if (events.length === 0) return;
      const id = ++eventId.current;
      let cleared = false;
      let lines = 0;
      let combo = 0;
      let perfect = false;
      const hardDropped = events.some((e) => e.type === 'hardDrop');
      for (const e of events) {
        if (e.type === 'hardDrop') {
          dropY.set(withSequence(withTiming(4, { duration: 50 }), withTiming(0, { duration: 90 })));
        }
        if (e.type === 'clear') {
          cleared = true;
          lines = e.lines;
          combo = e.combo;
          perfect = e.perfect;
          setClearing({ id, cells: e.cells, rows: e.rows, lines: e.lines });
          const shown = e.before.slice();
          for (const r of e.rows) shown.fill(0, r * next.cols, (r + 1) * next.cols);
          setView({ ...next, cells: shown, active: null });
          holdUntil.current = performance.now() + CLEAR_MS;
          setTimeout(() => setView(engine.current), CLEAR_MS);
          setPopup({ id, points: e.points, label: e.perfect ? 'Amazing!' : null });
          if (e.combo >= 2) setComboEvent({ id, combo: e.combo });
          if (e.lines >= 2) setMultiLines({ id, lines: e.lines });
          if (e.lines >= 3) shakeX.set(shake(10));
          if (e.perfect) setFireworks(id);
        }
        if (e.type === 'levelUp') {
          setLevelEvent({ id, level: e.level });
          setFireworks(id);
          shakeX.set(shake(14));
          setTimeout(() => {
            hapticCelebrate();
            playSfx('fireworks');
          }, LEVEL_SFX_DELAY_MS);
        }
      }
      if (perfect) {
        hapticCelebrate();
        playSfx('fireworks');
        setTimeout(() => playSfx('amazing'), 250);
      } else if (cleared) {
        if (combo >= 2) hapticCombo(combo);
        else hapticClear(lines);
        playSfx('clear');
      } else if (events.some((e) => e.type === 'lock')) {
        if (hardDropped) hapticClear(1);
        else {
          hapticPlace();
          playSfx('place');
        }
      }
      if (hardDropped) playSfx('drop');
      if (combo >= 2) setTimeout(() => playSfx(comboSfx(combo)), COMBO_SFX_DELAY_MS);

      const oldBest = useRecordsStore.getState().byMode.classic.bestScore;
      if (oldBest > 0 && prev.score <= oldBest && next.score > oldBest) {
        setRecordEvent(id);
        setFireworks(id);
        setTimeout(
          () => {
            hapticCelebrate();
            playSfx('newRecord');
          },
          cleared ? RECORD_SFX_DELAY_MS : 0,
        );
      }
      if (events.some((e) => e.type === 'lock' || e.type === 'over')) {
        useClassicStore.getState().commit(next, true);
      }
    },
    [shakeX, dropY],
  );

  const rewardProgress = useCallback((prev: ClassicState, next: ClassicState, events: ClassicEvent[]) => {
    const progress = useProgressStore.getState();
    if (next.score > prev.score) progress.onScore(prev.score, next.score, false);
    for (const e of events) {
      if (e.type !== 'clear') continue;
      if (e.perfect) progress.onPerfectClear();
      if (e.combo > prev.combo) progress.onCombo(e.combo);
    }
  }, []);

  const apply = useCallback(
    (fn: (s: ClassicState) => ClassicState | Step) => {
      const prev = engine.current;
      const out = fn(prev);
      const next = 'state' in out ? out.state : out;
      const events = 'state' in out ? out.events : [];
      engine.current = next;
      if (
        next.active !== prev.active ||
        next.cells !== prev.cells ||
        next.hold !== prev.hold ||
        next.over !== prev.over ||
        next.score !== prev.score ||
        next.level !== prev.level ||
        next.lines !== prev.lines
      ) {
        setView(next);
      }
      handleEvents(prev, next, events);
      rewardProgress(prev, next, events);
    },
    [handleEvents, rewardProgress],
  );

  const running = phase === 'running' && !view.over;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      if (now >= holdUntil.current) apply((s) => tick(s, dt, soft.current));
      if (!engine.current.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, apply]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const t = setTimeout(() => {
      if (count <= 1) setPhase('running');
      else setCount(count - 1);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, count]);

  const startCountdown = () => {
    hapticTap();
    setCount(3);
    setPhase('countdown');
  };

  const onMove = useCallback(
    (steps: number) => {
      if (performance.now() < holdUntil.current) return;
      const dir = Math.sign(steps);
      for (let i = 0; i < Math.abs(steps); i++) apply((s) => move(s, dir));
    },
    [apply],
  );
  const onRotate = useCallback(() => {
    if (performance.now() < holdUntil.current) return;
    const before = engine.current.active;
    apply((s) => rotate(s));
    if (engine.current.active !== before) playSfx('rotate');
  }, [apply]);
  const onHardDrop = useCallback(() => {
    if (performance.now() < holdUntil.current) return;
    apply((s) => hardDrop(s));
  }, [apply]);
  const onHold = useCallback(() => {
    if (performance.now() < holdUntil.current) return;
    const before = engine.current.hold;
    apply((s) => hold(s));
    if (engine.current.hold !== before) {
      hapticTap();
      playSfx('rotate');
    }
  }, [apply]);
  const setSoft = useCallback((on: boolean) => {
    soft.current = on;
  }, []);

  const onPausePress = useCallback(() => {
    hapticTap();
    pause();
  }, [pause]);

  const cell = layout?.cell ?? 30;
  const movedX = useSharedValue(0);
  const softOn = useSharedValue(false);
  const gesture = useMemo(() => {
    const enabled = running;
    const pan = Gesture.Pan()
      .minDistance(8)
      .enabled(enabled)
      .onStart(() => {
        movedX.value = 0;
        softOn.value = false;
      })
      .onUpdate((e) => {
        const steps = Math.trunc((e.translationX - movedX.value) / cell);
        if (steps !== 0 && Math.abs(e.translationX) > Math.abs(e.translationY) * 0.6) {
          movedX.value += steps * cell;
          scheduleOnRN(onMove, steps);
        }
        const wantSoft = e.translationY > cell * SOFT_DROP_CELLS && e.translationY > Math.abs(e.translationX);
        if (wantSoft !== softOn.value) {
          softOn.value = wantSoft;
          scheduleOnRN(setSoft, wantSoft);
        }
      })
      .onEnd((e) => {
        const downward = e.translationY > Math.abs(e.translationX);
        if (downward && e.velocityY > HARD_DROP_VELOCITY && e.translationY > cell * HARD_DROP_CELLS)
          scheduleOnRN(onHardDrop);
        else if (e.velocityY < -900 && e.translationY < -cell * 1.5) scheduleOnRN(onHold);
      })
      .onFinalize(() => {
        if (softOn.value) {
          softOn.value = false;
          scheduleOnRN(setSoft, false);
        }
      });
    const tap = Gesture.Tap()
      .maxDistance(10)
      .enabled(enabled)
      .onEnd((_e, success) => {
        if (success) scheduleOnRN(onRotate);
      });
    return Gesture.Race(pan, tap);
  }, [running, cell, movedX, softOn, onMove, setSoft, onHardDrop, onHold, onRotate]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeClassicLayout(width, height));
  };

  const restart = () => {
    hapticTap();
    over.reset();
    setClearing(null);
    setPopup(null);
    setComboEvent(null);
    setMultiLines(null);
    setLevelEvent(null);
    setRecordEvent(null);
    setFireworks(null);
    useClassicStore.getState().start();
    const game = useClassicStore.getState().game;
    engine.current = game;
    setView(game);
    setCount(3);
    setPhase('countdown');
  };

  const centerY = layout ? layout.boardY + layout.boardH / 2 : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar style={(stageLook?.tone ?? theme.tone) === 'light' ? 'dark' : 'light'} />
      <StageBackground color={stageLook?.background ?? null} />
      {theme.backdrop && <ThemeBackdrop kind={theme.backdrop} />}
      <ClassicHeader
        score={view.score}
        best={best}
        level={view.level}
        lines={view.lines}
        tone={stageLook?.tone ?? theme.tone}
        theme={theme}
        running={running}
        onPause={onPausePress}
      />

      <View style={styles.boardArea} onLayout={onLayout}>
        {layout && (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
              <ClassicBoard layout={layout} state={view} clearing={clearing} theme={theme} skin={skin} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  styles.sideLabel,
                  { left: layout.sideX, top: layout.holdY - layout.labelH, width: layout.sideW, color: hud.textDim },
                ]}
              >
                Giữ
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  styles.sideLabel,
                  { left: layout.sideX, top: layout.nextY - layout.labelH, width: layout.sideW, color: hud.textDim },
                ]}
              >
                Tiếp theo
              </Text>
            </Animated.View>
          </GestureDetector>
        )}
        {layout && fireworks !== null && <Fireworks id={fireworks} width={layout.width} height={layout.height} />}
        {layout && popup && <ScorePopup key={popup.id} popup={popup} top={centerY - 40} />}
        {notice && !notice.reward && <Toast key={notice.id} text={notice.text} />}
        {layout && notice?.reward && (
          <RewardPopup
            key={notice.id}
            kind={notice.reward}
            text={notice.text}
            top={layout.boardY + layout.boardH * 0.12}
            onShow={() => setFireworks(++eventId.current)}
          />
        )}
        {layout && recordEvent !== null && <RecordBanner key={recordEvent} top={Math.max(0, centerY - 200)} />}
        {layout && levelEvent && (
          <PopBanner key={levelEvent.id} top={Math.max(0, centerY - 260)}>
            <Text style={styles.levelText}>Cấp {levelEvent.level}!</Text>
          </PopBanner>
        )}
        {layout && multiLines && <LinesBanner key={multiLines.id} lines={multiLines.lines} top={centerY + 20} />}
        {layout && comboEvent && <ComboBanner key={comboEvent.id} combo={comboEvent.combo} top={centerY - 130} />}
      </View>

      {showButtons && (
        <ControlBar
          running={running}
          onMove={onMove}
          onRotate={onRotate}
          onSoft={setSoft}
          onHardDrop={onHardDrop}
          onHold={onHold}
        />
      )}

      {!view.over && phase !== 'running' && (
        <View style={styles.overlay}>
          {phase === 'countdown' ? (
            <Text style={styles.countdown}>{count}</Text>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{phase === 'paused' ? 'Tạm dừng' : 'Sẵn sàng?'}</Text>
              <View style={styles.help}>
                <HelpRow icon="hand.tap.fill" text="Chạm: xoay khối" />
                <HelpRow icon="arrow.left.and.right" text="Kéo ngang: di chuyển" />
                <HelpRow icon="arrow.down" text="Kéo xuống giữ tay: rơi nhanh" />
                <HelpRow icon="arrow.down.to.line" text="Vuốt mạnh xuống: thả thẳng" />
                <HelpRow icon="arrow.up" text="Vuốt lên: giữ khối" />
              </View>
              <Pressable style={styles.primaryButton} onPress={startCountdown}>
                <Text style={styles.primaryText}>{phase === 'paused' ? 'Tiếp tục' : 'Bắt đầu'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
                <Text style={styles.secondaryText}>Về menu</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {over.showGameOver && (
        <GameOverOverlay
          score={view.score}
          best={best}
          result={result}
          losses={losses}
          stats={[
            { label: 'Hàng', value: view.lines },
            { label: 'Cấp', value: view.level },
            { label: 'Combo cao nhất', value: view.stats.maxCombo > 0 ? `x${view.stats.maxCombo}` : '–' },
          ]}
          recordFireworks={over.recordFireworks}
          showReview={over.showReview}
          onCloseReview={() => over.setShowReview(false)}
          onRestart={restart}
        />
      )}
    </View>
  );
}

const ClassicHeader = memo(function ClassicHeader({
  score,
  best,
  level,
  lines,
  tone,
  theme,
  running,
  onPause,
}: {
  score: number;
  best: number;
  level: number;
  lines: number;
  tone: 'dark' | 'light';
  theme: BoardTheme;
  running: boolean;
  onPause: () => void;
}) {
  const hud = hudColors(tone);
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" style={styles.iconButton}>
        <SymbolView name="chevron.left" size={22} tintColor={hud.text} style={styles.icon} />
      </Pressable>
      <View style={styles.scoreBox}>
        <Text style={[styles.score, { color: hud.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {score.toLocaleString()}
        </Text>
        <View style={styles.bestRow}>
          <SymbolView name="crown.fill" size={14} tintColor={hud.accent} style={styles.bestIcon} />
          <Text style={[styles.best, { color: hud.accent }]} numberOfLines={1}>
            {best.toLocaleString()}
          </Text>
          <Text style={[styles.sub, { color: hud.textDim }]}>
            {' '}
            · Cấp {level} · {lines} hàng
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onPause}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Tạm dừng"
        disabled={!running}
        style={({ pressed }) => [
          styles.pauseButton,
          { backgroundColor: rotationBadgeColor(theme) },
          (pressed || !running) && { opacity: 0.6 },
        ]}
      >
        <SymbolView name="pause.fill" size={16} tintColor={COLORS.text} style={styles.pauseIcon} />
      </Pressable>
    </View>
  );
});

const ControlBar = memo(function ControlBar({
  running,
  onMove,
  onRotate,
  onSoft,
  onHardDrop,
  onHold,
}: {
  running: boolean;
  onMove: (steps: number) => void;
  onRotate: () => void;
  onSoft: (down: boolean) => void;
  onHardDrop: () => void;
  onHold: () => void;
}) {
  const left = useCallback(() => onMove(-1), [onMove]);
  const right = useCallback(() => onMove(1), [onMove]);
  return (
    <View style={styles.controls}>
      <ControlButton icon="arrow.left" label="Sang trái" repeat onPress={left} disabled={!running} />
      <ControlButton icon="arrow.clockwise" label="Xoay" onPress={onRotate} disabled={!running} />
      <ControlButton icon="arrow.right" label="Sang phải" repeat onPress={right} disabled={!running} />
      <ControlButton icon="arrow.down" label="Rơi nhanh" onPress={noop} onHoldChange={onSoft} disabled={!running} />
      <ControlButton icon="arrow.down.to.line" label="Thả thẳng" onPress={onHardDrop} disabled={!running} />
      <ControlButton icon="tray.and.arrow.down.fill" label="Giữ khối" onPress={onHold} disabled={!running} />
    </View>
  );
});

const noop = () => {};

function ControlButton({
  icon,
  label,
  onPress,
  onHoldChange,
  repeat,
  disabled,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  onHoldChange?: (down: boolean) => void;
  repeat?: boolean;
  disabled?: boolean;
}) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.length = 0;
    onHoldChange?.(false);
  };
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => clearTimeout(t));
  }, []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => {
        onPress();
        onHoldChange?.(true);
        if (!repeat) return;
        const loop = () => {
          onPress();
          timers.current.push(setTimeout(loop, CONTROL_REPEAT_MS));
        };
        timers.current.push(setTimeout(loop, CONTROL_REPEAT_DELAY_MS));
      }}
      onPressOut={stop}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed, disabled && { opacity: 0.4 }]}
    >
      <SymbolView name={icon} size={22} weight="bold" tintColor={COLORS.text} style={styles.controlIcon} />
    </Pressable>
  );
}

function HelpRow({
  icon,
  text,
}: {
  icon: 'hand.tap.fill' | 'arrow.left.and.right' | 'arrow.down' | 'arrow.down.to.line' | 'arrow.up';
  text: string;
}) {
  return (
    <View style={styles.helpRow}>
      <SymbolView name={icon} size={18} tintColor={COLORS.accent} style={styles.helpIcon} />
      <Text style={styles.helpText}>{text}</Text>
    </View>
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
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 22, height: 22 },
  scoreBox: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  score: { color: COLORS.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bestRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bestIcon: { width: 14, height: 14, marginRight: 4 },
  best: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 13, fontWeight: '600' },
  pauseButton: { width: 40, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pauseIcon: { width: 16, height: 16 },
  boardArea: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  control: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(12, 16, 45, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: { backgroundColor: 'rgba(60, 70, 140, 0.9)' },
  controlIcon: { width: 22, height: 22 },
  sideLabel: { position: 'absolute', textAlign: 'center', fontSize: 13, fontWeight: '800' },
  levelText: {
    color: '#FFD84D',
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 10, 30, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    color: COLORS.text,
    fontSize: 96,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  card: { width: 300, borderRadius: 24, padding: 24, alignItems: 'center', backgroundColor: '#262D57' },
  cardTitle: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  help: { alignSelf: 'stretch', marginTop: 16, gap: 10 },
  helpRow: { flexDirection: 'row', alignItems: 'center' },
  helpIcon: { width: 22, height: 22, marginRight: 10 },
  helpText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  primaryButton: {
    marginTop: 22,
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: '#3DCB4A',
    alignItems: 'center',
  },
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
