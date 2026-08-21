import type { Collector, ItemDto } from './types.ts';
import { fetchJson } from '../util/fetch.ts';

/** Reddit：公开 search.json，带 User-Agent，免 Key */
export const redditCollector: Collector = {
  sourceKey: 'reddit',

  async search(query) {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=20&sort=new&t=day`;
    const data = (await fetchJson(url)) as { data?: { children?: Array<{ data?: Record<string, unknown> }> } };
    const children = data?.data?.children ?? [];

    return children
      .map((c): ItemDto => {
        const d = c?.data ?? {};
        const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : null;
        const redirect = d.url_overridden_by_dest as string | undefined;
        const author = (d.author as string) || null;
        const selftext = (d.selftext as string) || '';
        return {
          externalId: String(d.name ?? d.id ?? ''),
          title: (d.title as string) || null,
          text: selftext.trim() ? selftext : null,
          url: redirect || permalink || null,
          author,
          authorUrl: author ? `https://www.reddit.com/user/${author}` : null,
          publishedAt: d.created_utc ? new Date((d.created_utc as number) * 1000).toISOString() : null,
          engagement: { score: d.score ?? 0, comments: d.num_comments ?? 0, subreddit: d.subreddit ?? null },
          raw: d,
        };
      })
      .filter((d) => d.externalId);
  },
};