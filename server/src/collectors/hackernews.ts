import type { Collector, ItemDto } from './types.ts';
import { fetchJson } from '../util/fetch.ts';
import { toIsoOrNull } from '../util/helpers.ts';

/** Hacker News：Algolia Search API，免 Key */
export const hackerNewsCollector: Collector = {
  sourceKey: 'hackernews',

  async search(query) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
    const data = (await fetchJson(url)) as { hits?: unknown[] };
    const hits = Array.isArray(data?.hits) ? (data.hits as Record<string, unknown>[]) : [];

    return hits
      .map((h): ItemDto => {
        const oid = String(h.objectID ?? h.id ?? '');
        const url = (h.url as string) || (oid ? `https://news.ycombinator.com/item?id=${oid}` : '');
        const author = (h.author as string) || null;
        return {
          externalId: oid,
          title: (h.title as string) || null,
          text: (h.story_text as string) || null,
          url: url || null,
          author,
          authorUrl: author ? `https://news.ycombinator.com/user?id=${author}` : null,
          publishedAt: toIsoOrNull(h.created_at as string | null),
          engagement: { points: h.points ?? 0, comments: h.num_comments ?? 0 },
          raw: h,
        };
      })
      .filter((d) => d.externalId);
  },
};