import { router, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLASSIC_NAME, MODES } from '../core/modes';
import { hapticTap } from '../haptics';
import { MODE_BUTTON_COLORS, ModeButton } from '../ui/ModeButton';

const ART = require('../../assets/welcome.jpg');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  const openJackpot = () => {
    hapticTap();
    router.push('/game/jackpot');
  };

  const openClassic = () => {
    hapticTap();
    router.push('/game/classic');
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
  modes: { alignSelf: 'center', width: 230, gap: 10 },
});
