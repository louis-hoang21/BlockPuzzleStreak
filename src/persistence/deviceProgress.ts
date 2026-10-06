import { SKIN_IDS, STARTER_SKINS, STARTER_THEMES, THEME_IDS } from '../core/cosmetics';
import { keychainBackend, readSigned, writeSigned } from './storage';

export interface DeviceProgress {
  unlockedThemes: string[];
  unlockedSkins: string[];
  giftRedeemed: boolean;
  tester?: boolean;
  testerRedeemed?: boolean;
}

const ITEM = 'device-progress';

export function loadDeviceProgress(): DeviceProgress {
  const fallback: DeviceProgress = {
    unlockedThemes: STARTER_THEMES,
    unlockedSkins: STARTER_SKINS,
    giftRedeemed: false,
  };
  const saved = readSigned(keychainBackend, ITEM, fallback);
  const { giftRedeemed, tester, testerRedeemed } = saved;
  const unlockedThemes = [...new Set([...saved.unlockedThemes, ...STARTER_THEMES])];
  const unlockedSkins = [...new Set([...saved.unlockedSkins, ...STARTER_SKINS])];
  const grew =
    unlockedThemes.length !== saved.unlockedThemes.length || unlockedSkins.length !== saved.unlockedSkins.length;
  if (!giftRedeemed) {
    if (grew) saveDeviceProgress({ unlockedThemes, unlockedSkins, giftRedeemed, tester, testerRedeemed });
    return { unlockedThemes, unlockedSkins, giftRedeemed, tester, testerRedeemed };
  }
  const merged: DeviceProgress = {
    unlockedThemes: [...new Set([...unlockedThemes, ...THEME_IDS])],
    unlockedSkins: [...new Set([...unlockedSkins, ...SKIN_IDS])],
    giftRedeemed,
    tester,
    testerRedeemed,
  };
  if (grew || merged.unlockedThemes.length !== unlockedThemes.length || merged.unlockedSkins.length !== unlockedSkins.length) {
    saveDeviceProgress(merged);
  }
  return merged;
}

export function saveDeviceProgress(progress: DeviceProgress) {
  writeSigned(keychainBackend, ITEM, progress);
}
