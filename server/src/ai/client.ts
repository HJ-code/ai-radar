import { fetchWithTimeout } from '../util/fetch.ts';

export interface IntelligenceConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends Error {}
export class AiParseError extends AiError {}

/** OpenAI 兼容 chat/completions 客户端（Node 原生 fetch，复用统一超时封装） */
export class AiClient {
  private readonly endpoint: string;

  constructor(private readonly cfg: IntelligenceConfig) {
    this.endpoint = `${cfg.baseUrl.trim().replace(/\/+$/, '')}/chat/completions`;
  }

  /** 请求 chat/completions 并强制解析出 JSON 对象 */
  async completeJson<T = unknown>(messages: ChatMessage[]): Promise<T> {
    const res = await fetchWithTimeout(
      this.endpoint,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: this.cfg.model, messages, temperature: 0.2 }),
      },
      this.cfg.timeoutMs ?? 15_000,
    );

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      throw new AiError(`HTTP ${res.status} ${body}`);
    }

    const data = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: unknown } }> }
      | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AiError('响应缺少 message.content');
    }
    return extractJson(content) as T;
  }
}

/** 容忍代码块包裹与多余前后文字，提取首个 JSON 对象 */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiParseError('响应不是 JSON 对象');
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    throw new AiParseError(`JSON 解析失败: ${(e as Error).message}`);
  }
}