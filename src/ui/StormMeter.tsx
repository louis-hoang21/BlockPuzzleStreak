import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '../i18n';

const FILL = '#3FA9F5';
const FILL_READY = '#7FD3FF';
const ICON = '#FFFFFF';
const FILL_MS = 450;
const PULSE_MS = 500;

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  energy: number;
  need: number;
  ready: boolean;
  done: boolean;
  disabled: boolean;
  tone: 'dark' | 'light';
  textColor: string;
  onPress: () => void;
}

export function StormMeter({ x, y, width, height, energy, need, ready, done, disabled, tone, textColor, onPress }: Props) {
  const tr = useT();
  const ratio = done || need === 0 ? 0 : Math.min(1, energy / need);
  const progress = useSharedValue(ratio);
  const glow = useSharedValue(1);
  const bump = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: FILL_MS });
  }, [ratio, progress]);

  useEffect(() => {
    if (ready) {
      glow.value = withRepeat(withSequence(withTiming(0.55, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })), -1);
      bump.value = withRepeat(withSequence(withTiming(1.06, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })), -1);
    } else {
      cancelAnimation(glow);
      cancelAnimation(bump);
      glow.value = 1;
      bump.value = 1;
    }
  }, [ready, glow, bump]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%`, opacity: glow.value }));
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const label = done
    ? tr('No more storms', 'Hết bão ván này')
    : ready
      ? tr('Tap for storm!', 'Chạm gọi bão!')
      : tr(`Storm ${energy}/${need}`, `Bão ${energy}/${need}`);
  const iconSize = Math.round(height * 0.62);
  const fontSize = Math.max(11, height * 0.4);
  const tappable = ready && !disabled;

  return (
    <Animated.View
      pointerEvents={tappable ? 'auto' : 'none'}
      style={[styles.wrap, { left: x, top: y, width, height, opacity: done ? 0.5 : 1 }, bumpStyle]}
    >
      <Pressable
        onPress={onPress}
        disabled={!tappable}
        accessibilityRole={tappable ? 'button' : 'progressbar'}
        accessibilityLabel={label}
        hitSlop={8}
        style={({ pressed }) => [styles.row, ready && styles.rowReady, pressed && styles.rowPressed]}
      >
        <View style={styles.iconShadow}>
          <SymbolView name="tornado" size={iconSize} tintColor={ICON} style={{ width: iconSize, height: iconSize }} />
        </View>
        <View
          style={[
            styles.track,
            {
              height: height * 0.42,
              borderRadius: height,
              backgroundColor: tone === 'light' ? 'rgba(78,47,23,0.22)' : 'rgba(255,255,255,0.18)',
            },
          ]}
        >
          <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: ready ? FILL_READY : FILL }, fillStyle]} />
        </View>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor, fontSize }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  rowReady: {
    backgroundColor: 'rgba(63,169,245,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(127,211,255,0.7)',
  },
  rowPressed: { opacity: 0.6 },
  iconShadow: {
    shadowColor: '#1A4F7A',
    shadowOpacity: 0.55,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  labelRow: {
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  label: {
    fontWeight: '700',
    textAlign: 'right',
  },
});
