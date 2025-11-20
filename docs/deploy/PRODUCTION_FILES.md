# 生产环境配置文件清单

本文档列出了所有生产环境相关的配置文件及其用途。

## 配置文件列表

### 核心配置

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `.env.production` | 环境变量模板 | ✅ | 包含所有可配置项和说明 |
| `.env.production.local` | 实际环境变量 | ✅ | 需从模板创建，包含敏感信息 |
| `docker-compose.prod.yml` | 生产环境编排 | ✅ | 定义所有服务和依赖关系 |

### Docker 配置

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `docker/Dockerfile` | 应用镜像构建 | ✅ | 多阶段构建，优化镜像大小 |
| `.dockerignore` | Docker 构建排除 | ✅ | 排除不必要的文件 |

### Nginx 配置

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `docker/nginx/nginx.conf` | Nginx 主配置 | ✅ | 全局设置、性能优化 |
| `docker/nginx/conf.d/wordle.conf` | 站点配置 | ✅ | 反向代理、SSL、速率限制 |
| `docker/nginx/ssl/fullchain.pem` | SSL 证书 | 🔶 | HTTPS 需要 |
| `docker/nginx/ssl/privkey.pem` | SSL 私钥 | 🔶 | HTTPS 需要 |

### 数据库配置

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `docker/postgres/postgresql.conf` | PostgreSQL 优化 | ✅ | 性能调优配置 |

### 部署脚本

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `scripts/deploy.sh` | 一键部署脚本 | ✅ | 自动化部署流程 |
| `scripts/backup.sh` | 数据库备份 | ✅ | 定期备份数据 |
| `scripts/restore.sh` | 数据库恢复 | ✅ | 从备份恢复 |
| `scripts/generate-secrets.js` | 生成密钥 | ✅ | 生成安全密钥 |

### 文档

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `DEPLOYMENT.md` | 完整部署文档 | ✅ | 详细的部署指南 |
| `PRODUCTION_QUICK_START.md` | 快速开始指南 | ✅ | 10分钟快速部署 |
| `docker/README.md` | Docker 配置说明 | ✅ | Docker 相关说明 |
| `docker/nginx/ssl/README.md` | SSL 证书指南 | ✅ | SSL 配置说明 |

## 配置文件关系图

```
生产环境部署
│
├── 环境变量
│   ├── .env.production (模板)
│   └── .env.production.local (实际使用，包含密钥)
│
├── Docker 编排
│   ├── docker-compose.prod.yml (服务定义)
│   └── docker/Dockerfile (镜像构建)
│
├── 服务配置
│   ├── Nginx
│   │   ├── nginx.conf (主配置)
│   │   ├── conf.d/wordle.conf (站点配置)
│   │   └── ssl/ (证书文件)
│   │
│   └── PostgreSQL
│       └── postgresql.conf (性能优化)
│
└── 运维脚本
    ├── deploy.sh (部署)
    ├── backup.sh (备份)
    └── restore.sh (恢复)
```

## 配置流程

### 1. 初始配置（首次部署）

```bash
# 步骤 1: 生成密钥
npm run generate:secrets

# 步骤 2: 创建环境配置
cp .env.production .env.production.local

# 步骤 3: 编辑配置（填入密钥和密码）
nano .env.production.local

# 步骤 4: 配置 SSL（可选）
# 参考 docker/nginx/ssl/README.md

# 步骤 5: 执行部署
./scripts/deploy.sh
```

### 2. 环境变量配置优先级

1. `.env.production.local` (实际使用，不提交到 Git)
2. `.env.production` (模板，提交到 Git)
3. `docker-compose.prod.yml` 中的默认值
4. 系统环境变量

### 3. 配置更新流程

```bash
# 1. 备份现有配置
cp .env.production.local .env.production.local.bak

# 2. 更新配置
nano .env.production.local

# 3. 验证配置
docker-compose -f docker-compose.prod.yml config

# 4. 重新部署
./scripts/deploy.sh
```

## 关键配置项

### 必须修改的配置

以下配置项在生产环境中**必须**修改：

```bash
# .env.production.local

# 1. 数据库密码
POSTGRES_PASSWORD=<强密码>

# 2. 管理员密钥
ADMIN_SECRET=<随机密钥>

# 3. 加密密钥
ENCRYPTION_SECRET=<随机密钥>
```

### 可选修改的配置

```bash
# 应用端口
APP_PORT=3000

# 日志级别
LOG_LEVEL=info

# Nginx 端口
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# 数据库配置
POSTGRES_USER=postgres
POSTGRES_DB=wordle_db
```

## 安全配置检查清单

### 环境变量安全

- [ ] `.env.production.local` 已添加到 `.gitignore`
- [ ] 使用 `generate-secrets.js` 生成的强随机密钥
- [ ] 数据库密码使用强密码（至少 16 字符）
- [ ] 所有密钥都不同，不重复使用

### 文件权限

```bash
# 设置正确的文件权限
chmod 600 .env.production.local
chmod 600 docker/nginx/ssl/privkey.pem
chmod 644 docker/nginx/ssl/fullchain.pem
chmod +x scripts/*.sh
```

### 防火墙配置

```bash
# 仅开放必要端口
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### SSL/TLS 配置

- [ ] 使用有效的 SSL 证书（Let's Encrypt 或商业证书）
- [ ] 启用 HTTPS（取消 wordle.conf 中 HTTPS server 块注释）
- [ ] 配置 HTTP 到 HTTPS 重定向
- [ ] 设置自动证书续期

## 配置验证

### 验证 Docker Compose 配置

```bash
docker-compose -f docker-compose.prod.yml config
```

### 验证 Nginx 配置

```bash
docker run --rm -v $(pwd)/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/docker/nginx/conf.d:/etc/nginx/conf.d:ro \
  nginx nginx -t
```

### 验证环境变量

```bash
# 加载环境变量
source .env.production.local

# 检查关键变量
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:3}***"
echo "ADMIN_SECRET: ${ADMIN_SECRET:0:3}***"
echo "ENCRYPTION_SECRET: ${ENCRYPTION_SECRET:0:3}***"
```

## 配置模板

### 最小化生产配置

```bash
# .env.production.local 最小配置
NODE_ENV=production
PORT=3000

POSTGRES_PASSWORD=<your-strong-password>
POSTGRES_USER=postgres
POSTGRES_DB=wordle_db

ADMIN_SECRET=<generated-secret>
ENCRYPTION_SECRET=<generated-secret>

LOG_LEVEL=info
```

### 完整生产配置

参考 `.env.production` 文件获取所有可用配置项。

## 配置管理最佳实践

### 1. 版本控制

- ✅ 提交配置模板（`.env.production`）
- ❌ 不提交实际配置（`.env.production.local`）
- ✅ 提交配置说明文档
- ❌ 不提交 SSL 私钥

### 2. 密钥管理

- ✅ 使用密钥生成工具
- ✅ 定期轮换密钥
- ✅ 使用不同的密钥用于不同环境
- ❌ 不在代码中硬编码密钥

### 3. 配置备份

```bash
# 备份配置文件
mkdir -p ~/wordle-config-backup
cp .env.production.local ~/wordle-config-backup/
cp -r docker/nginx/ssl/*.pem ~/wordle-config-backup/ 2>/dev/null || true
```

### 4. 配置文档化

- 记录所有自定义配置
- 说明配置变更原因
- 维护配置变更日志

## 常见问题

### Q: 配置文件在哪里？
A: 所有配置文件都在项目根目录和 `docker/` 目录下。

### Q: 如何重置配置？
A: 删除 `.env.production.local`，从 `.env.production` 重新创建。

### Q: 如何测试配置？
A: 使用 `docker-compose config` 命令验证配置语法。

### Q: 配置更新后需要重启吗？
A: 是的，使用 `docker-compose restart` 重启相关服务。

## 相关文档

- [快速部署指南](./PRODUCTION_QUICK_START.md)
- [完整部署文档](./DEPLOYMENT.md)
- [Docker 配置说明](./docker/README.md)
- [安全指南](./SECURITY.md)

---

最后更新：2024-11-20
