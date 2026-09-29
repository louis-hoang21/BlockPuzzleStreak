import * as Haptics from 'expo-haptics';

import { coreHapticsAvailable, playPattern, type HapticEvent } from '../../modules/game-haptics';
import { useSettingsStore } from '../store/settingsStore';

const enabled = () => useSettingsStore.getState().haptics;
const ignore = () => {};

let useCore: boolean | null = null;
const core = () => {
  if (useCore === null) useCore = coreHapticsAvailable();
  return useCore;
};

const LIGHT: HapticEvent = [0, 0.45, 0.6];
const MEDIUM: HapticEvent = [0, 0.7, 0.55];
const HEAVY: HapticEvent = [0, 1, 0.45];
const RIGID: HapticEvent = [0, 0.9, 1];
const SELECTION: HapticEvent = [0, 0.35, 0.9];
const at = (delay: number, [, intensity, sharpness]: HapticEvent): HapticEvent => [delay, intensity, sharpness];
const SUCCESS: HapticEvent[] = [
  [0, 0.6, 0.5],
  [0.1, 0.9, 0.7],
];
const WARNING: HapticEvent[] = [
  [0, 0.8, 0.5],
  [0.15, 0.6, 0.5],
];
const ERROR: HapticEvent[] = [
  [0, 1, 0.6],
  [0.1, 1, 0.6],
  [0.2, 0.8, 0.4],
];

function play(events: HapticEvent[], fallback: () => void) {
  if (!enabled()) return;
  if (core() && playPattern(events)) return;
  fallback();
}

export function hapticPlace() {
  play([LIGHT], () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore));
}

export function hapticClear(lines: number) {
  const heavy = lines >= 4;
  play([heavy ? HEAVY : MEDIUM], () =>
    Haptics.impactAsync(heavy ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(ignore),
  );
}

export function hapticGameOver() {
  play(ERROR, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore));
}

export function hapticWarning() {
  play(WARNING, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore));
}

export function hapticTap() {
  play([SELECTION], () => Haptics.selectionAsync().catch(ignore));
}

export function hapticCombo(combo: number) {
  const events: HapticEvent[] = [HEAVY, ...SUCCESS.map(([d, i, s]): HapticEvent => [d + 0.12, i, s])];
  if (combo >= 4) events.push(at(0.26, RIGID));
  play(events, () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore), 120);
    if (combo >= 4) setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(ignore), 260);
  });
}

export function hapticCelebrate() {
  play([HEAVY, ...SUCCESS.map(([d, i, s]): HapticEvent => [d + 0.18, i, s])], () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore), 180);
  });
}
