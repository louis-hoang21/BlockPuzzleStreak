import type { ConfigContext, ExpoConfig } from 'expo/config';

const env = (name: string) => process.env[name]?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Toast Twister',
  slug: config.slug ?? 'toast-twister',
  ios: {
    ...config.ios,
    bundleIdentifier: env('IOS_BUNDLE_ID') ?? 'com.example.toasttwister',
    appleTeamId: env('APPLE_TEAM_ID'),
    appStoreUrl: env('APP_STORE_URL'),
  },
});
