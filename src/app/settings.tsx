import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GIFT_CODES_ENABLED, isValidGiftCode } from '../core/giftCodes';
import { hapticTap, hapticWarning } from '../haptics';
import { cancelReminders, ensurePermission, scheduleReminders } from '../notifications/reminder';
import { COLORS } from '../render/theme';
import { useProgressStore } from '../store/progressStore';
import { useSettingsStore } from '../store/settingsStore';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Toggle } from '../ui/Toggle';

const REMINDER_TIMES = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
];

const pad = (n: number) => String(n).padStart(2, '0');

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { sound, haptics, reminder, reminderHour, reminderMinute, update } = useSettingsStore();
  const [blocked, setBlocked] = useState(false);

  const toggleReminder = async (on: boolean) => {
    if (!on) {
      update({ reminder: false });
      setBlocked(false);
      await cancelReminders();
      return;
    }
    const permission = await ensurePermission();
    if (permission !== 'granted') {
      setBlocked(permission === 'blocked');
      return;
    }
    setBlocked(false);
    update({ reminder: true });
    await scheduleReminders(reminderHour, reminderMinute);
  };

  const pickTime = async (hour: number, minute: number) => {
    hapticTap();
    update({ reminderHour: hour, reminderMinute: minute });
    if (reminder) await scheduleReminders(hour, minute);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Cài đặt" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={styles.card}>
          <Row label="Âm thanh" value={sound} onChange={(v) => update({ sound: v })} />
          <View style={styles.divider} />
          <Row label="Rung" value={haptics} onChange={(v) => update({ haptics: v })} />
        </View>

        <View style={styles.card}>
          <Row label="Nhắc chơi mỗi ngày" value={reminder} onChange={toggleReminder} />
          {reminder && (
            <View style={styles.times}>
              {REMINDER_TIMES.map(({ hour, minute }) => {
                const selected = hour === reminderHour && minute === reminderMinute;
                return (
                  <Pressable
                    key={hour}
                    onPress={() => pickTime(hour, minute)}
                    style={[styles.time, selected && styles.timeSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}>
                    <Text style={[styles.timeText, selected && styles.timeTextSelected]}>
                      {pad(hour)}:{pad(minute)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {blocked && (
            <View style={styles.blocked}>
              <Text style={styles.blockedText}>
                Thông báo đang bị tắt cho app này. Bật lại trong Cài đặt của iPhone.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.link}>
                <Text style={styles.linkText}>Mở Cài đặt</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.hint}>Chỉ nhắc vào những ngày bạn chưa mở game. Không gửi gì qua mạng.</Text>
        </View>

        <Pressable
          style={styles.card}
          onPress={() => {
            hapticTap();
            update({ onboarded: false });
          }}>
          <View style={styles.row}>
            <Text style={styles.label}>Xem lại hướng dẫn</Text>
            <Text style={styles.hintInline}>Hiện ở ván tiếp theo</Text>
          </View>
        </Pressable>

        {GIFT_CODES_ENABLED && <GiftCodeCard />}

        <Text style={styles.version}>Phiên bản {Constants.expoConfig?.version ?? '–'}</Text>
      </ScrollView>
    </View>
  );
}

function GiftCodeCard() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const redeemed = useProgressStore((s) => s.giftRedeemed);

  const redeem = () => {
    if (!isValidGiftCode(code)) {
      hapticWarning();
      setMessage({ ok: false, text: 'Mã không đúng. Kiểm tra lại nhé.' });
      return;
    }
    hapticTap();
    const opened = useProgressStore.getState().unlockAll();
    setCode('');
    setMessage({
      ok: true,
      text: opened > 0 ? 'Bật tung nắp kho báu, chiến nào!!!' : 'Bạn đã có đủ theme và skin rồi.',
    });
  };

  if (redeemed) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Mã quà tặng</Text>
          <Text style={styles.redeemedBadge}>Đã dùng</Text>
        </View>
        <Text style={styles.redeemedText}>Kho báu đã mở: toàn bộ theme và skin. Vào Bộ sưu tập để chọn nhé!</Text>
        {message?.ok && <Text style={[styles.codeMessage, { color: '#3DCB4A' }]}>{message.text}</Text>}
        <View style={{ height: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Mã quà tặng</Text>
      </View>
      <View style={styles.codeRow}>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setMessage(null);
          }}
          placeholder="BPS-XXXX-XXXX"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={24}
          returnKeyType="done"
          onSubmitEditing={redeem}
          style={styles.codeInput}
        />
        <Pressable
          onPress={redeem}
          disabled={code.trim().length === 0}
          style={[styles.codeButton, code.trim().length === 0 && styles.codeButtonDisabled]}>
          <Text style={styles.codeButtonText}>Dùng</Text>
        </Pressable>
      </View>
      {message && (
        <Text style={[styles.codeMessage, { color: message.ok ? '#3DCB4A' : COLORS.accent }]}>{message.text}</Text>
      )}
      <View style={{ height: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: { marginHorizontal: 20, marginTop: 12, borderRadius: 16, backgroundColor: '#262D57', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  label: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#3A4275' },
  times: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  time: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#1F254A' },
  timeSelected: { backgroundColor: '#3DCB4A' },
  timeText: { color: COLORS.textDim, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeTextSelected: { color: '#FFFFFF' },
  blocked: { paddingBottom: 10 },
  blockedText: { color: COLORS.accent, fontSize: 13, lineHeight: 18 },
  link: { marginTop: 6, alignSelf: 'flex-start' },
  linkText: { color: '#6FA6FF', fontSize: 14, fontWeight: '700' },
  hint: { color: COLORS.textDim, fontSize: 12, paddingBottom: 12, lineHeight: 16 },
  hintInline: { color: COLORS.textDim, fontSize: 13 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1F254A',
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#3DCB4A',
    justifyContent: 'center',
  },
  codeButtonDisabled: { opacity: 0.4 },
  codeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  redeemedBadge: {
    color: '#3DCB4A',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(61, 203, 74, 0.15)',
    overflow: 'hidden',
  },
  redeemedText: { color: COLORS.textDim, fontSize: 14, lineHeight: 20 },
  codeMessage: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  version: { marginTop: 24, textAlign: 'center', color: COLORS.textDim, fontSize: 13 },
});
