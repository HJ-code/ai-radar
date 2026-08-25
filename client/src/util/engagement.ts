/** 各交互型源互动字段 → 中文展示标签；资讯型（rss）不在表内 → 不显示假热度 */
export const SOURCE_ENGAGEMENT_LABELS: Record<string, Record<string, string>> = {
  hackernews: { points: '分', comments: '评论' },
  github: { stars: '星', forks: '岔' },
  bilibili: { view: '播放', like: '赞', reply: '回复', danmaku: '弹幕' },
  reddit: { score: '分', comments: '评论' },
  huggingface: { downloads: '下载', likes: '赞' },
};

/** 互动量中文缩写：1.2w / 3.4k / 500 */
export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, '')}w`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}