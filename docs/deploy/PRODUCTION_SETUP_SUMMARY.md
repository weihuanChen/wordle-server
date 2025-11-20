# 生产环境配置完成总结

本文档总结了为 Wordle Server 项目完成的生产环境 Docker 配置。

## 完成时间
2024-11-20

## 配置概览

已为项目创建完整的生产环境 Docker 配置，支持：
- 多服务编排（PostgreSQL、Redis、Node.js App、Nginx）
- 安全性优化
- 性能优化
- 自动化部署
- 数据备份和恢复
- SSL/TLS 支持
- 健康检查和监控

## 新增文件列表

### 1. Docker 配置文件

#### `docker/Dockerfile` (已优化)
- 多阶段构建（deps → builder → runner）
- 仅包含生产依赖
- 使用非 root 用户运行
- 内置健康检查
- 使用 tini 作为 init 进程

#### `.dockerignore`
- 排除不必要文件
- 减小镜像大小
- 提高构建速度

#### `docker-compose.prod.yml`
- 生产环境服务编排
- PostgreSQL 16 Alpine
- Redis 7 Alpine
- Node.js 20 Alpine
- Nginx Alpine
- 完整的健康检查
- 资源限制配置
- 日志管理

### 2. Nginx 配置

#### `docker/nginx/nginx.conf`
- Worker 进程优化
- Gzip 压缩
- 速率限制
- 安全头设置
- 日志格式配置

#### `docker/nginx/conf.d/wordle.conf`
- 反向代理配置
- HTTP 和 HTTPS 支持
- 健康检查端点
- 静态资源缓存
- 连接限制

#### `docker/nginx/ssl/README.md`
- SSL 证书获取指南
- Let's Encrypt 配置
- 自签名证书生成
- 证书续期说明

### 3. PostgreSQL 配置

#### `docker/postgres/postgresql.conf`
- 连接池配置
- 内存优化（适配 4GB RAM）
- 日志配置
- 性能调优
- 自动清理设置

### 4. 环境配置

#### `.env.production`
- 环境变量模板
- 详细的配置说明
- 所有可配置项
- 默认值和注释

### 5. 部署脚本

#### `scripts/deploy.sh` (755 权限)
功能：
- 系统要求检查
- 环境变量验证
- 数据库备份（可选）
- Docker 镜像构建
- 服务启动
- 数据库迁移
- 健康检查
- 状态显示

#### `scripts/backup.sh` (755 权限)
功能：
- 数据库备份
- 压缩备份文件
- 自动清理旧备份
- 备份大小显示

#### `scripts/restore.sh` (755 权限)
功能：
- 从备份恢复数据库
- 安全确认机制
- 自动停止/启动服务
- 错误处理

### 6. 文档

#### `DEPLOYMENT.md`
完整的生产环境部署指南，包含：
- 前置要求
- 详细配置说明
- 部署步骤
- 维护操作
- 监控和日志
- 故障排查
- 安全建议
- 高可用部署

#### `PRODUCTION_QUICK_START.md`
快速开始指南，包含：
- 10 分钟部署流程
- 关键配置项
- 常用命令
- HTTPS 配置
- 防火墙设置
- 故障排查

#### `PRODUCTION_FILES.md`
配置文件清单，包含：
- 所有配置文件列表
- 文件用途说明
- 配置关系图
- 配置流程
- 安全检查清单
- 最佳实践

#### `docker/README.md`
Docker 配置说明，包含：
- 目录结构
- Dockerfile 说明
- Nginx 配置说明
- PostgreSQL 配置说明
- 使用说明
- 最佳实践

### 7. .gitignore 更新
新增忽略项：
- `.env.production.local`
- `backups/`
- SSL 证书文件
- Docker 卷数据
- 日志文件

## 项目结构

```
wordle-server/
├── docker/
│   ├── Dockerfile                    # 优化的多阶段构建
│   ├── README.md                     # Docker 配置说明
│   ├── nginx/
│   │   ├── nginx.conf               # Nginx 主配置
│   │   ├── conf.d/
│   │   │   └── wordle.conf         # 站点配置
│   │   └── ssl/
│   │       └── README.md           # SSL 证书指南
│   └── postgres/
│       └── postgresql.conf          # PostgreSQL 优化配置
│
├── scripts/
│   ├── deploy.sh                     # 部署脚本
│   ├── backup.sh                     # 备份脚本
│   └── restore.sh                    # 恢复脚本
│
├── .dockerignore                     # Docker 构建排除
├── .env.production                   # 环境变量模板
├── docker-compose.prod.yml           # 生产环境编排
├── DEPLOYMENT.md                     # 完整部署文档
├── PRODUCTION_QUICK_START.md         # 快速开始指南
└── PRODUCTION_FILES.md               # 配置文件清单
```

## 配置特点

### 1. 安全性
- ✅ 非 root 用户运行
- ✅ 环境变量管理敏感信息
- ✅ SSL/TLS 支持
- ✅ 速率限制
- ✅ 安全头设置
- ✅ 防火墙配置指南

### 2. 性能优化
- ✅ 多阶段 Docker 构建
- ✅ 仅生产依赖
- ✅ Gzip 压缩
- ✅ 静态资源缓存
- ✅ PostgreSQL 调优
- ✅ Redis 缓存配置
- ✅ Nginx 反向代理

### 3. 可维护性
- ✅ 一键部署脚本
- ✅ 自动化备份
- ✅ 健康检查
- ✅ 结构化日志
- ✅ 资源限制
- ✅ 详细文档

### 4. 可扩展性
- ✅ Docker Compose 编排
- ✅ 支持 Swarm 部署
- ✅ 负载均衡配置
- ✅ 水平扩展支持

## 使用流程

### 快速开始（3 步）

```bash
# 1. 生成密钥并配置环境变量
npm run generate:secrets
cp .env.production .env.production.local
nano .env.production.local

# 2. 一键部署
./scripts/deploy.sh

# 3. 验证
curl http://localhost:3000/health
```

### 日常维护

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 备份数据库
./scripts/backup.sh

# 更新部署
git pull && ./scripts/deploy.sh
```

## 服务架构

```
                    [Internet]
                        ↓
              [Nginx:80/443]
         (反向代理 + SSL + 限流)
                        ↓
              [App:3000]
           (Node.js + Hono)
                   ↓     ↓
        [PostgreSQL:5432] [Redis:6379]
         (持久化数据)      (缓存)
```

## 资源需求

### 最小配置
- CPU: 2 核心
- 内存: 2GB
- 磁盘: 10GB

### 推荐配置
- CPU: 4 核心
- 内存: 4GB
- 磁盘: 20GB

## 端口映射

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|---------|---------|------|
| Nginx | 80 | 80 | HTTP |
| Nginx | 443 | 443 | HTTPS |
| App | 3000 | 3000 | API |
| PostgreSQL | 5432 | 5432 | 数据库 |
| Redis | 6379 | 6379 | 缓存 |

## 安全检查清单

部署前请确认：

- [ ] 修改了 `POSTGRES_PASSWORD`
- [ ] 使用 `generate-secrets.js` 生成了密钥
- [ ] 设置了 `ADMIN_SECRET`
- [ ] 设置了 `ENCRYPTION_SECRET`
- [ ] `.env.production.local` 已添加到 `.gitignore`
- [ ] 配置了防火墙规则
- [ ] （生产环境）配置了 SSL 证书
- [ ] （生产环境）启用了 HTTPS
- [ ] 设置了定时备份任务

## 监控指标

### 健康检查端点
- `/health` - 完整健康检查
- `/health/live` - 存活检查

### 日志位置
- App: `docker-compose logs app`
- PostgreSQL: `docker-compose logs postgres`
- Redis: `docker-compose logs redis`
- Nginx: `docker-compose logs nginx`

### 资源监控
```bash
docker stats
docker system df
```

## 故障排查

### 常见问题

1. **端口占用**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **服务无法启动**
   ```bash
   docker-compose -f docker-compose.prod.yml logs app
   docker-compose -f docker-compose.prod.yml restart app
   ```

3. **数据库连接失败**
   ```bash
   docker exec wordle-postgres-prod pg_isready
   docker-compose -f docker-compose.prod.yml logs postgres
   ```

## 后续优化建议

### 短期（1-2 周）
1. 配置生产域名和 SSL 证书
2. 设置监控告警（如 Prometheus + Grafana）
3. 配置自动备份到云存储
4. 设置日志聚合（如 ELK）

### 中期（1-2 月）
1. 实施 CI/CD 流水线
2. 配置蓝绿部署
3. 添加性能监控
4. 优化数据库查询

### 长期（3-6 月）
1. 迁移到 Kubernetes（如需要）
2. 实施多区域部署
3. 添加 CDN
4. 优化成本

## 技术栈

- **容器化**: Docker 20.10+, Docker Compose 2.0+
- **反向代理**: Nginx Alpine
- **运行时**: Node.js 20 Alpine
- **数据库**: PostgreSQL 16 Alpine
- **缓存**: Redis 7 Alpine
- **初始化**: Tini

## 参考文档

- [快速部署指南](./PRODUCTION_QUICK_START.md) - 10 分钟快速部署
- [完整部署文档](./DEPLOYMENT.md) - 详细的部署指南
- [配置文件清单](./PRODUCTION_FILES.md) - 所有配置文件说明
- [Docker 配置](./docker/README.md) - Docker 相关说明
- [安全指南](./SECURITY.md) - 安全最佳实践

## 支持

如有问题，请：
1. 查看相关文档的故障排查部分
2. 检查服务日志
3. 验证配置文件
4. 提交 Issue

---

配置完成日期：2024-11-20
配置版本：1.0.0
