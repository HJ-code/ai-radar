import { config } from './config.ts';
import { migrate } from './db/conn.ts';
import { seed } from './db/seed.ts';
import { backfillEngagementMagnitude } from './repositories/hotspots.ts';
import { createApp } from './app.ts';
import { startScheduler } from './services/scheduler.ts';

migrate();
seed();
const backfilled = backfillEngagementMagnitude();
if (backfilled > 0) console.log(`[hotspot] 互动量回填 ${backfilled} 条热点`);

const app = createApp();
app.listen(config.port, () => {
  console.log(`[hotspot] 服务已启动：http://localhost:${config.port} (db: ${config.dbPath})`);
});

startScheduler();