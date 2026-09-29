import * as Notifications from 'expo-notifications';

const DAYS_AHEAD = 7;

const MESSAGES = [
  'JackPot đang chờ bạn. Vào nổ hũ nhé!',
  'Còn mốc điểm chưa mở khoá đấy. Thử phá kỷ lục hôm nay?',
  'Một ván nhanh trước khi nghỉ ngơi?',
  'Combo x3 mở skin mới. Bạn đạt được chưa?',
  'Kỷ lục của bạn đang chờ bị phá!',
  'Vài phút xếp khối cho đầu óc thư giãn.',
  'Perfect Clear mở theme mới. Thử ngay!',
  'Vào chan tiếp đi, bạn sợ à?',
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
      content: { title: 'Block Puzzle: Streak', body: MESSAGES[date.getDate() % MESSAGES.length] },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

export async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
