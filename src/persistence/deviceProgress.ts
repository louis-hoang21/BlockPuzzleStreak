import { DEFAULT_SKIN, DEFAULT_THEME, SKIN_IDS, THEME_IDS } from '../core/cosmetics';
import { keychainBackend, readSigned, writeSigned } from './storage';

export interface DeviceProgress {
  unlockedThemes: string[];
  unlockedSkins: string[];
  giftRedeemed: boolean;
}

const ITEM = 'device-progress';

export function loadDeviceProgress(): DeviceProgress {
  const fallback: DeviceProgress = {
    unlockedThemes: [DEFAULT_THEME],
    unlockedSkins: [DEFAULT_SKIN],
    giftRedeemed: false,
  };
  const { unlockedThemes, unlockedSkins, giftRedeemed } = readSigned(keychainBackend, ITEM, fallback);
  if (!giftRedeemed) return { unlockedThemes, unlockedSkins, giftRedeemed };
  const merged: DeviceProgress = {
    unlockedThemes: [...new Set([...unlockedThemes, ...THEME_IDS])],
    unlockedSkins: [...new Set([...unlockedSkins, ...SKIN_IDS])],
    giftRedeemed,
  };
  if (merged.unlockedThemes.length !== unlockedThemes.length || merged.unlockedSkins.length !== unlockedSkins.length) {
    saveDeviceProgress(merged);
  }
  return merged;
}

export function saveDeviceProgress(progress: DeviceProgress) {
  writeSigned(keychainBackend, ITEM, progress);
}
