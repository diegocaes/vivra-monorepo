export const Colors = {
  accent: '#174C3C',
  accentDark: '#103C2F',
  accentLight: '#E5EDE1',
  ink: '#14231F',
  muted: '#717773',
  canvas: '#F7F4EE',
  card: '#FFFDFA',
  cardBorder: '#E8E4DC',
  sidebar: '#163E33',
  // Health semantic colors
  good: '#378655',
  warn: '#B77D35',
  bad: '#C25C50',
  sage: '#DCE8D7',
  coral: '#F8DFD8',
  sand: '#F0E1C8',
  sky: '#DCE5E8',
  rose: '#BC665D',
  blue: '#567F94',
  gold: '#B7853C',
  // Extra
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const PetThemeColors: Record<string, string> = {
  orange: '#F97316',
  rose: '#F43F5E',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  teal: '#14B8A6',
  amber: '#F59E0B',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
