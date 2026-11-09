export const Colors = {
  light: {
    background: '#F4F4F1',
    surface: '#FFFFFF',
    surfaceAlt: '#EAEAE5',
    border: '#DCDCD5',
    text: '#16181D',
    textMuted: '#62666F',
    accent: '#D4431A', // brand orange, darkened so white text on it passes WCAG AA
    accentText: '#FFFFFF',
    success: '#167A3C',
    successSoft: '#DDF3E6',
    danger: '#C62F2F',
    record: '#946013',
    recordSoft: '#FBEFD6',
  },
  dark: {
    background: '#0E0F12',
    surface: '#181A1F',
    surfaceAlt: '#23262D',
    border: '#2E323A',
    text: '#F2F3F5',
    textMuted: '#9EA3AD',
    accent: '#FF6A3D',
    accentText: '#1A0B05',
    success: '#4CD388',
    successSoft: '#143323',
    danger: '#FF6B6B',
    record: '#F2B84B',
    recordSoft: '#3A2C10',
  },
} as const;

/** The logo colour. Only for the logo and app icon; UI uses `accent`. */
export const BRAND = '#E8501E';

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Default rest between sets, in seconds. */
export const DEFAULT_REST_SECONDS = 90;

