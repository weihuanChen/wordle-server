# 生产环境快速部署指南

## 一、前置准备（5分钟）

### 1. 安装 Docker 和 Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt-get install docker-compose-plugin

# 验证安装
docker --version
docker-compose --version
```

### 2. 克隆项目

```bash
git clone <repository-url>
cd wordle-server
```

## 二、配置环境（3分钟）

### 1. 生成安全密钥

```bash
npm install
npm run generate:secrets
```

输出示例：
```
ADMIN_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENCRYPTION_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

### 2. 创建环境配置文件

```bash
cp .env.production .env.production.local
nano .env.production.local
```

### 3. 修改必需配置

在 `.env.production.local` 中修改以下三项：

```bash
# 1. 数据库密码（使用强密码）
POSTGRES_PASSWORD=YourStrongPassword123!

# 2. 管理员密钥（使用上面生成的值）
ADMIN_SECRET=<你生成的 ADMIN_SECRET>

# 3. 加密密钥（使用上面生成的值）
ENCRYPTION_SECRET=<你生成的 ENCRYPTION_SECRET>
```

## 三、一键部署（2分钟）

```bash
./scripts/deploy.sh
```

脚本会自动完成：
- ✅ 检查系统要求
- ✅ 验证配置
- ✅ 构建 Docker 镜像
- ✅ 启动所有服务（PostgreSQL、Redis、App、Nginx）
- ✅ 运行数据库迁移
- ✅ 执行健康检查

## 四、验证部署

```bash
# 1. 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 2. 测试 API
curl http://localhost:3000/health

# 3. 查看日志
docker-compose -f docker-compose.prod.yml logs -f app
```

## 五、导入初始数据（可选）

```bash
# 导入单词列表
docker-compose -f docker-compose.prod.yml exec app npm run import:words

# 生成每日谜题
docker-compose -f docker-compose.prod.yml exec app npm run generate:puzzle
```

## 常用命令

### 服务管理

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 查看状态
docker-compose -f docker-compose.prod.yml ps
```

### 日志查看

```bash
# 查看所有日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看应用日志
docker-compose -f docker-compose.prod.yml logs -f app

# 查看最近 100 行
docker-compose -f docker-compose.prod.yml logs --tail=100 app
```

### 数据库操作

```bash
# 备份数据库
./scripts/backup.sh

# 恢复数据库
./scripts/restore.sh backups/wordle_db_backup_20240101_120000.sql.gz

# 运行迁移
docker-compose -f docker-compose.prod.yml exec app npm run migrate:up
```

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./scripts/deploy.sh
```

## 配置 HTTPS（可选）

### 1. 获取 SSL 证书

```bash
# 安装 Certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/

# 设置权限
chmod 644 docker/nginx/ssl/fullchain.pem
chmod 600 docker/nginx/ssl/privkey.pem
```

### 2. 启用 HTTPS

编辑 `docker/nginx/conf.d/wordle.conf`，取消 HTTPS server 块的注释。

### 3. 重启 Nginx

```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

## 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 检查状态
sudo ufw status
```

## 监控和维护

### 定时备份

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 2 点备份
0 2 * * * cd /path/to/wordle-server && ./scripts/backup.sh
```

### 健康检查

```bash
# 应用健康
curl http://localhost:3000/health/live

# 数据库健康
docker exec wordle-postgres-prod pg_isready -U postgres

# Redis 健康
docker exec wordle-redis-prod redis-cli ping
```

### 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df
```

## 故障排查

### 端口冲突

```bash
# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379

# 停止占用的进程
sudo kill -9 <PID>
```

### 查看详细日志

```bash
# 应用日志
docker-compose -f docker-compose.prod.yml logs app

# 数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# Nginx 日志
docker-compose -f docker-compose.prod.yml logs nginx
```

### 重新构建

```bash
# 清理并重新构建
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 安全检查清单

- [ ] 修改了数据库密码
- [ ] 生成并设置了 ADMIN_SECRET
- [ ] 生成并设置了 ENCRYPTION_SECRET
- [ ] 配置了防火墙
- [ ] 启用了 HTTPS（生产环境）
- [ ] 设置了定时备份
- [ ] .env.production.local 未提交到 Git

## 访问地址

- **API 入口**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **API 文档**: http://localhost:3000

## 需要帮助？

查看完整文档：[DEPLOYMENT.md](./DEPLOYMENT.md)

## 架构概览

```
[客户端]
    ↓
[Nginx:80/443] (反向代理 + SSL + 速率限制)
    ↓
[App:3000] (Node.js + Hono)
    ↓
[PostgreSQL:5432] (持久化数据)
[Redis:6379] (缓存)
```

## 服务清单

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| App | wordle-server-prod | 3000 | Node.js 应用 |
| PostgreSQL | wordle-postgres-prod | 5432 | 数据库 |
| Redis | wordle-redis-prod | 6379 | 缓存 |
| Nginx | wordle-nginx-prod | 80, 443 | 反向代理 |

---

完成时间：约 10 分钟
最后更新：2024-11-20
