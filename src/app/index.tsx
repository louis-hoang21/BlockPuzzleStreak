import { router, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { ImageBackground, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLASSIC_NAME, MODES } from '../core/modes';
import { hapticTap } from '../haptics';
import { COLORS } from '../render/theme';
import { MODE_BUTTON_COLORS, ModeButton } from '../ui/ModeButton';

const ART = require('../../assets/welcome.jpg');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [comingSoon, setComingSoon] = useState(false);

  const openJackpot = () => {
    hapticTap();
    router.push('/game/jackpot');
  };

  const openClassic = () => {
    hapticTap();
    setComingSoon(true);
  };

  return (
    <ImageBackground source={ART} resizeMode="cover" style={styles.container}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton icon="paintpalette.fill" label="Bộ sưu tập" href="/collection" />
        <IconButton icon="trophy.fill" label="Kỷ lục" href="/records" />
        <IconButton icon="gearshape.fill" label="Cài đặt" href="/settings" />
      </View>
      <View style={[styles.modes, { paddingBottom: insets.bottom + 20 }]}>
        <ModeButton label={MODES[0].name} colors={MODE_BUTTON_COLORS.green} onPress={openJackpot} />
        <ModeButton label={CLASSIC_NAME} colors={MODE_BUTTON_COLORS.blue} onPress={openClassic} />
      </View>

      <Modal visible={comingSoon} transparent animationType="fade" onRequestClose={() => setComingSoon(false)}>
        <Pressable style={styles.backdrop} onPress={() => setComingSoon(false)} accessibilityLabel="Đóng">
          <View style={styles.popup}>
            <SymbolView name="hammer.fill" size={36} tintColor={COLORS.accent} style={styles.popupIcon} />
            <Text style={styles.popupTitle}>Coming soon!</Text>
            <Text style={styles.popupBody}>{CLASSIC_NAME} đang được làm. Hẹn bạn ở bản cập nhật sau!</Text>
            <Pressable
              style={styles.popupButton}
              onPress={() => {
                hapticTap();
                setComingSoon(false);
              }}
              accessibilityRole="button">
              <Text style={styles.popupButtonText}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

function IconButton({ icon, label, href }: { icon: SFSymbol; label: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        hapticTap();
        router.push(href);
      }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
      <SymbolView name={icon} size={20} tintColor="#FFFFFF" style={styles.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#1B1F3B' },
  topBar: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(12, 16, 45, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { opacity: 0.6 },
  icon: { width: 20, height: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 10, 30, 0.7)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  popup: { width: '100%', maxWidth: 300, borderRadius: 24, padding: 24, backgroundColor: '#262D57', alignItems: 'center' },
  popupIcon: { width: 36, height: 36 },
  popupTitle: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginTop: 8 },
  popupBody: { color: COLORS.textDim, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  popupButton: {
    marginTop: 20,
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: '#2F8BFF',
    alignItems: 'center',
  },
  popupButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  modes: { alignSelf: 'center', width: 230, gap: 10 },
});
