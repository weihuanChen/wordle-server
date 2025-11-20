FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装生产依赖
RUN npm ci --only=production && \
    # 缓存生产依赖
    cp -R node_modules /tmp/node_modules_prod && \
    # 安装所有依赖（包括开发依赖用于构建）
    npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# 复制源代码和配置文件
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

# 构建应用
RUN npm run build

# 生产阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安装必要的系统工具
RUN apk add --no-cache tini

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# 复制生产依赖
COPY --from=deps /tmp/node_modules_prod ./node_modules

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# 复制数据库迁移文件和脚本
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# 创建数据目录
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# 使用 tini 作为 init 进程，确保优雅关闭
ENTRYPOINT ["/sbin/tini", "--"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

CMD ["node", "dist/index.js"]

