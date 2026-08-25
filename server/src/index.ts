import { config } from './config.ts';
import { migrate } from './db/conn.ts';
import { seed } from './db/seed.ts';
import { backfillHotspotDetails } from './repositories/hotspots.ts';
import { createApp } from './app.ts';
import { startScheduler } from './services/scheduler.ts';

migrate();
seed();
const backfilled = backfillHotspotDetails();
if (backfilled > 0) console.log(`[hotspot] 热点互动详情回填 ${backfilled} 条`);

const app = createApp();
app.listen(config.port, () => {
  console.log(`[hotspot] 服务已启动：http://localhost:${config.port} (db: ${config.dbPath})`);
});

startScheduler();