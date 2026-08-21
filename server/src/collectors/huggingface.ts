import type { Collector, ItemDto } from './types.ts';
import { fetchJson } from '../util/fetch.ts';
import { cleanWs, toIsoOrNull } from '../util/helpers.ts';

/** Hugging Face：热门模型榜（免费），本地按关键词过滤 */
export const huggingFaceCollector: Collector = {
  sourceKey: 'huggingface',

  async search(query) {
    const url = 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=25';
    const data = (await fetchJson(url, {}, 20_000)) as Array<Record<string, unknown>> | undefined;
    const models = Array.isArray(data) ? data : [];
    const q = query.toLowerCase();

    return models
      .filter((m) => {
        const id = String(m.id ?? m.modelId ?? '');
        const pipeline = String(m.pipeline_tag ?? '');
        const desc = String(m.description ?? '');
        return !q || id.toLowerCase().includes(q) || pipeline.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      })
      .map((m): ItemDto => {
        const id = String(m.id ?? m.modelId ?? '');
        const org = id.split('/')[0] ?? null;
        return {
          externalId: id,
          title: id,
          text: cleanWs(String(m.description ?? ''))?.slice(0, 300),
          url: `https://huggingface.co/${id}`,
          author: org,
          authorUrl: org ? `https://huggingface.co/${org}` : null,
          publishedAt: toIsoOrNull(m.createdAt as string | null),
          engagement: {
            downloads: m.downloads ?? 0,
            likes: m.likes ?? 0,
            pipeline: m.pipeline_tag ?? null,
          },
          raw: m,
        };
      })
      .filter((d) => d.externalId);
  },
};