# Docker 配置说明

本目录包含了 Wordle Server 的 Docker 相关配置文件。

## 目录结构

```
docker/
├── Dockerfile              # 生产环境 Dockerfile（多阶段构建）
├── nginx/                  # Nginx 配置
│   ├── nginx.conf         # Nginx 主配置
│   ├── conf.d/            # 站点配置
│   │   └── wordle.conf   # Wordle Server 配置
│   └── ssl/               # SSL 证书目录
│       └── README.md      # SSL 证书说明
└── postgres/              # PostgreSQL 配置
    └── postgresql.conf    # PostgreSQL 优化配置
```

## Dockerfile 说明

生产环境 Dockerfile 使用多阶段构建，包含三个阶段：

### 1. deps（依赖阶段）
- 安装生产依赖
- 安装所有依赖（用于构建）
- 缓存生产依赖到 `/tmp/node_modules_prod`

### 2. builder（构建阶段）
- 复制依赖
- 复制源代码
- 编译 TypeScript

### 3. runner（运行阶段）
- 使用 Alpine Linux 基础镜像
- 仅包含生产依赖
- 以非 root 用户运行
- 包含健康检查
- 使用 tini 作为 init 进程

### 镜像大小优化

- 多阶段构建减少最终镜像大小
- 仅复制必需的文件
- 使用 Alpine 基础镜像
- 生产环境不包含开发依赖

## Nginx 配置说明

### nginx.conf
主配置文件，包含：
- Worker 进程配置
- Gzip 压缩
- 日志格式
- 性能优化
- 安全头设置
- 速率限制配置

### conf.d/wordle.conf
站点配置，包含：
- HTTP 服务器配置（开发/测试）
- HTTPS 服务器配置（生产环境，默认注释）
- 反向代理设置
- 健康检查端点
- 静态资源缓存
- 速率限制

### 启用 HTTPS

1. 获取 SSL 证书（参考 ssl/README.md）
2. 编辑 `conf.d/wordle.conf`
3. 取消 HTTPS server 块的注释
4. 重启 Nginx

## PostgreSQL 配置说明

### postgresql.conf
优化配置，适用于中小型应用，包含：
- 连接数配置
- 内存设置（基于 4GB RAM）
- 检查点设置
- 日志配置
- 并发设置
- 自动清理配置

### 根据服务器调整

如果服务器内存不同，需要调整以下参数：

```conf
# 2GB RAM
shared_buffers = 128MB
effective_cache_size = 512MB

# 8GB RAM
shared_buffers = 512MB
effective_cache_size = 2GB

# 16GB RAM
shared_buffers = 1GB
effective_cache_size = 4GB
```

## 使用说明

### 开发环境

```bash
# 使用开发配置
docker-compose -f docker-compose.dev.yml up -d
```

### 生产环境

```bash
# 使用生产配置
docker-compose -f docker-compose.prod.yml up -d
```

### 构建镜像

```bash
# 构建生产镜像
docker build -f docker/Dockerfile -t wordle-server:latest .

# 构建特定版本
docker build -f docker/Dockerfile -t wordle-server:1.0.0 .
```

### 测试配置

```bash
# 测试 Nginx 配置
docker run --rm -v $(pwd)/docker/nginx/nginx.conf:/etc/nginx/nginx.conf nginx nginx -t

# 测试 PostgreSQL 配置
docker run --rm -v $(pwd)/docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf postgres:16-alpine postgres --check
```

## 最佳实践

### 1. 安全性
- 使用非 root 用户运行容器
- 限制容器资源使用
- 配置速率限制
- 使用 HTTPS
- 定期更新基础镜像

### 2. 性能优化
- 启用 Gzip 压缩
- 配置静态资源缓存
- 优化数据库参数
- 使用连接池
- 配置健康检查

### 3. 可维护性
- 使用多阶段构建
- 分层缓存依赖
- 结构化日志
- 配置健康检查
- 版本化镜像

### 4. 监控
- 配置日志轮转
- 监控容器资源
- 设置健康检查
- 收集性能指标

## 相关文档

- [快速部署指南](../PRODUCTION_QUICK_START.md)
- [完整部署文档](../DEPLOYMENT.md)
- [SSL 证书配置](nginx/ssl/README.md)

## 技术栈

- **基础镜像**: node:20-alpine
- **Web 服务器**: Nginx Alpine
- **数据库**: PostgreSQL 16 Alpine
- **缓存**: Redis 7 Alpine

## 更新记录

- 2024-11-20: 初始版本
  - 多阶段 Dockerfile
  - Nginx 反向代理配置
  - PostgreSQL 优化配置
  - SSL/TLS 支持
