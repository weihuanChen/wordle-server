# 安全配置指南

## 🔐 密钥管理

### 快速生成密钥

项目提供了自动密钥生成工具，可以快速生成安全的随机密钥。

#### 方法 1: 查看生成的密钥

```bash
npm run generate:secrets
```

输出示例：
```
🔐 Wordle 服务密钥生成工具
======================================================================

📋 生成的密钥（请保存到 .env 文件）

# 管理 API 认证密钥
ADMIN_SECRET=Y20otwPMvbT3FmZzAbgB4oRhn-eU0LkQgsfqDacv2ic

# 答案加密密钥
ENCRYPTION_SECRET=Or4YzAdupV1Fk_n4rz2XV5NUOvIWz67vK8mgn8Eg_nY
```

#### 方法 2: 自动写入 .env 文件

```bash
npm run generate:secrets:write
```

这会自动更新 `.env` 文件中的密钥。

---

## 🔑 密钥说明

### ADMIN_SECRET

**用途**: 管理 API 端点的认证令牌

**使用位置**:
- `POST /admin/generate-puzzle` - 生成谜题
- `GET /admin/candidates` - 获取候选词
- `GET /admin/stats` - 获取统计信息
- `PUT /admin/game-settings/:gameType` - 更新游戏设置

**格式**: Base64 URL-safe 字符串（32 字节）

**示例**:
```bash
ADMIN_SECRET=Y20otwPMvbT3FmZzAbgB4oRhn-eU0LkQgsfqDacv2ic
```

### ENCRYPTION_SECRET

**用途**: 答案加密密钥，用于 AES-256-CBC 加密

**使用位置**:
- 服务端：加密谜题答案
- 客户端：解密谜题答案

**格式**: Base64 URL-safe 字符串（32 字节）

**示例**:
```bash
ENCRYPTION_SECRET=Or4YzAdupV1Fk_n4rz2XV5NUOvIWz67vK8mgn8Eg_nY
```

**重要提示**:
- 客户端和服务端必须使用相同的 `ENCRYPTION_SECRET`
- 更改此密钥后，所有已生成的谜题都需要重新生成

---

## 🛡️ 安全最佳实践

### 1. 密钥强度要求

#### 生产环境（必须）
- ✅ 使用至少 32 字节（256 位）的随机密钥
- ✅ 使用 `npm run generate:secrets` 生成
- ✅ 定期轮换（建议每 90 天）
- ❌ 不要使用示例密钥
- ❌ 不要使用简单字符串

#### 开发/测试环境
- ⚠️ 可以使用示例密钥（便于团队协作）
- ✅ 但仍建议使用生成工具

### 2. 密钥存储

#### ✅ 正确做法

**使用环境变量**:
```bash
# .env 文件（已加入 .gitignore）
ADMIN_SECRET=your-generated-secret
ENCRYPTION_SECRET=your-generated-secret
```

**云部署平台**:
```bash
# Vercel
vercel env add ADMIN_SECRET
vercel env add ENCRYPTION_SECRET

# Railway
railway variables set ADMIN_SECRET=xxx
railway variables set ENCRYPTION_SECRET=xxx

# Docker Compose
# 使用 .env 文件或 secrets
services:
  app:
    environment:
      - ADMIN_SECRET=${ADMIN_SECRET}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
```

#### ❌ 错误做法

```javascript
// ❌ 不要硬编码在代码中
const ADMIN_SECRET = 'my-secret-key';

// ❌ 不要提交到版本控制
git add .env

// ❌ 不要在日志中打印
console.log('Secret:', process.env.ADMIN_SECRET);
```

### 3. 访问控制

#### 限制管理 API 访问

**使用 IP 白名单** (生产环境推荐):
```typescript
// src/middleware/auth.ts
const ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];

export async function requireAuth(c: Context, next: Next) {
  // IP 白名单检查
  if (ALLOWED_IPS.length > 0) {
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    if (!ALLOWED_IPS.includes(clientIP)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  // Token 认证
  const authHeader = c.req.header('Authorization');
  // ... existing auth logic
}
```

**使用 VPN** (生产环境推荐):
- 仅允许通过 VPN 访问管理 API
- 配合 IP 白名单使用

**使用 API Gateway** (生产环境推荐):
- AWS API Gateway
- Google Cloud Endpoints
- Azure API Management

### 4. 密钥轮换

#### 轮换流程

**ADMIN_SECRET 轮换** (相对简单):
```bash
# 1. 生成新密钥
npm run generate:secrets

# 2. 更新服务端 .env
ADMIN_SECRET=new-secret

# 3. 重启服务
npm restart

# 4. 更新所有使用此密钥的客户端/脚本
# （n8n 工作流、CI/CD 脚本等）
```

**ENCRYPTION_SECRET 轮换** (需要重新加密):
```bash
# 1. 准备新密钥
NEW_ENCRYPTION_SECRET=xxx

# 2. 创建数据迁移脚本重新加密所有谜题
# scripts/reencrypt-puzzles.ts

# 3. 运行迁移
npm run reencrypt:puzzles

# 4. 更新服务端和客户端的 ENCRYPTION_SECRET

# 5. 重启服务
```

### 5. 监控与告警

#### 可疑活动检测

```typescript
// 添加认证失败日志
logger.warn({
  path: c.req.path,
  ip: c.req.header('x-forwarded-for'),
  timestamp: new Date(),
}, 'Authentication failed');

// 设置告警（失败次数过多）
if (failedAttempts > 10) {
  await sendAlert('Possible brute force attack detected');
}
```

#### 访问日志

```bash
# 记录所有管理 API 访问
[INFO] Admin API accessed: POST /admin/generate-puzzle
  IP: 192.168.1.100
  User-Agent: n8n/1.0.0
  Timestamp: 2025-11-20T10:30:00Z
```

---

## 📋 环境变量清单

### 必需配置

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=wordle_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure-password

# Redis 连接
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# 安全密钥（生产环境必须更改）
ADMIN_SECRET=<使用 npm run generate:secrets 生成>
ENCRYPTION_SECRET=<使用 npm run generate:secrets 生成>
```

### 可选配置

```bash
# 服务器配置
PORT=3000
NODE_ENV=production

# 日志级别
LOG_LEVEL=info

# IP 白名单（逗号分隔）
ADMIN_ALLOWED_IPS=192.168.1.100,10.0.0.50

# 速率限制
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🔍 安全检查清单

### 部署前检查

- [ ] 使用 `npm run generate:secrets` 生成新密钥
- [ ] 将密钥保存到环境变量（不提交到代码）
- [ ] 确认 `.env` 在 `.gitignore` 中
- [ ] 配置 IP 白名单（可选但推荐）
- [ ] 设置防火墙规则
- [ ] 启用 HTTPS/TLS
- [ ] 配置访问日志
- [ ] 设置告警通知

### 定期检查（每月）

- [ ] 检查异常访问日志
- [ ] 审查 API 访问模式
- [ ] 确认密钥未泄露（GitHub secret scanning）
- [ ] 更新依赖包（`npm audit`）
- [ ] 检查数据库访问权限

### 密钥轮换（每 90 天）

- [ ] 生成新的 ADMIN_SECRET
- [ ] 更新所有使用该密钥的系统
- [ ] 如需轮换 ENCRYPTION_SECRET，执行重新加密
- [ ] 验证新密钥正常工作
- [ ] 记录轮换日期

---

## 🚨 应急响应

### 密钥泄露处理

如果怀疑密钥泄露，立即执行以下步骤：

```bash
# 1. 立即生成新密钥
npm run generate:secrets:write

# 2. 重启服务
pm2 restart wordle-server
# 或
docker-compose restart app

# 3. 检查访问日志，查找可疑活动
grep "401\|403" /var/log/wordle-server.log

# 4. 更新所有客户端密钥
# - n8n 工作流
# - 前端应用
# - CI/CD 脚本

# 5. 通知团队成员

# 6. 记录事件和处理过程
```

### 发现未授权访问

```bash
# 1. 确认可疑 IP
cat /var/log/wordle-server.log | grep "401" | awk '{print $5}'

# 2. 添加到黑名单
# 更新防火墙规则或 Nginx 配置

# 3. 强制轮换密钥（如上）

# 4. 检查数据完整性
psql -d wordle_db -c "SELECT COUNT(*) FROM daily_puzzles;"
```

---

## 📚 相关资源

### 工具

- **密钥生成**: `npm run generate:secrets`
- **密钥测试**: `node test-api.js`
- **安全扫描**: `npm audit`

### 文档

- **API 文档**: `README.md`
- **部署指南**: `QUICK_START.md`
- **n8n 集成**: `N8N_WORKFLOW_GUIDE.md`

### 外部链接

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 💡 常见问题

### Q1: 为什么需要两个不同的密钥？

**A**:
- `ADMIN_SECRET` 用于服务端认证（谁可以管理）
- `ENCRYPTION_SECRET` 用于数据加密（如何保护数据）
- 分离职责，提高安全性

### Q2: 可以使用同一个密钥吗？

**A**: 不推荐。虽然技术上可行，但违反了安全最佳实践：
- 一个密钥泄露会影响所有功能
- 密钥轮换变得复杂
- 无法独立控制访问和加密

### Q3: 密钥长度多少合适？

**A**:
- 最小：32 字节（256 位）
- 推荐：32-64 字节
- `npm run generate:secrets` 默认生成 32 字节

### Q4: 如何在 Docker 中使用密钥？

**A**: 使用 Docker secrets 或环境变量：

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - ADMIN_SECRET=${ADMIN_SECRET}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
    # 或使用 secrets
    secrets:
      - admin_secret
      - encryption_secret

secrets:
  admin_secret:
    file: ./secrets/admin_secret.txt
  encryption_secret:
    file: ./secrets/encryption_secret.txt
```

### Q5: 客户端如何安全获取 ENCRYPTION_SECRET？

**A**:
- **方法 1**: 在客户端构建时注入（推荐）
  ```javascript
  // 在构建配置中
  const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
  ```

- **方法 2**: 通过认证 API 获取（不推荐用于加密密钥）

- **重要**: 加密密钥需要客户端和服务端共享，这是设计决策，适用于验证玩家答案的场景

---

**最后更新**: 2025-11-20
**版本**: 1.1.0
