export type Mode = 'jackpot' | 'classic';

export type BoardMode = 'jackpot';

export const CLASSIC_NAME = 'Cổ điển, tôn trọng';

export const MODES: readonly { id: Mode; name: string }[] = [
  { id: 'jackpot', name: 'Chuỗi Nổ' },
  { id: 'classic', name: CLASSIC_NAME },
];
