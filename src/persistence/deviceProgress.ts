import balance from '../../config/balance.json';
import { DEFAULT_SKIN, DEFAULT_THEME } from '../core/cosmetics';
import { keychainBackend, readSigned, writeSigned } from './storage';

export interface DeviceProgress {
  rotations: number;
  unlockedThemes: string[];
  unlockedSkins: string[];
  giftRedeemed: boolean;
}

const ITEM = 'device-progress';

export function loadDeviceProgress(): DeviceProgress {
  const fallback: DeviceProgress = {
    rotations: balance.startingRotations,
    unlockedThemes: [DEFAULT_THEME],
    unlockedSkins: [DEFAULT_SKIN],
    giftRedeemed: false,
  };
  return readSigned(keychainBackend, ITEM, fallback);
}

export function saveDeviceProgress(progress: DeviceProgress) {
  writeSigned(keychainBackend, ITEM, progress);
}
