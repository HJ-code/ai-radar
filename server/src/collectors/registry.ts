import type { Collector } from './types.ts';
import { hackerNewsCollector } from './hackernews.ts';
import { redditCollector } from './reddit.ts';
import { githubCollector } from './github.ts';
import { rssCollector } from './rss.ts';
import { googleNewsCollector } from './googlenews.ts';
import { huggingFaceCollector } from './huggingface.ts';
import { bilibiliCollector } from './bilibili.ts';

export const collectors: Collector[] = [
  hackerNewsCollector,
  redditCollector,
  githubCollector,
  rssCollector,
  googleNewsCollector,
  huggingFaceCollector,
  bilibiliCollector,
];

export const registry = new Map(collectors.map((c) => [c.sourceKey, c]));

export function getCollector(sourceKey: string): Collector | undefined {
  return registry.get(sourceKey);
}