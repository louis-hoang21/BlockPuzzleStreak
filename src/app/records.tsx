import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import milestones from '../../config/milestones.json';
import { SCORE_UNLOCKS } from '../core/milestones';
import { MODES, type Mode } from '../core/modes';
import { hapticTap } from '../haptics';
import { COLORS, skinName, themeName } from '../render/theme';
import { useRecordsStore } from '../store/recordsStore';
import { ScreenHeader } from '../ui/ScreenHeader';

export default function RecordsScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(MODES[0].id);
  const { bestScore, totalLinesCleared, gamesPlayed, gamesBelowBest, bestLevel } = useRecordsStore(
    (s) => s.byMode[mode],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Kỷ lục" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
        {MODES.length > 1 && (
          <View style={styles.tabs}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  hapticTap();
                  setMode(m.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: m.id === mode }}
                style={[styles.tab, m.id === mode && styles.tabActive]}>
                <Text style={[styles.tabText, m.id === mode && styles.tabTextActive]}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.bestCard}>
          <Text style={styles.bestLabel}>Điểm cao nhất</Text>
          <Text style={styles.bestValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {bestScore.toLocaleString()}
          </Text>
        </View>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.totalValue}>{gamesPlayed.toLocaleString()}</Text>
            <Text style={styles.totalLabel}>Ván đã chơi</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalValue}>{gamesBelowBest.toLocaleString()}</Text>
            <Text style={styles.totalLabel}>Ván thua kỷ lục</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalValue}>{totalLinesCleared.toLocaleString()}</Text>
            <Text style={styles.totalLabel}>{mode === 'classic' ? 'Tổng hàng' : 'Tổng nổ hũ'}</Text>
          </View>
          {mode === 'classic' && (
            <View style={styles.total}>
              <Text style={styles.totalValue}>{bestLevel.toLocaleString()}</Text>
              <Text style={styles.totalLabel}>Cấp cao nhất</Text>
            </View>
          )}
        </View>
        {mode === 'jackpot' && (
          <>
            <Text style={styles.section}>Mốc điểm trong một ván</Text>
            <View style={styles.milestones}>
              {[...new Set([...milestones.rotationMilestones.scores, ...SCORE_UNLOCKS.map((u) => u.score)])]
                .sort((a, b) => a - b)
                .map((score) => {
                  const reached = bestScore >= score;
                  const rewards = [
                    ...(milestones.rotationMilestones.scores.includes(score) ? ['+1 xoay mỗi ván'] : []),
                    ...SCORE_UNLOCKS.filter((u) => u.score === score).map((u) =>
                      u.kind === 'theme' ? `Theme ${themeName(u.id)}` : `Skin ${skinName(u.id)}`,
                    ),
                  ];
                  return (
                    <View key={score} style={styles.milestoneRow}>
                      <Text style={[styles.milestoneScore, reached && styles.milestoneReached]}>
                        {reached ? '✓ ' : ''}
                        {score.toLocaleString()}
                      </Text>
                      <Text style={styles.milestoneReward}>{rewards.join(' · ')}</Text>
                    </View>
                  );
                })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: '#232A4D', marginTop: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#3DCB4A' },
  tabText: { color: COLORS.textDim, fontSize: 15, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  bestCard: { marginTop: 8, borderRadius: 20, padding: 20, backgroundColor: '#262D57', alignItems: 'center' },
  bestLabel: { color: COLORS.textDim, fontSize: 15, fontWeight: '700' },
  bestValue: { color: COLORS.accent, fontSize: 48, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', gap: 12, marginTop: 12 },
  total: { flex: 1, borderRadius: 16, padding: 14, backgroundColor: '#232A4D', alignItems: 'center' },
  totalValue: { color: COLORS.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalLabel: { color: COLORS.textDim, fontSize: 13, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  section: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 8 },
  milestones: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#232A4D' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  milestoneScore: { width: 90, color: COLORS.textDim, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  milestoneReached: { color: '#3DCB4A' },
  milestoneReward: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
