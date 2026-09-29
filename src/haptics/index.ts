import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '../store/settingsStore';

const enabled = () => useSettingsStore.getState().haptics;
const ignore = () => {};

export function hapticPlace() {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

export function hapticClear(lines: number) {
  if (!enabled()) return;
  Haptics.impactAsync(lines >= 4 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
}

export function hapticGameOver() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
}

export function hapticWarning() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
}

export function hapticTap() {
  if (enabled()) Haptics.selectionAsync().catch(ignore);
}

export function hapticCombo(combo: number) {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
  setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore), 120);
  if (combo >= 4) setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(ignore), 260);
}

export function hapticCelebrate() {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
  setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore), 180);
}
