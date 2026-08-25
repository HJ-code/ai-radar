export type AiVerdict = 'real' | 'doubtful' | 'fake';

export interface AiAnalysis {
  /** 真伪三档 */
  verdict: AiVerdict;
  /** 相关度 0-100 */
  relevance: number;
  /** ≤60 字中文摘要 */
  summary: string;
  /** 简短判定理由（≤30 字）：real 简述来源/依据、doubtful 说明缺什么证据 */
  reasons: string;
  /** 简短相关度理由（≤30 字）：为何与监控关键词/范围相关；无关时说明「主体无关」 */
  relevanceReason: string;
}

/** 送入 AI 的条目上下文（与 ItemRow 解耦，便于构造样本） */
export interface AnalysisItemCtx {
  title?: string | null;
  text?: string | null;
  author?: string | null;
  sourceKey?: string | null;
  publishedAt?: string | null;
  engagementJson?: string;
  url?: string | null;
}