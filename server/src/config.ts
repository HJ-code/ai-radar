import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server 根目录
const serverRoot = path.resolve(__dirname, '..');

// 从 server/.env 载入环境变量（不存在则忽略；已设置的变量不被覆盖）
try {
  process.loadEnvFile(path.join(serverRoot, '.env'));
} catch {
  /* no .env file */
}

function resolveDbPath(p?: string): string {
  if (!p) return path.join(serverRoot, 'data', 'hotspot.db');
  return path.isAbsolute(p) ? p : path.resolve(serverRoot, p);
}

export const config = {
  port: Number(process.env.PORT ?? 5188),
  dbPath: resolveDbPath(process.env.DB_PATH),
  ai: {
    baseUrl: (process.env.AI_BASE_URL ?? '').trim(),
    apiKey: (process.env.AI_API_KEY ?? '').trim(),
    model: (process.env.AI_MODEL ?? '').trim(),
    enabled: (process.env.AI_ENABLED ?? '1') !== '0',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 15_000),
    minRelevance: Number(process.env.AI_MIN_RELEVANCE ?? 55),
    maxPerRun: Number(process.env.AI_MAX_PER_RUN ?? 20),
    cooldownMs: Number(process.env.AI_COOLDOWN_MS ?? 60_000),
  },
};