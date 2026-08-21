import type { Collector } from './types.ts';
import { hackerNewsCollector } from './hackernews.ts';
import { redditCollector } from './reddit.ts';
import { githubCollector } from './github.ts';
import { arxivCollector } from './arxiv.ts';
import { rssCollector } from './rss.ts';
import { googleNewsCollector } from './googlenews.ts';
import { huggingFaceCollector } from './huggingface.ts';

export const collectors: Collector[] = [
  hackerNewsCollector,
  redditCollector,
  githubCollector,
  arxivCollector,
  rssCollector,
  googleNewsCollector,
  huggingFaceCollector,
];

export const registry = new Map(collectors.map((c) => [c.sourceKey, c]));

export function getCollector(sourceKey: string): Collector | undefined {
  return registry.get(sourceKey);
}