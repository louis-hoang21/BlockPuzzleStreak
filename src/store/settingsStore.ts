import { create } from 'zustand';

import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../persistence/settings';

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  ...loadSettings(),
  update: (patch) => {
    const state = get();
    const next = Object.fromEntries(KEYS.map((k) => [k, state[k]])) as unknown as Settings;
    Object.assign(next, patch);
    saveSettings(next);
    set(next);
  },
}));
