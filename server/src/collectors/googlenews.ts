import type { Collector, ItemDto } from './types.ts';
import { fetchText } from '../util/fetch.ts';
import { parseFeedXml } from '../util/rss.ts';

/** Google News：RSS 关键字搜索（中文结果） */
export const googleNewsCollector: Collector = {
  sourceKey: 'googlenews',

  async search(query) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    const xml = await fetchText(url, {}, 20_000);
    return parseFeedXml(xml, 'googlenews', query);
  },
};