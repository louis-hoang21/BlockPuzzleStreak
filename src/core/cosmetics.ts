import cosmetics from '../../config/cosmetics.json';

export type Unlock = (typeof cosmetics.themes)[number]['unlock'] | (typeof cosmetics.skins)[number]['unlock'];

export const THEME_IDS = cosmetics.themes.map((t) => t.id);
export const SKIN_IDS = cosmetics.skins.map((s) => s.id);
export const DEFAULT_THEME = cosmetics.themes.find((t) => t.unlock.type === 'default')!.id;
export const DEFAULT_SKIN = cosmetics.skins.find((s) => s.unlock.type === 'default')!.id;

export function themeUnlock(id: string): Unlock | undefined {
  return cosmetics.themes.find((t) => t.id === id)?.unlock;
}

export function skinUnlock(id: string): Unlock | undefined {
  return cosmetics.skins.find((s) => s.id === id)?.unlock;
}

export function themeForPerfectClear(unlocked: readonly string[]): string | null {
  const next = cosmetics.themes
    .filter((t) => t.unlock.type === 'perfectClear' && !unlocked.includes(t.id))
    .sort((a, b) => ('count' in a.unlock ? a.unlock.count! : 0) - ('count' in b.unlock ? b.unlock.count! : 0))[0];
  return next?.id ?? null;
}

export function skinsForCombo(unlocked: readonly string[], combo: number): string[] {
  return cosmetics.skins
    .filter((s) => s.unlock.type === 'combo' && 'multiplier' in s.unlock && combo >= s.unlock.multiplier! && !unlocked.includes(s.id))
    .map((s) => s.id);
}
