import * as Notifications from 'expo-notifications';

import { t, useLangStore, type Localized } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';

const DAYS_AHEAD = 7;

const MESSAGES: Localized[] = [
  { en: 'Your blast streak is waiting. Come clear a few lines!', vi: 'Chuỗi Nổ đang chờ bạn. Vào nổ vài hàng nhé!' },
  {
    en: 'There are score milestones left to unlock. Beat your record today?',
    vi: 'Còn mốc điểm chưa mở khoá đấy. Thử phá kỷ lục hôm nay?',
  },
  { en: 'One quick round before you rest?', vi: 'Một ván nhanh trước khi nghỉ ngơi?' },
  { en: 'A x3 combo unlocks a new skin. Got it yet?', vi: 'Combo x3 mở skin mới. Bạn đạt được chưa?' },
  { en: 'Your record is waiting to be broken!', vi: 'Kỷ lục của bạn đang chờ bị phá!' },
  { en: 'A few minutes of stacking blocks to relax your mind.', vi: 'Vài phút xếp khối cho đầu óc thư giãn.' },
  { en: 'Perfect Clear unlocks a new theme. Try it now!', vi: 'Perfect Clear mở theme mới. Thử ngay!' },
  { en: 'Come back for another round, scared?', vi: 'Vào chan tiếp đi, bạn sợ à?' },
];

export type ReminderPermission = 'granted' | 'denied' | 'blocked';

export async function ensurePermission(): Promise<ReminderPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted ? 'granted' : asked.canAskAgain ? 'denied' : 'blocked';
}

export async function scheduleReminders(hour: number, minute: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  const start = new Date();
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, hour, minute);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Toast Twister', body: t(MESSAGES[date.getDate() % MESSAGES.length]) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

export async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

useLangStore.subscribe((state, prev) => {
  if (state.lang === prev.lang) return;
  const { reminder, reminderHour, reminderMinute } = useSettingsStore.getState();
  if (reminder) scheduleReminders(reminderHour, reminderMinute);
});
