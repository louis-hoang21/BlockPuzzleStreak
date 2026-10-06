import { readJson, writeJson } from './storage';

const KEY = 'storm-puzzle';

export interface PuzzleRecords {
  days: Record<string, number>;
}

export function loadPuzzleRecords(): PuzzleRecords {
  return readJson<PuzzleRecords>(KEY, { days: {} });
}

export function savePuzzleStars(day: string, stars: number): PuzzleRecords {
  const records = loadPuzzleRecords();
  if ((records.days[day] ?? 0) >= stars) return records;
  const next = { days: { ...records.days, [day]: stars } };
  writeJson(KEY, next);
  return next;
}
