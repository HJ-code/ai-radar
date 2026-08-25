import { createHash } from 'node:crypto';
import type { Collector, ItemDto } from './types.ts';
import type { SourceRow } from '../repositories/types.ts';
import { fetchJson } from '../util/fetch.ts';
import { getExtra, toIsoOrNull } from '../util/helpers.ts';

/** B站匿名访问也要求浏览器 UA，否则返回 -352 风控 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 默认搜索词：只搜这些 AI 相关词（reports 统计 ac 无关词会浪费请求频率） */
const DEFAULT_KEYWORDS = ['GPT', 'Claude', 'DeepSeek', 'OpenAI', 'Gemini', '大模型'];

/** B站 wbi 签名打乱表（img_key+sub_key 拼成 64 位后按此表取 32 位作 mixinKey） */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

/** spi 设备 cookie 与 nav wbi keys 都缓存几小时，请求一次足够一轮采集 */
const CACHE_MS = 6 * 60 * 60 * 1000;

interface BiliSearchItem {
  bvid?: string;
  aid?: number;
  title?: string;
  description?: string;
  author?: string;
  mid?: number;
  pubdate?: number;
  typename?: string;
  play?: number;
  like?: number;
  review?: number;
  video_review?: number;
  arcurl?: string;
}

let buvidCache: { b3: string; b4: string; ts: number } | null = null;
let wbiCache: { imgKey: string; subKey: string; ts: number } | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 匿名设备 cookie（buvid3/buvid4）：先于任何搜索请求建立，显著降低搜索接口风控 */
async function getBuvid(): Promise<{ b3: string; b4: string }> {
  if (buvidCache && Date.now() - buvidCache.ts < CACHE_MS) return buvidCache;
  const spi = (await fetchJson('https://api.bilibili.com/x/frontend/finger/spi', { headers: { 'user-agent': UA } })) as {
    data?: { b_3?: string; b_4?: string };
  };
  const b3 = spi?.data?.b_3 ?? '';
  const b4 = spi?.data?.b_4 ?? '';
  if (!b3) throw new Error('B站 spi 接口未返回设备 cookie');
  buvidCache = { b3, b4, ts: Date.now() };
  return buvidCache;
}

/** 从 nav 接口换取 wbi 签名用 img/sub key */
async function getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  if (wbiCache && Date.now() - wbiCache.ts < CACHE_MS) return wbiCache;
  const nav = (await fetchJson('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/' },
  })) as { data?: { wbi_img?: { img_url?: string; sub_url?: string } } };
  const pick = (u: string | undefined): string => (u ?? '').split('/').pop()?.split('.')[0] ?? '';
  const imgKey = pick(nav?.data?.wbi_img?.img_url);
  const subKey = pick(nav?.data?.wbi_img?.sub_url);
  if (!imgKey || !subKey) throw new Error('B站 nav 接口未返回 wbi keys');
  wbiCache = { imgKey, subKey, ts: Date.now() };
  return wbiCache;
}

function mixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join('').slice(0, 32);
}

/** wbi 签名：参数按 key 排序、URL 编码拼串 + mixinKey 做 md5，得到 w_rid */
function signedQuery(params: Record<string, string | number>, keys: { imgKey: string; subKey: string }): string {
  const p: Record<string, string | number> = { ...params, wts: Math.floor(Date.now() / 1000) };
  const mixed = mixinKey(keys.imgKey + keys.subKey);
  const qs = Object.keys(p)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(p[k]))}`)
    .join('&');
  const w_rid = createHash('md5').update(qs + mixed).digest('hex');
  return `${qs}&w_rid=${w_rid}`;
}

function stripTags(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return t || null;
}

function fromSearchItem(raw: unknown): ItemDto | null {
  const v = (raw ?? {}) as BiliSearchItem;
  const bvid = v.bvid ?? '';
  const aid = v.aid ? String(v.aid) : '';
  const id = bvid || aid;
  if (!id) return null;
  return {
    externalId: id,
    title: stripTags(v.title),
    text: stripTags(v.description),
    url: bvid ? `https://www.bilibili.com/video/${bvid}` : v.arcurl ? v.arcurl.replace(/^http:/, 'https:') : null,
    author: v.author || null,
    authorUrl: v.mid ? `https://space.bilibili.com/${v.mid}` : null,
    publishedAt: toIsoOrNull(v.pubdate),
    engagement: {
      view: v.play ?? 0,
      like: v.like ?? 0,
      reply: v.review ?? 0,
      danmaku: v.video_review ?? 0,
      category: v.typename ?? null,
    },
    raw: v,
  };
}

/** 按关键词搜视频：优先 wbi 签名接口；遇风控（data.v_voucher 而非 result）自动降级普通 search/type */
async function searchKeyword(kw: string): Promise<ItemDto[]> {
  const { b3, b4 } = await getBuvid();
  const headers = {
    'user-agent': UA,
    referer: 'https://www.bilibili.com/',
    cookie: `buvid3=${b3}; buvid4=${b4}`,
  };
  let j: { code?: number; data?: { result?: unknown[] } } | null = null;
  try {
    const keys = await getWbiKeys();
    const target = `https://api.bilibili.com/x/web-interface/wbi/search/type?${signedQuery(
      { search_type: 'video', keyword: kw },
      keys,
    )}`;
    j = (await fetchJson(target, { headers })) as { code?: number; data?: { result?: unknown[] } };
    if (!Array.isArray(j?.data?.result)) j = null;
  } catch {
    j = null;
  }
  if (!j) {
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}`;
    j = (await fetchJson(url, { headers })) as { code?: number; data?: { result?: unknown[] } };
  }
  if (j?.code !== 0) throw new Error(`搜索「${kw}」失败 code=${j.code}`);
  const list = Array.isArray(j.data?.result) ? (j.data.result as unknown[]) : [];
  return list.map(fromSearchItem).filter((d): d is ItemDto => d !== null);
}

/** B 站：按启用 AI 关键词搜视频，公开 JSON API 免登录；整库型一次拉全部，实时数据 */
export const bilibiliCollector: Collector = {
  sourceKey: 'bilibili',
  wholeList: true,

  async search(_query, src: SourceRow) {
    const extra = getExtra(src);
    const kwsRaw = extra.searchKeywords;
    const keywords = Array.isArray(kwsRaw)
      ? kwsRaw.map(String).map((s) => s.trim()).filter(Boolean)
      : DEFAULT_KEYWORDS;
    if (keywords.length === 0) return [];
    const perLimit = Math.max(1, Math.min(50, Number(extra.searchLimit ?? 10)));
    const totalLimit = Math.max(1, Math.min(100, Number(extra.totalLimit ?? 60)));
    const throttleMs = Math.max(0, Number(extra.searchThrottleMs ?? 6000)) || 0;

    const seen = new Set<string>();
    const out: ItemDto[] = [];
    const errors: string[] = [];
    for (let i = 0; i < keywords.length; i += 1) {
      const kw = keywords[i];
      try {
        const items = await searchKeyword(kw);
        for (const it of items.slice(0, perLimit)) {
          if (it.externalId && !seen.has(it.externalId)) {
            seen.add(it.externalId);
            out.push(it);
          }
        }
      } catch (err) {
        errors.push(`${kw}: ${(err as Error).message}`);
      }
      if (throttleMs > 0 && i < keywords.length - 1) await sleep(throttleMs);
    }
    const result = out.slice(0, totalLimit);
    // 一个词都没搜到才报错（让 runner 记到源错误）；部分词失败不中断
    if (result.length === 0 && errors.length > 0) throw new Error(errors.join('; '));
    return result;
  },
};