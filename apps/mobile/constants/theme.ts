export const Colors = {
  accent: '#F97316',
  accentDark: '#EA580C',
  accentLight: '#FFF7ED',
  ink: '#0F1117',
  muted: '#6B7280',
  canvas: '#F7F8FA',
  card: '#FFFFFF',
  cardBorder: '#EAECF0',
  sidebar: '#13161C',
  // Health semantic colors
  good: '#22C55E',
  warn: '#F59E0B',
  bad: '#EF4444',
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
  md: 12,
  lg: 16,
  xl: 20,
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
