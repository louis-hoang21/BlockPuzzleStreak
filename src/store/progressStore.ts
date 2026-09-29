import { create } from 'zustand';

import milestones from '../../config/milestones.json';
import { SKIN_IDS, skinsForCombo, THEME_IDS, themeForPerfectClear } from '../core/cosmetics';
import { addRotations } from '../core/game';
import { rotationMilestonesCrossed, scoreUnlocksReached } from '../core/milestones';
import { loadDeviceProgress, saveDeviceProgress, type DeviceProgress } from '../persistence/deviceProgress';
import { skinName, themeName } from '../render/theme';
import { useNoticeStore, type RewardKind } from './noticeStore';
import { useSettingsStore } from './settingsStore';

interface ProgressStore extends DeviceProgress {
  setRotations: (rotations: number) => void;
  grantRotations: (amount: number) => number;
  onScore: (prev: number, next: number) => void;
  onPerfectClear: () => void;
  onCombo: (combo: number) => void;
  unlockAll: () => number;
}

const notify = (text: string, reward?: RewardKind) => useNoticeStore.getState().push(text, reward);

const equip = (patch: { theme?: string; skin?: string }) => useSettingsStore.getState().update(patch);
const fmt = (n: number) => n.toLocaleString();

export const useProgressStore = create<ProgressStore>()((set, get) => {
  const save = (patch: Partial<DeviceProgress>) => {
    const { rotations, unlockedThemes, unlockedSkins, giftRedeemed } = get();
    const next: DeviceProgress = { rotations, unlockedThemes, unlockedSkins, giftRedeemed, ...patch };
    saveDeviceProgress(next);
    set(next);
  };

  return {
    ...loadDeviceProgress(),
    setRotations: (rotations) => save({ rotations }),
    grantRotations: (amount) => {
      const { rotations, added } = addRotations(get().rotations, amount);
      if (added > 0) save({ rotations });
      return added;
    },
    onScore: (prev, next) => {
      for (const score of rotationMilestonesCrossed(prev, next)) {
        const added = get().grantRotations(milestones.rotationMilestones.rotations);
        if (added > 0) notify(`Mốc ${fmt(score)} điểm! +${added} lượt xoay`, 'rotation');
        else notify(`Mốc ${fmt(score)} điểm! Kho xoay đã đầy`);
      }
      const unlocks = scoreUnlocksReached(next, get().unlockedThemes, get().unlockedSkins);
      for (const u of unlocks) {
        if (u.kind === 'theme') {
          save({ unlockedThemes: [...get().unlockedThemes, u.id] });
          equip({ theme: u.id });
        } else {
          save({ unlockedSkins: [...get().unlockedSkins, u.id] });
          equip({ skin: u.id });
        }
        const name = u.kind === 'theme' ? `theme ${themeName(u.id)}` : `skin ${skinName(u.id)}`;
        notify(`Đạt ${fmt(u.score)} điểm! Mở khoá ${name}`, u.kind);
      }
    },
    onPerfectClear: () => {
      const theme = themeForPerfectClear(get().unlockedThemes);
      if (!theme) return;
      save({ unlockedThemes: [...get().unlockedThemes, theme] });
      equip({ theme });
      notify(`Perfect Clear! Mở khoá theme ${themeName(theme)}`, 'theme');
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
      equip({ skin: skins[skins.length - 1] });
      notify(`Combo x${combo}! Mở khoá skin ${skins.map(skinName).join(', ')}`, 'skin');
    },
  };
});
