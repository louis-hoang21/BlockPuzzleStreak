import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { scheduleReminders } from '../notifications/reminder';
import { useSettingsStore } from '../store/settingsStore';

function refreshReminders() {
  const { reminder, reminderHour, reminderMinute } = useSettingsStore.getState();
  if (reminder) scheduleReminders(reminderHour, reminderMinute);
}

export default function RootLayout() {
  useEffect(() => {
    refreshReminders();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReminders();
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1B1F3B' } }} />
    </GestureHandlerRootView>
  );
}
