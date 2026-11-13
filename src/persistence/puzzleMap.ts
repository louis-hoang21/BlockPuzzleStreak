import { readJson, writeJson } from './storage';

const KEY = 'storm-puzzle-map';

export interface MapRecords {
  stars: Record<string, number>;
}

export function loadMapRecords(): MapRecords {
  return readJson<MapRecords>(KEY, { stars: {} });
}

export function levelStars(records: MapRecords, level: number): number {
  return records.stars[String(level)] ?? 0;
}

export function saveLevelStars(level: number, stars: number): MapRecords {
  const records = loadMapRecords();
  if (levelStars(records, level) >= stars) return records;
  const next = { stars: { ...records.stars, [String(level)]: stars } };
  writeJson(KEY, next);
  return next;
}

export function nextLevel(records: MapRecords): number {
  let level = 1;
  while (levelStars(records, level) > 0) level++;
  return level;
}

export function totalStars(records: MapRecords): number {
  return Object.values(records.stars).reduce((sum, v) => sum + v, 0);
}
