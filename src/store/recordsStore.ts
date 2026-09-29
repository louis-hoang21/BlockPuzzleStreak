import { create } from 'zustand';

import { MODES, type Mode } from '../core/modes';
import { addGame, loadRecords, saveRecords, type Records } from '../persistence/records';

export interface GameResult {
  score: number;
  newBest: boolean;
  tiedBest: boolean;
}

interface RecordsStore {
  byMode: Record<Mode, Records>;
  submit: (mode: Mode, score: number, lines: number, level?: number) => GameResult;
}

export const useRecordsStore = create<RecordsStore>()((set, get) => ({
  byMode: Object.fromEntries(MODES.map((m) => [m.id, loadRecords(m.id)])) as Record<Mode, Records>,
  submit: (mode, score, lines, level) => {
    const result = addGame(get().byMode[mode], score, lines, level);
    saveRecords(mode, result.records);
    set({ byMode: { ...get().byMode, [mode]: result.records } });
    return { score, newBest: result.newBest, tiedBest: result.tiedBest };
  },
}));
