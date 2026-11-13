import { useLocalSearchParams } from 'expo-router';

import { StormLevelScreen } from '../../ui/StormLevelScreen';

export default function StormLevelRoute() {
  const { level } = useLocalSearchParams<{ level?: string }>();
  const start = Math.max(1, Math.floor(Number(level) || 1));
  return <StormLevelScreen start={start} />;
}
