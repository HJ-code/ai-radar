import type { Collector, ItemDto } from './types.ts';
import type { SourceRow } from '../repositories/types.ts';
import { fetchJson } from '../util/fetch.ts';
import { getExtra } from '../util/helpers.ts';
import { toIsoOrNull } from '../util/helpers.ts';

interface BVideo {
  bvid?: string;
  aid?: number;
  title?: string;
  desc?: string;
  tname?: string;
  pubdate?: number;
  owner?: { mid?: number; name?: string; face?: string };
  stat?: { view?: number; like?: number; reply?: number; danmaku?: number };
  pic?: string;
}

/** 拉取一个公开 JSON API 端点的视频列表并归一化；bvid 缺失时退用 aid 兜底 */
function videosFrom(data: unknown, sourceKey: string): ItemDto[] {
  const list = (data as { data?: { list?: unknown[] } })?.data?.list;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw): ItemDto => {
      const v = (raw ?? {}) as BVideo;
      const owner = v.owner ?? {};
      const bvid = String(v.bvid ?? '');
      const aid = v.aid ? String(v.aid) : '';
      return {
        externalId: bvid || aid,
        title: v.title || null,
        text: v.desc || null,
        url: bvid ? `https://www.bilibili.com/video/${bvid}` : aid ? `https://www.bilibili.com/video/av${aid}` : null,
        author: owner.name || null,
        authorUrl: owner.mid ? `https://space.bilibili.com/${owner.mid}` : null,
        publishedAt: toIsoOrNull(v.pubdate),
        engagement: {
          view: v.stat?.view ?? 0,
          like: v.stat?.like ?? 0,
          reply: v.stat?.reply ?? 0,
          danmaku: v.stat?.danmaku ?? 0,
          category: v.tname ?? null,
        },
        raw: v,
      };
    })
    .filter((d) => d.externalId);
}

/** B 站：科技分区榜（rid 可配，默认 188 科技），公开 JSON API 免 Key；整库型一次拉全部 */
export const bilibiliCollector: Collector = {
  sourceKey: 'bilibili',
  wholeList: true,

  async search(_query, src: SourceRow) {
    const rid = Number(getExtra(src).rid ?? 188);
    const limit = Number(getExtra(src).limit ?? 20);
    // B站风控拒绝非浏览器 UA（-352），必须用浏览器头
    const headers = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };
    const ranking = await fetchJson(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}`, { headers });
    // 只取分区榜本身；个别分区偶尔返回空/风控 -352 时就把内容交给其他源，宁可少不掺全站热门噪音
    return videosFrom(ranking, 'bilibili').slice(0, limit);
  },
};