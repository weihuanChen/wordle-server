# 生产环境部署指南

本指南详细说明如何使用 Docker 部署 Wordle Server 到生产环境。

## 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [部署步骤](#部署步骤)
- [维护操作](#维护操作)
- [监控和日志](#监控和日志)
- [故障排查](#故障排查)
- [安全建议](#安全建议)

## 前置要求

### 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ 推荐), macOS, Windows with WSL2
- **Docker**: 20.10.0+
- **Docker Compose**: 2.0.0+
- **内存**: 最小 2GB, 推荐 4GB+
- **磁盘**: 最小 10GB 可用空间

### 安装 Docker 和 Docker Compose

#### Ubuntu/Debian

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
```

#### macOS

```bash
# 使用 Homebrew 安装
brew install --cask docker
```

#### 验证安装

```bash
docker --version
docker-compose --version
```

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd wordle-server
```

### 2. 生成安全密钥

```bash
npm install
npm run generate:secrets
```

这将生成两个强随机密钥：
- `ADMIN_SECRET`: 用于管理员 API 认证
- `ENCRYPTION_SECRET`: 用于数据加密

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env.production.local

# 编辑配置文件
nano .env.production.local
```

**必须修改的配置项：**

```bash
# 数据库密码（使用强密码）
POSTGRES_PASSWORD=your_strong_database_password

# 安全密钥（使用 npm run generate:secrets 生成的值）
ADMIN_SECRET=<generated_admin_secret>
ENCRYPTION_SECRET=<generated_encryption_secret>
```

### 4. 一键部署

```bash
./scripts/deploy.sh
```

部署脚本会自动：
- 检查系统要求
- 验证环境配置
- 构建 Docker 镜像
- 启动所有服务
- 运行数据库迁移
- 执行健康检查

### 5. 验证部署

```bash
# 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 访问健康检查端点
curl http://localhost:3000/health
```

## 详细配置

### 环境变量说明

#### 应用配置

```bash
NODE_ENV=production          # 运行环境
PORT=3000                    # 应用内部端口
APP_PORT=3000               # 外部访问端口
VERSION=latest              # Docker 镜像版本
```

#### 数据库配置

```bash
POSTGRES_USER=postgres          # PostgreSQL 用户名
POSTGRES_PASSWORD=<password>    # PostgreSQL 密码（必须修改）
POSTGRES_DB=wordle_db          # 数据库名称
POSTGRES_PORT=5432             # PostgreSQL 端口
```

#### Redis 配置

```bash
REDIS_PORT=6379                # Redis 端口
```

#### 安全配置

```bash
ADMIN_SECRET=<secret>          # 管理员 API 密钥（必须修改）
ENCRYPTION_SECRET=<secret>     # 数据加密密钥（必须修改）
```

#### 日志配置

```bash
LOG_LEVEL=info                 # 日志级别: trace, debug, info, warn, error, fatal
```

#### Nginx 配置

```bash
NGINX_HTTP_PORT=80             # HTTP 端口
NGINX_HTTPS_PORT=443           # HTTPS 端口
```

### SSL/TLS 证书配置

#### 使用 Let's Encrypt（推荐）

1. 安装 Certbot:

```bash
sudo apt-get update
sudo apt-get install certbot
```

2. 获取证书:

```bash
sudo certbot certonly --standalone -d your-domain.com
```

3. 复制证书到项目:

```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

4. 设置权限:

```bash
chmod 644 docker/nginx/ssl/fullchain.pem
chmod 600 docker/nginx/ssl/privkey.pem
```

5. 启用 HTTPS 配置:

编辑 `docker/nginx/conf.d/wordle.conf`，取消 HTTPS server 块的注释。

6. 重启 Nginx:

```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

#### 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 添加 crontab 任务
sudo crontab -e

# 添加以下行（每月 1 日凌晨执行）
0 0 1 * * certbot renew --quiet && cd /path/to/wordle-server && docker-compose -f docker-compose.prod.yml restart nginx
```

## 部署步骤

### 完整部署流程

#### 1. 准备服务器

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装必要工具
sudo apt-get install -y git curl
```

#### 2. 配置防火墙

```bash
# 使用 ufw
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

#### 3. 克隆和配置

```bash
# 克隆项目
git clone <repository-url>
cd wordle-server

# 安装依赖（本地生成密钥）
npm install

# 生成安全密钥
npm run generate:secrets

# 配置环境变量
cp .env.production .env.production.local
nano .env.production.local
```

#### 4. 初始化数据

```bash
# 首次部署时，确保数据文件存在
# 检查 valid_guesses.json 和 puzzle_candidates.json
ls -lh *.json
```

#### 5. 执行部署

```bash
./scripts/deploy.sh
```

#### 6. 导入初始数据

```bash
# 导入单词列表
docker-compose -f docker-compose.prod.yml exec app npm run import:words

# 生成每日谜题
docker-compose -f docker-compose.prod.yml exec app npm run generate:puzzle
```

## 维护操作

### 服务管理

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 重启特定服务
docker-compose -f docker-compose.prod.yml restart app
docker-compose -f docker-compose.prod.yml restart nginx

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps
```

### 数据库备份

#### 自动备份

```bash
# 执行备份
./scripts/backup.sh

# 设置定时备份（每天凌晨 2 点）
crontab -e

# 添加以下行
0 2 * * * cd /path/to/wordle-server && ./scripts/backup.sh
```

#### 手动备份

```bash
# 创建备份
docker exec wordle-postgres-prod pg_dump -U postgres wordle_db > backup.sql

# 压缩备份
gzip backup.sql
```

### 数据库恢复

```bash
# 从备份恢复
./scripts/restore.sh backups/wordle_db_backup_20240101_120000.sql.gz
```

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./scripts/deploy.sh

# 或者手动更新
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 数据库迁移

```bash
# 运行迁移
docker-compose -f docker-compose.prod.yml exec app npm run migrate:up

# 回滚迁移
docker-compose -f docker-compose.prod.yml exec app npm run migrate:down

# 创建新迁移
docker-compose -f docker-compose.prod.yml exec app npm run migrate:create migration_name
```

## 监控和日志

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f redis
docker-compose -f docker-compose.prod.yml logs -f nginx

# 查看最近 100 行日志
docker-compose -f docker-compose.prod.yml logs --tail=100 app
```

### 健康检查

```bash
# 应用健康检查
curl http://localhost:3000/health
curl http://localhost:3000/health/live

# 数据库健康检查
docker exec wordle-postgres-prod pg_isready -U postgres

# Redis 健康检查
docker exec wordle-redis-prod redis-cli ping
```

### 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看特定容器资源
docker stats wordle-server-prod

# 查看磁盘使用
docker system df
```

### 清理日志和数据

```bash
# 清理停止的容器
docker container prune -f

# 清理未使用的镜像
docker image prune -a -f

# 清理未使用的卷
docker volume prune -f

# 清理所有未使用的资源
docker system prune -a -f --volumes
```

## 故障排查

### 常见问题

#### 1. 端口已被占用

```bash
# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379

# 停止占用端口的进程
sudo kill -9 <PID>
```

#### 2. 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose -f docker-compose.prod.yml ps postgres

# 查看数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# 进入数据库容器
docker exec -it wordle-postgres-prod psql -U postgres -d wordle_db
```

#### 3. 应用无法启动

```bash
# 查看应用日志
docker-compose -f docker-compose.prod.yml logs app

# 检查环境变量
docker-compose -f docker-compose.prod.yml exec app printenv

# 重新构建镜像
docker-compose -f docker-compose.prod.yml build --no-cache app
docker-compose -f docker-compose.prod.yml up -d
```

#### 4. Nginx 无法访问

```bash
# 检查 Nginx 配置
docker exec wordle-nginx-prod nginx -t

# 查看 Nginx 日志
docker-compose -f docker-compose.prod.yml logs nginx

# 重新加载配置
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

#### 5. 内存不足

```bash
# 查看系统内存
free -h

# 清理 Docker 缓存
docker system prune -a -f

# 调整服务资源限制
# 编辑 docker-compose.prod.yml 中的 deploy.resources 部分
```

### 调试模式

```bash
# 以调试模式启动应用
docker-compose -f docker-compose.prod.yml run --rm \
  -e LOG_LEVEL=debug \
  app npm run dev

# 进入应用容器进行调试
docker exec -it wordle-server-prod sh
```

## 安全建议

### 1. 密钥管理

- ✅ 使用强随机密钥
- ✅ 定期轮换密钥
- ✅ 不要将密钥提交到版本控制
- ✅ 使用环境变量管理敏感信息

### 2. 网络安全

- ✅ 配置防火墙规则
- ✅ 使用 HTTPS（SSL/TLS）
- ✅ 限制数据库和 Redis 的外部访问
- ✅ 配置 Nginx 速率限制

### 3. 数据库安全

- ✅ 使用强数据库密码
- ✅ 定期备份数据
- ✅ 限制数据库用户权限
- ✅ 加密敏感数据

### 4. 容器安全

- ✅ 使用非 root 用户运行容器
- ✅ 定期更新基础镜像
- ✅ 限制容器资源使用
- ✅ 使用只读文件系统（where possible）

### 5. 监控和日志

- ✅ 启用日志收集
- ✅ 监控异常访问
- ✅ 设置告警通知
- ✅ 定期审查日志

### 6. 更新和补丁

```bash
# 定期更新依赖
npm audit
npm update

# 更新 Docker 镜像
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 高可用部署（可选）

### Docker Swarm 部署

```bash
# 初始化 Swarm
docker swarm init

# 部署 stack
docker stack deploy -c docker-compose.prod.yml wordle

# 扩展服务
docker service scale wordle_app=3
```

### 负载均衡

编辑 `docker/nginx/conf.d/wordle.conf`：

```nginx
upstream wordle_backend {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}
```

## 参考资源

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

## 支持

如有问题，请：
1. 查看本文档的故障排查部分
2. 检查应用日志
3. 提交 Issue 到项目仓库

---

最后更新: 2024-11-20
