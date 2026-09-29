import { requireOptionalNativeModule } from 'expo';

interface GameHapticsNative {
  isSupported(): boolean;
  play(events: number[][]): Promise<void>;
}

const native = requireOptionalNativeModule<GameHapticsNative>('GameHaptics');

export type HapticEvent = [delaySec: number, intensity: number, sharpness: number];

export function coreHapticsAvailable(): boolean {
  try {
    return !!native && native.isSupported();
  } catch {
    return false;
  }
}

export function playPattern(events: HapticEvent[]): boolean {
  if (!native) return false;
  native.play(events).catch(() => {});
  return true;
}
