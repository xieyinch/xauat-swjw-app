import { fetch } from 'expo/fetch';
import { DomUtils, ElementType, parseDocument } from 'htmlparser2';
import { ANDROID_CHROME_USER_AGENT, SITE } from '../config/site';

export type NoticeBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt: string }
  | { type: 'table'; rows: string[][] };

type NoticeLink = { url: string; title: string };
type NoticeDetail = { blocks: NoticeBlock[]; links: NoticeLink[] };

function webUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const blockTags = new Set(['p', 'div', 'section', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'tr']);
const cleanText = (text: string) => text.replace(/[\n\t\r ]+/g, ' ').trim();

export function parseNoticeDetail(html: string, sourceUrl: string): NoticeDetail {
  const dom = parseDocument(html);
  const article = DomUtils.findOne(element => element.attribs.id === 'vsb_content', dom.children)
    ?? DomUtils.findOne(element => element.name === 'article' || element.attribs.class?.split(/\s+/).includes('v_news_content'), dom.children);
  if (!article) throw new Error('暂时无法读取公告正文');

  const blocks: NoticeBlock[] = [];
  const links = new Map<string, NoticeLink>();
  let text = '';
  function flush() {
    const content = cleanText(text);
    if (content) blocks.push({ type: 'text', text: content });
    text = '';
  }
  function addLink(value: string, title: string) {
    const url = webUrl(value, sourceUrl);
    if (url && !links.has(url)) links.set(url, { url, title: cleanText(title) || url });
  }

  function visit(node: NonNullable<typeof article>['children'][number]) {
    if (node.type === ElementType.Text) {
      text += node.data;
      return;
    }
    if (node.type !== ElementType.Tag && node.type !== ElementType.Script && node.type !== ElementType.Style) return;
    if (node.name === 'script') {
      // Some school announcements define the public PDF via the portal's inline viewer.
      // Read only its literal URL, without executing the script.
      const script = DomUtils.textContent(node.children);
      const pdf = script.match(/\bshowVsbpdfIframe\(\s*["']([^"']+)["']/)?.[1];
      if (pdf?.startsWith('/system/resource/virtual_resource_file.jsp?')) addLink(pdf, '查看公告原文 PDF');
      return;
    }
    if (node.name === 'style' || node.name === 'noscript') return;
    if (node.name === 'br') { flush(); return; }

    if (node.name === 'img') {
      flush();
      const url = webUrl(node.attribs.src ?? '', sourceUrl);
      if (node.attribs.src && url) blocks.push({ type: 'image', url, alt: node.attribs.alt || '公告图片' });
      return;
    }
    if (node.name === 'iframe' && node.attribs.src) {
      addLink(node.attribs.src, node.attribs.title || '打开公告内嵌文件');
      return;
    }
    if (node.name === 'table') {
      flush();
      const rows = DomUtils.findAll(child => child.name === 'tr', node.children)
        .map(row => row.children.filter(cell => 'name' in cell && (cell.name === 'th' || cell.name === 'td'))
          .map(cell => cleanText(DomUtils.textContent(cell))))
        .filter(row => row.length);
      if (rows.length) blocks.push({ type: 'table', rows });
      for (const link of DomUtils.findAll(child => child.name === 'a' && Boolean(child.attribs.href), node.children)) {
        addLink(link.attribs.href, DomUtils.textContent(link));
      }
      return;
    }
    if (node.name === 'a' && node.attribs.href && !node.attribs.href.startsWith('#')) {
      addLink(node.attribs.href, DomUtils.textContent(node));
    }
    if (blockTags.has(node.name)) flush();
    node.children.forEach(visit);
    if (blockTags.has(node.name)) flush();
  }

  article.children.forEach(visit);
  flush();
  const articleWrapper = article.parent && article.parent.type === ElementType.Tag && article.parent.attribs.class?.split(/\s+/).includes('contt_zhwen')
    ? article.parent : article;
  for (const attachment of DomUtils.findAll(node => node.name === 'a' && node.attribs.href?.includes('news.DownloadAttachUrl'), articleWrapper.children)) {
    addLink(attachment.attribs.href, DomUtils.textContent(attachment));
  }
  if (!blocks.length && !links.size) throw new Error('公告暂时没有可显示的正文');
  return { blocks, links: [...links.values()] };
}

export async function fetchNoticeDetail(url: string) {
  if (new URL(url).origin !== SITE.noticeBase) throw new Error('该公告位于外部网站');
  const response = await fetch(url, {
    headers: { 'User-Agent': ANDROID_CHROME_USER_AGENT },
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || new URL(response.url || url).origin !== SITE.noticeBase) throw new Error('无法读取公告正文');
  return parseNoticeDetail(await response.text(), response.url || url);
}
