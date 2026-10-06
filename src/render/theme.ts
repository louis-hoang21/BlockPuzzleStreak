import type { Localized } from '../i18n';

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
  light: { background: '#C6C2DA', tone: 'light' },
  orange: { background: '#C98A52', tone: 'light' },
  pink: { background: '#C486A6', tone: 'light' },
  red: { background: '#A8454B', tone: 'dark' },
} as const satisfies Record<string, { background: string; tone: 'dark' | 'light' }>;

export function hudColors(tone: 'dark' | 'light') {
  return tone === 'light'
    ? { text: '#1B1F3B', textDim: '#4A4F75', accent: '#A34F00' }
    : { text: COLORS.text, textDim: COLORS.textDim, accent: COLORS.accent };
}

export interface BoardTheme {
  id: string;
  name: Localized;
  tone: 'dark' | 'light';
  background: string;
  boardFrame: string;
  boardBg: string;
  emptyCell: string;
  emptyCellStyle: 'plain' | 'sunset' | 'wood';
  frameStyle?: 'wood';
  backdrop?: 'night' | 'forest' | 'ocean' | 'space' | 'kitchen';
}

export const THEMES: readonly BoardTheme[] = [
  {
    id: 'theme-6',
    name: { en: 'Warm Kitchen', vi: 'Bếp ấm' },
    tone: 'light',
    background: '#E9CDA4',
    boardFrame: '#A86A35',
    boardBg: '#4E2F17',
    emptyCell: '#6A4223',
    emptyCellStyle: 'wood',
    frameStyle: 'wood',
    backdrop: 'kitchen',
  },
  {
    id: 'theme-1',
    name: { en: 'Starry Night', vi: 'Đêm sao' },
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
    name: { en: 'Green Forest', vi: 'Rừng xanh' },
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
    name: { en: 'Sunset', vi: 'Hoàng hôn' },
    tone: 'dark',
    background: '#3A1C3F',
    boardFrame: '#9C4A2E',
    boardBg: '#26122B',
    emptyCell: '#4A2552',
    emptyCellStyle: 'sunset',
  },
  {
    id: 'theme-4',
    name: { en: 'Ocean', vi: 'Đại dương' },
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
    name: { en: 'Outer Space', vi: 'Vũ trụ' },
    tone: 'dark',
    background: '#0E1633',
    boardFrame: '#5B3FA8',
    boardBg: '#070B1E',
    emptyCell: '#1B2447',
    emptyCellStyle: 'plain',
    backdrop: 'space',
  },
];

export type BlockStyle = 'bevel' | 'flower' | 'neon' | 'candy' | 'gem' | 'wood' | 'brick' | 'sushi' | 'toast';

export interface Skin {
  id: string;
  name: Localized;
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
  { base: '#FF5FA2', light: '#FF9FC8', dark: '#C23A77' },
  { base: '#2ED8A3', light: '#7FF0CB', dark: '#1B9971' },
  { base: '#5B5BFF', light: '#9A9AFF', dark: '#3434B8' },
  { base: '#B6E61A', light: '#D9F570', dark: '#7FA30A' },
  { base: '#E040FB', light: '#F08CFF', dark: '#9C1FB3' },
  { base: '#A0673A', light: '#C99468', dark: '#6B4122' },
];

export const SKINS: readonly Skin[] = [
  {
    id: 'skin-9',
    name: { en: 'Toast', vi: 'Bánh mì nướng' },
    style: 'toast',
    colors: [
      { base: '#3D6FD1', light: '#7FA2E6', dark: '#26499A' },
      { base: '#D62F3C', light: '#EE7480', dark: '#961B26' },
      { base: '#54A83E', light: '#8ACB78', dark: '#357026' },
      { base: '#F5B800', light: '#FFD95C', dark: '#B08300' },
      { base: '#F07A1A', light: '#F8AB6A', dark: '#B0520A' },
      { base: '#7B3FB8', light: '#A97FDB', dark: '#4F2280' },
      { base: '#1FA6B8', light: '#6CCFDB', dark: '#126F7D' },
      { base: '#E8559A', light: '#F493C1', dark: '#A8336A' },
      { base: '#2AAE7E', light: '#73D2AF', dark: '#187553' },
      { base: '#4A4FC9', light: '#878BE3', dark: '#2D3190' },
      { base: '#9DBF1F', light: '#C8E06A', dark: '#68800E' },
      { base: '#C23AC9', light: '#DE80E3', dark: '#86208C' },
      { base: '#6B3A1F', light: '#9C6845', dark: '#42200E' },
    ],
  },
  { id: 'skin-1', name: { en: 'Classic', vi: 'Cổ điển' }, style: 'bevel', colors: CLASSIC },
  {
    id: 'skin-2',
    name: { en: 'Pastel', vi: 'Pastel' },
    style: 'flower',
    colors: [
      { base: '#619BFF', light: '#96BDFF', dark: '#3C76DB' },
      { base: '#FF707F', light: '#FFA2AC', dark: '#D74E5E' },
      { base: '#73E37F', light: '#A6F1AE', dark: '#4DBB5C' },
      { base: '#FFD75C', light: '#FFE696', dark: '#DAB033' },
      { base: '#FFA75C', light: '#FFC896', dark: '#DA8136' },
      { base: '#AA78FF', light: '#C6A4FF', dark: '#8354D9' },
      { base: '#60E3EF', light: '#9BEEF4', dark: '#3CBAC6' },
      { base: '#FF85CA', light: '#FFAFDC', dark: '#D660A4' },
      { base: '#79EFC6', light: '#AAF7DA', dark: '#55C79E' },
      { base: '#7B7BFF', light: '#A8A8FF', dark: '#5757D9' },
      { base: '#CEF25A', light: '#E3F896', dark: '#A6CA38' },
      { base: '#E878FF', light: '#F0A8FF', dark: '#BF54D9' },
      { base: '#D4A071', light: '#E6C5A4', dark: '#AB7A4E' },
    ],
  },
  {
    id: 'skin-3',
    name: { en: 'Neon', vi: 'Neon' },
    style: 'neon',
    colors: [
      { base: '#2D7DFF', light: '#7FB2FF', dark: '#1447B3' },
      { base: '#FF3131', light: '#FF8080', dark: '#B31414' },
      { base: '#39FF14', light: '#9CFF85', dark: '#1FA308' },
      { base: '#FFEA00', light: '#FFF57F', dark: '#B3A300' },
      { base: '#FF7A00', light: '#FFB366', dark: '#B35500' },
      { base: '#8F3BFF', light: '#C29BFF', dark: '#5A17B3' },
      { base: '#00F0FF', light: '#80F8FF', dark: '#00A3AD' },
      { base: '#FF2E97', light: '#FF8CC6', dark: '#B30F63' },
      { base: '#00FFB3', light: '#80FFD9', dark: '#00B37D' },
      { base: '#4D4DFF', light: '#9999FF', dark: '#2020B3' },
      { base: '#C6FF00', light: '#E2FF80', dark: '#8AB300' },
      { base: '#FF00E5', light: '#FF80F2', dark: '#B300A0' },
      { base: '#D2691E', light: '#F0A56B', dark: '#8A3F0C' },
    ],
  },
  {
    id: 'skin-4',
    name: { en: 'Capsule', vi: 'Viên thuốc' },
    style: 'candy',
    colors: [
      { base: '#FF5FA2', light: '#FFB3D4', dark: '#C23A77' },
      { base: '#FF7B54', light: '#FFBFA8', dark: '#C4522E' },
      { base: '#7BD84F', light: '#C2F0A8', dark: '#53A430' },
      { base: '#FFD23F', light: '#FFEA9E', dark: '#C9A11C' },
      { base: '#4FC3F7', light: '#A8E3FB', dark: '#2A92C2' },
      { base: '#B266FF', light: '#DAB3FF', dark: '#8240CC' },
      { base: '#FF9F1C', light: '#FFD08E', dark: '#C97700' },
      { base: '#3EE6B0', light: '#9FF3D8', dark: '#20A87E' },
      { base: '#6C6CFF', light: '#B3B3FF', dark: '#4040CC' },
      { base: '#C8F03C', light: '#E4F89E', dark: '#94B81A' },
      { base: '#F04DFF', light: '#F8A6FF', dark: '#B024C2' },
      { base: '#FF3B5C', light: '#FF9DAD', dark: '#C21C3A' },
      { base: '#B5703F', light: '#DDAA84', dark: '#7D4520' },
    ],
  },
  {
    id: 'skin-5',
    name: { en: 'Gems', vi: 'Đá quý' },
    style: 'gem',
    colors: [
      { base: '#1F5BFF', light: '#8FB0FF', dark: '#0E2F99' },
      { base: '#E0115F', light: '#FF7FAE', dark: '#8A0636' },
      { base: '#0FA958', light: '#7FE8B0', dark: '#06633A' },
      { base: '#F5B301', light: '#FFE07F', dark: '#9A6F00' },
      { base: '#E36414', light: '#FFB27F', dark: '#8A3A08' },
      { base: '#8E24AA', light: '#D48FEA', dark: '#52126A' },
      { base: '#00B8D4', light: '#8FEAF8', dark: '#006B7D' },
      { base: '#FF4FA0', light: '#FFA8CF', dark: '#A3175C' },
      { base: '#14D9A0', light: '#8AF2D3', dark: '#08805D' },
      { base: '#3A2FD6', light: '#9C95FF', dark: '#1D1680' },
      { base: '#9ACD10', light: '#D4F27F', dark: '#5C7A06' },
      { base: '#D10FBF', light: '#F28AE8', dark: '#7A0670' },
      { base: '#A8551E', light: '#E0A070', dark: '#5E2C0A' },
    ],
  },
  {
    id: 'skin-6',
    name: { en: 'Wood', vi: 'Gỗ' },
    style: 'wood',
    colors: [
      { base: '#4F7FB8', light: '#7FA6D4', dark: '#2E5180' },
      { base: '#B8473A', light: '#D67A6C', dark: '#7D2A20' },
      { base: '#5E9A48', light: '#8DC277', dark: '#3A6629' },
      { base: '#D9A93B', light: '#F0CD78', dark: '#9A7319' },
      { base: '#C8763A', light: '#E5A270', dark: '#8A4A1C' },
      { base: '#7E5BA8', light: '#A98BCC', dark: '#523873' },
      { base: '#3E9EA8', light: '#74C6CE', dark: '#236970' },
      { base: '#C2668A', light: '#DE95B1', dark: '#86405C' },
      { base: '#4FA88A', light: '#82CBB1', dark: '#2E715B' },
      { base: '#5A62A8', light: '#8A90CC', dark: '#363C73' },
      { base: '#9AAE3E', light: '#C2D271', dark: '#66761F' },
      { base: '#A8509E', light: '#CC80C3', dark: '#73306B' },
      { base: '#9C6B3F', light: '#C49567', dark: '#664222' },
    ],
  },
  {
    id: 'skin-7',
    name: { en: 'Brick', vi: 'Gạch' },
    style: 'brick',
    colors: [
      { base: '#3F6FB0', light: '#7099D1', dark: '#24426E' },
      { base: '#B5402F', light: '#D9735F', dark: '#6E2117' },
      { base: '#4E8F3E', light: '#7EBA6B', dark: '#2C5622' },
      { base: '#D4A032', light: '#EECB72', dark: '#86621A' },
      { base: '#CC6A2C', light: '#EA9A63', dark: '#7D3D14' },
      { base: '#7550A3', light: '#A07FC9', dark: '#462E66' },
      { base: '#2F95A0', light: '#66C0C9', dark: '#1A5960' },
      { base: '#BF5A82', light: '#DE8BAB', dark: '#753350' },
      { base: '#3E9E7E', light: '#73C6A9', dark: '#22604B' },
      { base: '#4D55A0', light: '#7F86C9', dark: '#2C3166' },
      { base: '#8FA334', light: '#BACC68', dark: '#56621B' },
      { base: '#A04494', light: '#C977BE', dark: '#62275A' },
      { base: '#8E5A36', light: '#B88460', dark: '#55341C' },
    ],
  },
  {
    id: 'skin-8',
    name: { en: 'Sushi', vi: 'Sushi' },
    style: 'sushi',
    colors: [
      { base: '#3B7BE0', light: '#7FAAF0', dark: '#2253A3' },
      { base: '#E8483A', light: '#F5897E', dark: '#A82A20' },
      { base: '#5CB84A', light: '#94D987', dark: '#3A7F2D' },
      { base: '#F2C230', light: '#F8DD82', dark: '#B08A12' },
      { base: '#FF8A3D', light: '#FFB884', dark: '#C25A1A' },
      { base: '#8E55D9', light: '#B98EEC', dark: '#5E3299' },
      { base: '#2BB6C4', light: '#77D6DF', dark: '#1A7D87' },
      { base: '#F06A9A', light: '#F7A4C2', dark: '#B0436C' },
      { base: '#36C291', light: '#7DDDBB', dark: '#218763' },
      { base: '#5A5FE0', light: '#9396EE', dark: '#373BA3' },
      { base: '#A8CC2E', light: '#CDE57A', dark: '#728C16' },
      { base: '#D14FD9', light: '#E58FEA', dark: '#932F99' },
      { base: '#B07A4A', light: '#D2A77E', dark: '#774E2A' },
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
