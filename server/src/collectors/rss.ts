import type { Collector, ItemDto } from './types.ts';
import type { SourceRow } from '../repositories/types.ts';
import { fetchText } from '../util/fetch.ts';
import { getExtra } from '../util/helpers.ts';
import { parseFeedXml } from '../util/rss.ts';

/** 通用 RSS 聚合源：从 extraJson.feeds 抓取多个 feed */
export const rssCollector: Collector = {
  sourceKey: 'rss',

  async search(query, src: SourceRow) {
    const feeds = (getExtra(src).feeds as string[] | undefined) ?? [];
    const out: ItemDto[] = [];
    for (const feed of feeds) {
      try {
        const xml = await fetchText(feed, {}, 20_000);
        out.push(...parseFeedXml(xml, 'rss', query));
      } catch (err) {
        // 单个 feed 失败不中断
        console.warn(`[rss] feed ${feed} failed: ${(err as Error).message}`);
      }
    }
    return out;
  },
};