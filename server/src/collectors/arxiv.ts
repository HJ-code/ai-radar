import { XMLParser } from 'fast-xml-parser';
import type { Collector, ItemDto } from './types.ts';
import { fetchText } from '../util/fetch.ts';
import { cleanWs, toIsoOrNull } from '../util/helpers.ts';

/** arXiv：Atom API，按提交时间排序 */
export const arxivCollector: Collector = {
  sourceKey: 'arxiv',

  async search(query) {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:"${query}"`)}&sortBy=submittedDate&sortOrder=descending&max_results=15`;
    const xml = await fetchText(url, {}, 30_000);
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = (await parser.parse(xml)) as { feed?: { entry?: unknown | unknown[] } };

    const entries = doc.feed?.entry ?? [];
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

    return list
      .flatMap((e): ItemDto[] => {
        const entry = e as Record<string, unknown>;
        const id = cleanWs((entry.id as string) ?? '') ?? '';
        if (!id) return [];
        const title = cleanWs(Array.isArray(entry.title) ? entry.title.join('') : (entry.title as string)) ?? '';
        const summary = cleanWs(Array.isArray(entry.summary) ? entry.summary.join('') : (entry.summary as string)) ?? '';
        const authorNode = entry.author as { name?: string } | Array<{ name?: string }> | undefined;
        const authors = (
          Array.isArray(authorNode)
            ? authorNode.map((a) => (a?.name as string) || '').filter(Boolean)
            : authorNode?.name
              ? [authorNode.name as string]
              : []
        );
        return [
          {
            externalId: id,
            title: title || null,
            text: summary ? summary.slice(0, 800) : null,
            url: id,
            author: authors[0] ?? null,
            authorUrl: authors[0] ? null : null,
            publishedAt: toIsoOrNull((entry.published as string) ?? (entry.updated as string)),
            engagement: { authors: authors.slice(0, 5) },
            raw: entry,
          },
        ];
      });
  },
};