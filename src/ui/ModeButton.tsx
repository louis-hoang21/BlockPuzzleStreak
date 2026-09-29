import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ModeButtonColors {
  face: string;
  shade: string;
  gloss: string;
}

export const MODE_BUTTON_COLORS = {
  green: { face: '#45C93A', shade: '#1F7A1A', gloss: 'rgba(255,255,255,0.28)' },
  blue: { face: '#2F8BFF', shade: '#1A4FAE', gloss: 'rgba(255,255,255,0.28)' },
} satisfies Record<string, ModeButtonColors>;

interface Props {
  label: string;
  colors: ModeButtonColors;
  onPress: () => void;
}

export function ModeButton({ label, colors, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={[styles.base, { backgroundColor: colors.shade, paddingBottom: pressed ? 1 : 4 }]}>
          <View style={[styles.face, { backgroundColor: colors.face, marginTop: pressed ? 3 : 0 }]}>
            <View style={[styles.gloss, { backgroundColor: colors.gloss }]} />
            <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
            <SymbolView name="chevron.right" size={15} weight="heavy" tintColor="#FFFFFF" style={styles.chevron} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  face: {
    height: 42,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  gloss: { position: 'absolute', top: 3, left: 14, right: 14, height: 12, borderRadius: 999 },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  chevron: { width: 15, height: 15, marginLeft: 5 },
});
