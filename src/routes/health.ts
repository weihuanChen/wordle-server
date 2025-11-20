import { Hono } from 'hono';
import { testConnection as testPostgres } from '../lib/db.js';
import { testConnection as testRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const health = new Hono();

// Liveness probe - 简单的存活检查
health.get('/live', async (c) => {
  return c.json({ status: 'ok', service: 'wordle-server' }, 200);
});

// Readiness probe - 检查服务是否就绪（包括数据库连接）
health.get('/', async (c) => {
  const checks: Record<string, boolean> = {};
  const startTime = Date.now();

  try {
    // 并行检查所有依赖
    const [postgresOk, redisOk] = await Promise.all([
      testPostgres(),
      testRedis(),
    ]);

    checks.postgres = postgresOk;
    checks.redis = redisOk;

    const allHealthy = postgresOk && redisOk;
    const duration = Date.now() - startTime;

    const response = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      duration: `${duration}ms`,
    };

    logger.info({ response }, 'Health check performed');

    return c.json(response, allHealthy ? 200 : 503);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      503
    );
  }
});

export default health;

