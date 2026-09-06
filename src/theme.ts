export const colors = {
  primary: '#0A66C2',
  primaryDark: '#0B4F94',
  /** 壁纸取出的浅色容器色（卡片/大区块底），无动态取色时回退为 surface */
  surfaceContainer: '#F5F7FA',
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

/**
 * 启动取色诊断状态：`ok:色值` 表示已应用动态色，其余为失败原因串。
 * 仅用于排查动态取色未生效，问题解决后移除。
 */
export const themeInitDiagnostics = { state: 'pending' };

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

function toRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mixWithWhite(hex: string, ratio: number): string {
  const [r, g, b] = toRgb(hex);
  const t = (v: number) => Math.round(v + (255 - v) * ratio);
  return `#${((1 << 24) | (t(r) << 16) | (t(g) << 8) | t(b)).toString(16).slice(1).toUpperCase()}`;
}

/** 将给定色抬升到目标亮度，得到同色相的浅色容器色 */
function lightenTo(hex: string, target: number): string {
  const L = luminance(hex);
  if (L >= target) return hex;
  const ratio = (target - L) / (1 - L);
  return mixWithWhite(hex, ratio);
}

const deepTones = ['500', '600', '700', '800', '900'];
const lightTones = ['300', '400', '500'];

function pick(accent: Record<string, string>, bucket: string, tone: string): string | undefined {
  return accent[`${bucket}_${tone}`];
}

/**
 * 应用 Material You 动态主题。accent 结构为扁平键：a1_500 / a2_500 / n1_500 / n2_500
 *（a1=主强调色 accent1，a2=次级强调色 accent2，n1/n2=中性色 neutral1/neutral2，tone 300-900）
 * 无动态取色（低版本/失败）时保持默认品牌色，界面观感不变。
 */
export function applyDynamicTheme(accent: Record<string, string>): void {
  const a1Available = deepTones.filter((t) => pick(accent, 'a1', t));

  // 主强调色：取亮度足够的深色 tone，保证白字可读；与默认品牌蓝同深度偏好
  const primaryTone = a1Available.find((t) => luminance(pick(accent, 'a1', t)!) <= 0.18) ?? a1Available[a1Available.length - 1];
  if (primaryTone) {
    colors.primary = accent[`a1_${primaryTone}`];
    const darkerTones = deepTones.slice(deepTones.indexOf(primaryTone) + 1);
    const darker = darkerTones.find((t) => accent[`a1_${t}`] !== colors.primary) ?? a1Available[a1Available.length - 1];
    if (darker) colors.primaryDark = accent[`a1_${darker}`];
  }

  // 浅色容器色：以 accent1 最浅可用 tone 抬高亮度，得到铺满卡片/大区块的壁纸同色系浅色
  const containerBase =
    lightTones.map((t) => pick(accent, 'a1', t)).find((v): v is string => !!v) ??
    colors.primary;
  colors.surfaceContainer = lightenTo(containerBase, 0.86);
}
