import type { Collector, ItemDto } from './types.ts';
import type { SourceRow } from '../repositories/types.ts';
import { fetchJson } from '../util/fetch.ts';
import { getExtra } from '../util/helpers.ts';

/** GitHub：全站仓库搜索（近 7 天新仓库 + 星量门槛），可配 Token；minStars 默认 500，可在源配置调低 */
export const githubCollector: Collector = {
  sourceKey: 'github',

  async search(query, src: SourceRow) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const limit = Number(getExtra(src).limit ?? 10);
    const minStars = Number(getExtra(src).minStars ?? 500);
    const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
    if (src.apiKey) headers.authorization = `Bearer ${src.apiKey}`;

    const q = `${query} created:>${since} stars:>${minStars}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`;
    const data = (await fetchJson(url, { headers })) as { items?: Array<Record<string, unknown>> };
    const items = (Array.isArray(data?.items) ? (data.items as Array<Record<string, unknown>>) : []).filter(
      // 无简介的仓库多为 AI 自动生成刷仓库，直接丢弃
      (r) => typeof r.description === 'string' && (r.description as string).trim().length > 0,
    );

    return items.map((r): ItemDto => {
      const owner = (r.owner as Record<string, unknown> | undefined) ?? {};
      return {
        externalId: String(r.id ?? ''),
        title: (r.full_name as string) || null,
        text: (r.description as string) || null,
        url: (r.html_url as string) || null,
        author: (owner.login as string) || null,
        authorUrl: (owner.html_url as string) || null,
        publishedAt: (r.created_at as string) || null,
        engagement: {
          stars: r.stargazers_count ?? 0,
          forks: r.forks_count ?? 0,
          language: r.language ?? null,
        },
        raw: r,
      };
    });
  },
};