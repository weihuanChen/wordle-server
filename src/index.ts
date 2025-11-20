import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from './lib/logger.js';
import { createPool, closePool } from './lib/db.js';
import { createRedisClient, closeRedisClient } from './lib/redis.js';
import health from './routes/health.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = new Hono();

// 请求日志中间件
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info({
    method,
    path,
    status,
    duration: `${duration}ms`,
  }, 'HTTP request');
});

// CORS 中间件
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// 健康检查路由
app.route('/health', health);

// 公共API路由
app.route('/', publicRoutes);

// 管理员API路由（需要认证）
app.route('/admin', adminRoutes);

// 根路径
app.get('/', (c) => {
  return c.json({
    message: 'Wordle Server API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      live: '/health/live',
      daily: '/daily/{gameType}/{lang}',
      config: '/config/{gameType}',
      verify: '/verify/{lang}/{word}',
      admin: {
        generatePuzzle: 'POST /admin/generate-puzzle',
        updateSettings: 'PUT /admin/game-settings/{gameType}',
        stats: 'GET /admin/stats',
      },
    },
    documentation: 'See README.md for API documentation',
  });
});

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, 'Unhandled error');
  return c.json({ error: 'Internal Server Error' }, 500);
});

// 初始化数据库连接
async function initialize() {
  try {
    createPool();
    createRedisClient();
    logger.info('Service initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize service');
    process.exit(1);
  }
}

// 优雅关闭
async function shutdown() {
  logger.info('Shutting down...');
  await Promise.all([closePool(), closeRedisClient()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 启动服务
const port = parseInt(process.env.PORT || '3000', 10);

initialize().then(() => {
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);
  });
});

