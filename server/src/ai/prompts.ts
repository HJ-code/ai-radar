import type { AnalysisItemCtx } from './types.ts';
import type { ChatMessage } from './client.ts';

export interface ScopeCtx {
  keywords: string[];
  ranges: string[];
}

const SYSTEM_PROMPT = `你是一个 AI 热点「真伪鉴别 + 相关度评估 + 中文摘要」助手。请对给定的一条候选内容，依据证据链判断真伪：
1) 账号可信度：作者是否官方媒体/知名账号、是否疑似机器人/自动化营销号；
2) 内容措辞：是否疑似戏仿、钓鱼、标题党、营销软文、蹭热度；
3) 与已知事实/已知常识的冲突程度；
4) 互动数据是否异常（如互动量与账号常规量级不匹配的暴涨）。

判定规则（倾向：有可信依据则判真，不要无故存疑）：
- 有可靠来源佐证、或来自官方媒体/知名账号、内容具体可信 → real。即使信息较新、你不熟悉，只要无明显矛盾也不要把真新闻误判为 doubtful；
- 证据不足、无法核实真实性时才判 doubtful（存疑 ≠ 指控虚假，不要无证据地指控为 fake）；
- 明显的戏仿/钓鱼/伪造/标题党营销/仿冒官方账号 → fake。

相关度（关键：主体相关，而非「提及」）：
- relevance 取 0-100：只有当该内容的「主体/核心主题」本身就是监控关键词/范围所指时，才能给高分（80 以上）；主题无关给 0-20；
- 若只是顺带提及、一笔带过、或正文主体是别的话题（即使标题出现了关键词），最高给 50 分。禁止因为标题出现关键词就给高分；
- 一句话放在多事件里刷屏的那种聚合/摘要内容，若监控主题并非其主体，相关度应相应压低。

随后：
- summary：≤60 字的客观中文摘要；
- reasons：一句简短判定理由（中文，≤30 字）；real 时简述来源/依据，doubtful 时说明缺什么证据；
- relevance_reason：一句简短相关度理由（中文，≤30 字），说明该内容为何与「监控范围/关键词」相关——主体相关时用「主体即…」表述，仅提及/无关时明确写「主体无关/仅提及」并给低分。

只输出一个 JSON 对象，不要输出任何其他文字或代码块标记：
{"verdict": "real|doubtful|fake", "relevance": 0到100的整数, "summary": "中文摘要", "reasons": "判定理由", "relevance_reason": "相关度理由"}`;

/** 把一条候选内容 + 监控范围组装成两轮对话，供单次请求完成真伪/相关/摘要三道关 */
export function buildAnalysisMessages(item: AnalysisItemCtx, scope: ScopeCtx): ChatMessage[] {
  const topics = [...scope.keywords, ...scope.ranges].filter(Boolean).join('、') || '（无）';
  const engagement = describeEngagement(item.engagementJson);
  const user = [
    `标题：${item.title ?? '（无）'}`,
    `正文：${(item.text ?? '').slice(0, 1200) || '（无）'}`,
    `作者：${item.author ?? '（未知）'}`,
    `来源：${item.sourceKey ?? '（未知）'}`,
    `发布时间：${item.publishedAt ?? '（未知）'}`,
    `互动数据：${engagement}`,
    `原文URL：${item.url ?? '（无）'}`,
    '',
    `监控范围/关键词：${topics}`,
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

function describeEngagement(engagementJson?: string): string {
  try {
    const obj = JSON.parse(engagementJson ?? '{}') as Record<string, unknown>;
    const nums = Object.entries(obj)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `${k}=${v}`);
    return nums.length ? nums.join(', ') : '无';
  } catch {
    return '无';
  }
}