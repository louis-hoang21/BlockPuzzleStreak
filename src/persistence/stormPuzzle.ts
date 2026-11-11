import { shiftDay } from '../core/stormPuzzle';
import { readJson, writeJson } from './storage';

const KEY = 'storm-puzzle';
const RUN_KEY = 'storm-puzzle-run';

export interface PuzzleRecords {
  days: Record<string, number>;
}

interface PuzzleRun {
  day: string;
  variant: number;
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

export function puzzleStreak(records: PuzzleRecords, today: string): number {
  let streak = 0;
  while ((records.days[shiftDay(today, -(streak + 1))] ?? 0) > 0) streak++;
  return streak;
}

export function puzzleVariant(day: string): number {
  const run = readJson<PuzzleRun>(RUN_KEY, { day, variant: 0 });
  return run.day === day ? run.variant : 0;
}

export function reshufflePuzzle(day: string): number {
  if ((loadPuzzleRecords().days[day] ?? 0) > 0) return puzzleVariant(day);
  const variant = puzzleVariant(day) + 1;
  writeJson(RUN_KEY, { day, variant });
  return variant;
}
