import type {
  AiSystem, AlertLog, CollectResult, Health, HotspotPage, HotspotView, Keyword, Range, Source, Stats,
} from '../types.ts';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const getHealth = () => api<Health>('/api/health');
export const getStats = () => api<Stats>('/api/stats');

/** 由视图 + 游标拼热点流请求；before 由上一页 next 传入 */
export function getHotspots(view: HotspotView, limit = 30, before?: string | null) {
  const p = new URLSearchParams({ limit: String(limit) });
  p.set('sort', view.sort);
  p.set('order', view.order);
  if (view.sources.length) p.set('source', view.sources.join(','));
  if (view.range) p.set('range', view.range);
  if (view.statuses.length) p.set('status', view.statuses.join(','));
  if (view.windowMin != null && view.windowMin > 0) {
    p.set('since', new Date(Date.now() - view.windowMin * 60_000).toISOString());
  }
  if (view.type) p.set('type', view.type);
  if (view.relevanceMin != null) p.set('relevanceMin', String(view.relevanceMin));
  if (view.scoreMin != null) p.set('scoreMin', String(view.scoreMin));
  if (view.q.trim()) p.set('q', view.q.trim());
  if (before) p.set('before', before);
  return api<HotspotPage>(`/api/hotspots?${p.toString()}`);
}
export const getSources = () => api<Source[]>('/api/sources');
export const getKeywords = () => api<Keyword[]>('/api/keywords');
export const getRanges = () => api<Range[]>('/api/ranges');
export const getAiSystem = () => api<AiSystem>('/api/system/ai');
export const setAiEnabled = (enabled: boolean) =>
  api<{ ok: boolean; enabled: boolean } & AiSystem>('/api/system/ai/enabled', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
export const getAlerts = (limit = 30) => api<AlertLog[]>(`/api/alerts?limit=${limit}`);
export const testNotify = () =>
  api<{ ok: boolean; result?: { channels: string[]; failed: string[] }; error?: string }>('/api/alerts/notify/test', {
    method: 'POST',
  });
export const testAi = () =>
  api<{ ok: boolean; usedSample: boolean; latencyMs: number; error?: string; analysis?: { verdict: string; relevance: number; summary: string } }>(
    '/api/system/ai/test',
    { method: 'POST' },
  );
export const collectNow = () => api<CollectResult>('/api/collect/now', { method: 'POST' });

export const toggleSource = (id: number) => api<Source>(`/api/sources/${id}/toggle`, { method: 'POST' });
export const updateSource = (
  id: number,
  body: Partial<Pick<Source, 'enabled' | 'intervalMinutes' | 'extraJson' | 'displayName' | 'apiKey'>>,
) => api<Source>(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const addKeyword = (keyword: string, note: string) =>
  api<Keyword>('/api/keywords', { method: 'POST', body: JSON.stringify({ keyword, note }) });
export const updateKeyword = (id: number, body: Partial<Pick<Keyword, 'enabled' | 'keyword' | 'note'>>) =>
  api<Keyword>(`/api/keywords/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const removeKeyword = (id: number) => api<void>(`/api/keywords/${id}`, { method: 'DELETE' });

export const addRange = (body: { name: string; description?: string; queriesCsv?: string; enabled?: boolean }) =>
  api<Range>('/api/ranges', { method: 'POST', body: JSON.stringify(body) });
export const updateRange = (id: number, body: Partial<Pick<Range, 'enabled' | 'name' | 'description' | 'queriesCsv'>>) =>
  api<Range>(`/api/ranges/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const removeRange = (id: number) => api<void>(`/api/ranges/${id}`, { method: 'DELETE' });