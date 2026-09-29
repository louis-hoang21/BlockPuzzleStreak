import type { Mode } from '../core/modes';
import { readJson, storage, writeJson } from './storage';

export interface Records {
  bestScore: number;
  totalLinesCleared: number;
  gamesPlayed: number;
  gamesBelowBest: number;
}

const key = (mode: Mode) => `records.${mode}`;
const LEGACY_KEY = 'records';
const EMPTY: Records = { bestScore: 0, totalLinesCleared: 0, gamesPlayed: 0, gamesBelowBest: 0 };

export function loadRecords(mode: Mode): Records {
  if (mode === 'jackpot' && storage.getString(key(mode)) === undefined && storage.getString(LEGACY_KEY) !== undefined) {
    const legacy = readJson(LEGACY_KEY, EMPTY);
    saveRecords(mode, legacy);
    return legacy;
  }
  return readJson(key(mode), EMPTY);
}

export function saveRecords(mode: Mode, { bestScore, totalLinesCleared, gamesPlayed, gamesBelowBest }: Records) {
  writeJson(key(mode), { bestScore, totalLinesCleared, gamesPlayed, gamesBelowBest });
}

export function addGame(
  records: Records,
  score: number,
  lines: number,
): { records: Records; newBest: boolean; tiedBest: boolean } {
  return {
    records: {
      bestScore: Math.max(records.bestScore, score),
      totalLinesCleared: records.totalLinesCleared + lines,
      gamesPlayed: records.gamesPlayed + 1,
      gamesBelowBest: records.gamesBelowBest + (score < records.bestScore ? 1 : 0),
    },
    newBest: score > records.bestScore,
    tiedBest: score > 0 && score === records.bestScore,
  };
}
