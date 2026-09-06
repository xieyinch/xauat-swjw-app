export const colors = {
  primary: '#0A66C2',
  primaryDark: '#0B4F94',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  text: '#1F2329',
  textSecondary: '#8A919F',
  border: '#E5E8EC',
  danger: '#D92D20',
  success: '#12B76A',
  warning: '#F59E0B',
  overlay: 'rgba(0,0,0,0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

/** 从 Material You 动态色板中挑选适合白字/浅底主色的深色强调色 */
export function applyDynamicTheme(accent: Record<string, string>): void {
  const tones = ['500', '600', '700', '800', '900'];
  const available = tones.filter((t) => accent[t]);
  const primary = available.find((t) => luminance(accent[t]) <= 0.18) ?? available[available.length - 1];
  if (primary) colors.primary = accent[primary];
  const darkerIdx = available.indexOf(primary) + 1;
  const darker = available.slice(darkerIdx).find((t) => accent[t] !== colors.primary) ?? available[available.length - 1];
  if (darker) colors.primaryDark = accent[darker];
}
