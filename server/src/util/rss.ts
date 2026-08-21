import { XMLParser } from 'fast-xml-parser';
import type { ItemDto } from '../collectors/types.ts';
import { cleanWs, toIsoOrNull } from './helpers.ts';

/** 取文本内容（#text 优先） */
function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join('');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['#text'] === 'string') return o['#text'];
    if (typeof o['@_href'] === 'string') return o['@_href'];
  }
  return '';
}

/** 取链接（@_href 优先） */
function asHref(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const h = asHref(x);
      if (h) return h;
    }
    return '';
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['@_href'] === 'string') return o['@_href'];
    if (typeof o['#text'] === 'string') return o['#text'];
  }
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleOf(v: unknown): string | null {
  return cleanWs(asText(v)) || null;
}

/** 解析 RSS 2.0 或 Atom，返回归一化条目 */
export function parseFeedXml(xml: string, sourceKey: string, query: string): ItemDto[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const out: ItemDto[] = [];

  // RSS 2.0: rss.channel.item[]
  const channel = (doc.rss as { channel?: unknown } | undefined)?.channel as Record<string, unknown> | undefined;
  if (channel?.item) {
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    for (const raw of items as Array<Record<string, unknown>>) {
      const link = cleanWs(asHref(raw.link)) ?? '';
      const guid = cleanWs(asText(raw.guid)) ?? '';
      const creatorRaw = (raw['dc:creator'] ?? raw.creator) as unknown;
      const author = cleanWs(asText(creatorRaw));
      out.push({
        externalId: guid || link,
        title: titleOf(raw.title),
        text: cleanWs(stripHtml(asText(raw.description))) || null,
        url: link || null,
        author: author || null,
        authorUrl: null,
        publishedAt: toIsoOrNull(asText(raw.pubDate)),
        engagement: { source: titleOf(channel.title) },
        raw,
      });
    }
    return out.filter((i) => i.externalId);
  }

  // Atom: feed.entry[]
  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed?.entry) {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    for (const raw of entries as Array<Record<string, unknown>>) {
      const link = cleanWs(asHref(raw.link)) ?? '';
      const id = cleanWs(asText(raw.id)) ?? '';
      const authorNode = raw.author as { name?: unknown } | Array<{ name?: unknown }> | undefined;
      const author = Array.isArray(authorNode)
        ? cleanWs(asText(authorNode[0]?.name))
        : cleanWs(asText(authorNode?.name));
      out.push({
        externalId: id || link,
        title: titleOf(raw.title),
        text: cleanWs(stripHtml(asText(raw.summary ?? raw.content))) || null,
        url: link || null,
        author: author || null,
        authorUrl: null,
        publishedAt: toIsoOrNull(asText(raw.published ?? raw.updated)),
        engagement: { source: titleOf(feed.title) },
        raw,
      });
    }
    return out.filter((i) => i.externalId);
  }

  return out;
}