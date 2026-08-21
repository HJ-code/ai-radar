import { config } from './config.ts';
import { migrate } from './db/conn.ts';
import { seed } from './db/seed.ts';
import { createApp } from './app.ts';
import { startScheduler } from './services/scheduler.ts';

migrate();
seed();

const app = createApp();
app.listen(config.port, () => {
  console.log(`[hotspot] 服务已启动：http://localhost:${config.port} (db: ${config.dbPath})`);
});

startScheduler();