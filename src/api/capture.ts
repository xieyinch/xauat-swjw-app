import { Directory, File, Paths } from 'expo-file-system';
import { webFetch } from './bridge';
import type { MenuCategory } from '../types';

export interface CapturePage {
  title: string;
  href: string;
  html: string;
  ok: boolean;
  error?: string;
}

export interface CaptureResult {
  fileUri: string;
  ok: number;
  failed: number;
}

function flatten(menu: MenuCategory[]): { title: string; href: string }[] {
  const out: { title: string; href: string }[] = [];
  for (const cat of menu) {
    for (const fn of cat.functions ?? []) {
      if (fn.href) out.push({ title: fn.title, href: fn.href });
    }
  }
  return out;
}

/**
 * 登录后批量抓取「全部」所有功能页的原始 HTML，汇总成一个 JSON 文件，
 * 供开发者解析页面结构与数据接口，用于原生页面重构。
 */
export async function captureAllPages(
  menu: MenuCategory[],
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<CaptureResult> {
  const pages = flatten(menu);
  const results: CapturePage[] = [];
  let ok = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    onProgress?.(i + 1, pages.length, p.title);
    try {
      const html = await webFetch(p.href);
      results.push({ title: p.title, href: p.href, html, ok: true });
      ok++;
    } catch (e) {
      results.push({
        title: p.title,
        href: p.href,
        html: '',
        ok: false,
        error: String((e as Error).message || e),
      });
    }
  }
  const dir = new Directory(Paths.document, 'capture');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, `capture_${Date.now()}.json`);
  file.create({ overwrite: true });
  file.write(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      base: 'https://swjw.xauat.edu.cn',
      pages: results,
    }),
  );
  return { fileUri: file.uri, ok, failed: pages.length - ok };
}
