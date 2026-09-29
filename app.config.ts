import type { ConfigContext, ExpoConfig } from 'expo/config';

const env = (name: string) => process.env[name]?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Block Puzzle: Streak',
  slug: config.slug ?? 'block-puzzle-streak',
  ios: {
    ...config.ios,
    bundleIdentifier: env('IOS_BUNDLE_ID') ?? 'com.example.blockpuzzlestreak',
    appleTeamId: env('APPLE_TEAM_ID'),
    appStoreUrl: env('APP_STORE_URL'),
  },
});
