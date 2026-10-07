import type { Localized } from '../i18n';

export type Mode = 'jackpot' | 'classic';

export type BoardMode = 'jackpot';

export const CLASSIC_ENABLED = false;

export const CLASSIC_NAME: Localized = { en: 'Classic', vi: 'Cổ điển, tôn trọng' };

export const STORM_PUZZLE_NAME: Localized = { en: 'Storm Puzzle', vi: 'Giải đố cơn bão' };

export const MODES: readonly { id: Mode; name: Localized }[] = [
  { id: 'jackpot', name: { en: 'Storm Combo', vi: 'Chuỗi Nổ' } },
  { id: 'classic', name: CLASSIC_NAME },
];

export const VISIBLE_MODES = CLASSIC_ENABLED ? MODES : MODES.filter((m) => m.id !== 'classic');
