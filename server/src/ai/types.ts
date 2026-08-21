export type AiVerdict = 'real' | 'doubtful' | 'fake';

export interface AiAnalysis {
  /** 真伪三档 */
  verdict: AiVerdict;
  /** 相关度 0-100 */
  relevance: number;
  /** ≤60 字中文摘要 */
  summary: string;
  /** 简短判定理由 */
  reasons: string;
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