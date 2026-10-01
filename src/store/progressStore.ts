import { create } from 'zustand';

import { SKIN_IDS, skinsForCombo, THEME_IDS, themeForPerfectClear } from '../core/cosmetics';
import { scoreUnlocksReached } from '../core/milestones';
import { loadDeviceProgress, saveDeviceProgress, type DeviceProgress } from '../persistence/deviceProgress';
import { skinName, themeName } from '../render/theme';
import { useNoticeStore, type ApplyPatch, type RewardKind } from './noticeStore';

interface ProgressStore extends DeviceProgress {
  onScore: (prev: number, next: number) => void;
  onPerfectClear: () => void;
  onCombo: (combo: number) => void;
  unlockAll: () => number;
}

const notify = (text: string, reward?: RewardKind, apply?: ApplyPatch) =>
  useNoticeStore.getState().push(text, reward, apply);

const fmt = (n: number) => n.toLocaleString();

export const useProgressStore = create<ProgressStore>()((set, get) => {
  const save = (patch: Partial<DeviceProgress>) => {
    const { unlockedThemes, unlockedSkins, giftRedeemed } = get();
    const next: DeviceProgress = { unlockedThemes, unlockedSkins, giftRedeemed, ...patch };
    saveDeviceProgress(next);
    set(next);
  };

  return {
    ...loadDeviceProgress(),
    onScore: (prev, next) => {
      const unlocks = scoreUnlocksReached(next, get().unlockedThemes, get().unlockedSkins);
      for (const u of unlocks) {
        if (u.kind === 'theme') {
          save({ unlockedThemes: [...get().unlockedThemes, u.id] });
          continue;
        }
        save({ unlockedSkins: [...get().unlockedSkins, u.id] });
        notify(`Đạt ${fmt(u.score)} điểm! Mở khoá skin ${skinName(u.id)}`, u.kind, { skin: u.id });
      }
    },
    onPerfectClear: () => {
      const theme = themeForPerfectClear(get().unlockedThemes);
      if (!theme) return;
      save({ unlockedThemes: [...get().unlockedThemes, theme] });
      notify(`Perfect Clear! Mở khoá theme ${themeName(theme)}`, 'theme', { theme });
    },
    unlockAll: () => {
      const { unlockedThemes, unlockedSkins } = get();
      const opened =
        THEME_IDS.filter((id) => !unlockedThemes.includes(id)).length +
        SKIN_IDS.filter((id) => !unlockedSkins.includes(id)).length;
      save({ unlockedThemes: [...THEME_IDS], unlockedSkins: [...SKIN_IDS], giftRedeemed: true });
      return opened;
    },
    onCombo: (combo) => {
      const skins = skinsForCombo(get().unlockedSkins, combo);
      if (skins.length === 0) return;
      save({ unlockedSkins: [...get().unlockedSkins, ...skins] });
      notify(`Combo x${combo}! Mở khoá skin ${skins.map(skinName).join(', ')}`, 'skin', {
        skin: skins[skins.length - 1],
      });
    },
  };
});

export const hasGiftPass = () => useProgressStore.getState().giftRedeemed;
