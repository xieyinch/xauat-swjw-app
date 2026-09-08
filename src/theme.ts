export const colors = {
  primary: '#A4623F',
  primaryDark: '#79472E',
  primarySoft: '#F2DDC9',
  primaryWash: 'rgba(246,220,193,0.45)',
  primaryBorder: 'rgba(255,255,255,0.8)',
  background: '#F7EBDD',
  surface: 'rgba(255,251,242,0.7)',
  surfaceContainer: 'rgba(255,247,236,0.78)',
  surfaceTranslucent: 'rgba(255,254,251,0.62)',
  glass: 'rgba(255,255,255,0.56)',
  text: '#3B2D25',
  textSecondary: '#806B5D',
  border: 'rgba(177,132,94,0.22)',
  borderStrong: '#B9B7AD',
  muted: '#ECE9E0',
  secondary: '#EBE7DC',
  danger: '#C44F3C',
  success: '#667F68',
  successSoft: '#E1ECE1',
  warning: '#B78A31',
  gold: '#B49347',
  terracotta: '#C46742',
  terracottaSoft: '#F4E4D9',
  heroGlow: 'rgba(255,255,255,0.38)',
  heroGlowSoft: 'rgba(180,147,71,0.16)',
  overlay: 'rgba(34,35,30,0.48)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const themeInitDiagnostics = { state: 'pending' };

/** Keep the upstream Material You bridge compatible with the warm theme. */
export function applyDynamicTheme(accent: Record<string, string>): void {
  const primary = accent.a1_600 || accent.a1_700 || accent.a1_500;
  const dark = accent.a1_800 || accent.a1_700 || primary;
  if (primary) colors.primary = primary;
  if (dark) colors.primaryDark = dark;
  if (accent.a1_300) colors.surfaceContainer = accent.a1_300;
}
