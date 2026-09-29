import { DEFAULT_SKIN, DEFAULT_THEME } from '../core/cosmetics';
import { readJson, writeJson } from './storage';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  theme: string;
  skin: string;
  reminder: boolean;
  reminderHour: number;
  reminderMinute: number;
  onboarded: boolean;
}

const KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  theme: DEFAULT_THEME,
  skin: DEFAULT_SKIN,
  reminder: false,
  reminderHour: 19,
  reminderMinute: 0,
  onboarded: false,
};

export function loadSettings(): Settings {
  return readJson<Settings>(KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Settings) {
  writeJson(KEY, settings);
}
