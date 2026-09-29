export interface BlockColor {
  base: string;
  light: string;
  dark: string;
}

export const COLORS = {
  background: '#1B1F3B',
  text: '#FFFFFF',
  textDim: '#A9B0D6',
  accent: '#FFB547',
};

export const STAGE_LOOKS = {
  light: { background: '#F4F2FF', tone: 'light' },
  orange: { background: '#FFA24C', tone: 'light' },
  pink: { background: '#FF92C8', tone: 'light' },
  red: { background: '#E5484D', tone: 'dark' },
} as const satisfies Record<string, { background: string; tone: 'dark' | 'light' }>;

export function hudColors(tone: 'dark' | 'light') {
  return tone === 'light'
    ? { text: '#1B1F3B', textDim: '#4A4F75', accent: '#A34F00' }
    : { text: COLORS.text, textDim: COLORS.textDim, accent: COLORS.accent };
}

export interface BoardTheme {
  id: string;
  name: string;
  tone: 'dark' | 'light';
  background: string;
  boardFrame: string;
  boardBg: string;
  emptyCell: string;
  emptyCellStyle: 'plain' | 'sunset';
  backdrop?: 'night' | 'forest' | 'ocean' | 'space';
}

export const THEMES: readonly BoardTheme[] = [
  {
    id: 'theme-1',
    name: 'Đêm sao',
    tone: 'dark',
    background: '#1B1F3B',
    boardFrame: '#6B4226',
    boardBg: '#141833',
    emptyCell: '#232A4D',
    emptyCellStyle: 'plain',
    backdrop: 'night',
  },
  {
    id: 'theme-2',
    name: 'Rừng xanh',
    tone: 'dark',
    background: '#12291E',
    boardFrame: '#5A3B1F',
    boardBg: '#0C1D15',
    emptyCell: '#1A3A2A',
    emptyCellStyle: 'plain',
    backdrop: 'forest',
  },
  {
    id: 'theme-3',
    name: 'Hoàng hôn',
    tone: 'dark',
    background: '#3A1C3F',
    boardFrame: '#9C4A2E',
    boardBg: '#26122B',
    emptyCell: '#4A2552',
    emptyCellStyle: 'sunset',
  },
  {
    id: 'theme-4',
    name: 'Đại dương',
    tone: 'dark',
    background: '#0E2A3D',
    boardFrame: '#C9A36A',
    boardBg: '#081C2A',
    emptyCell: '#153A52',
    emptyCellStyle: 'plain',
    backdrop: 'ocean',
  },
  {
    id: 'theme-5',
    name: 'Vũ trụ',
    tone: 'dark',
    background: '#0E1633',
    boardFrame: '#5B3FA8',
    boardBg: '#070B1E',
    emptyCell: '#1B2447',
    emptyCellStyle: 'plain',
    backdrop: 'space',
  },
];

export type BlockStyle = 'bevel' | 'flower' | 'neon' | 'candy' | 'gem';

export interface Skin {
  id: string;
  name: string;
  style: BlockStyle;
  colors: readonly BlockColor[];
}

const CLASSIC: BlockColor[] = [
  { base: '#2F7BFF', light: '#6FA6FF', dark: '#1D4FB8' },
  { base: '#FF4B4B', light: '#FF8A7A', dark: '#B82A33' },
  { base: '#3DCB4A', light: '#7CE67F', dark: '#23892E' },
  { base: '#FFC21A', light: '#FFE070', dark: '#C98A00' },
  { base: '#FF8A1F', light: '#FFB866', dark: '#C4580A' },
  { base: '#9B4DFF', light: '#C08BFF', dark: '#6428B8' },
  { base: '#18C6D8', light: '#6DE3EE', dark: '#0E8A99' },
];

export const SKINS: readonly Skin[] = [
  { id: 'skin-1', name: 'Cổ điển', style: 'bevel', colors: CLASSIC },
  {
    id: 'skin-2',
    name: 'Pastel',
    style: 'flower',
    colors: [
      { base: '#8FB8FF', light: '#C4DAFF', dark: '#6A93DB' },
      { base: '#FF9EA8', light: '#FFD0D5', dark: '#D97A85' },
      { base: '#9EE6A6', light: '#D0F5D4', dark: '#76C080' },
      { base: '#FFE28A', light: '#FFF1C4', dark: '#D9BB62' },
      { base: '#FFC08A', light: '#FFE0C4', dark: '#D99A64' },
      { base: '#C7A6FF', light: '#E3D2FF', dark: '#A080DB' },
      { base: '#8FE6EE', light: '#C7F3F6', dark: '#68C0C8' },
    ],
  },
  { id: 'skin-3', name: 'Neon', style: 'neon', colors: CLASSIC },
  {
    id: 'skin-4',
    name: 'Kẹo ngọt',
    style: 'candy',
    colors: [
      { base: '#FF5FA2', light: '#FFB3D4', dark: '#C23A77' },
      { base: '#FF7B54', light: '#FFBFA8', dark: '#C4522E' },
      { base: '#7BD84F', light: '#C2F0A8', dark: '#53A430' },
      { base: '#FFD23F', light: '#FFEA9E', dark: '#C9A11C' },
      { base: '#4FC3F7', light: '#A8E3FB', dark: '#2A92C2' },
      { base: '#B266FF', light: '#DAB3FF', dark: '#8240CC' },
      { base: '#FF9F1C', light: '#FFD08E', dark: '#C97700' },
    ],
  },
  {
    id: 'skin-5',
    name: 'Đá quý',
    style: 'gem',
    colors: [
      { base: '#1F5BFF', light: '#8FB0FF', dark: '#0E2F99' },
      { base: '#E0115F', light: '#FF7FAE', dark: '#8A0636' },
      { base: '#0FA958', light: '#7FE8B0', dark: '#06633A' },
      { base: '#F5B301', light: '#FFE07F', dark: '#9A6F00' },
      { base: '#E36414', light: '#FFB27F', dark: '#8A3A08' },
      { base: '#8E24AA', light: '#D48FEA', dark: '#52126A' },
      { base: '#00B8D4', light: '#8FEAF8', dark: '#006B7D' },
    ],
  },
];

export function rotationBadgeColor(theme: BoardTheme): string {
  switch (theme.tone) {
    case 'dark':
      return '#2FA83C';
    case 'light':
      return '#2F7BFF';
    default:
      return '#000000';
  }
}

export function themeById(id: string): BoardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export const themeName = (id: string) => themeById(id).name;
export const skinName = (id: string) => skinById(id).name;
