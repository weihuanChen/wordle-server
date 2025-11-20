# 🚀 快速启动指南

## 项目概述

这是一个为 Wordle 类型游戏（Octordle、Wordle、Quordle、Dordle）提供词库服务的后端 API。

### 主要特性
- ✅ 支持多种游戏类型（Octordle、Wordle、Quordle、Dordle）
- ✅ 13,415 个英文单词词库
- ✅ AES-256-CBC 答案加密
- ✅ Redis 缓存层（< 50ms 响应）
- ✅ PostgreSQL 数据库
- ✅ RESTful API
- ✅ Bearer Token 认证

---

## 环境要求

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

---

## 一键启动

### 1. 启动数据库服务

```bash
# 启动 PostgreSQL 和 Redis
docker-compose -f docker-compose.dev.yml up -d

# 验证服务状态
docker-compose -f docker-compose.dev.yml ps
```

### 2. 配置环境变量

#### 生成安全密钥

**重要**: 生产环境必须使用强随机密钥！

```bash
# 生成新密钥并自动写入 .env
npm run generate:secrets:write

# 或者查看生成的密钥（手动复制）
npm run generate:secrets
```

#### 手动配置 .env 文件

如果需要手动配置，编辑 `.env` 文件:
```bash
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wordle_db
REDIS_URL=redis://localhost:6379

# 使用 npm run generate:secrets 生成以下密钥
ADMIN_SECRET=<生成的密钥>
ENCRYPTION_SECRET=<生成的密钥>

# Database connection (for migrations)
PGHOST=localhost
PGPORT=5432
PGDATABASE=wordle_db
PGUSER=postgres
PGPASSWORD=postgres
```

**安全提示**:
- ⚠️ 不要使用示例密钥 `your-secret-admin-token-change-me-in-production`
- ✅ 使用 `npm run generate:secrets` 生成强随机密钥
- 📚 详细安全指南请查看 `SECURITY.md`

### 3. 初始化数据库

```bash
# 创建数据库
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE wordle_db;"

# 运行迁移
PGHOST=localhost PGPORT=5432 PGDATABASE=wordle_db PGUSER=postgres PGPASSWORD=postgres npm run migrate:up

# 导入词库数据 (13,415 词)
PGHOST=localhost PGPORT=5432 PGDATABASE=wordle_db PGUSER=postgres PGPASSWORD=postgres DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wordle_db npm run import:words
```

### 4. 启动开发服务器

```bash
PORT=3000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wordle_db REDIS_URL=redis://localhost:6379 ADMIN_SECRET=your-secret-admin-token-change-me-in-production ENCRYPTION_SECRET=your-secret-encryption-key-change-me-in-production npm run dev
```

服务器将在 http://localhost:3000 启动

### 5. 生成第一个谜题

```bash
curl -X POST http://localhost:3000/admin/generate-puzzle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-admin-token-change-me-in-production" \
  -d '{
    "gameType": "octordle",
    "language": "en"
  }'
```

### 6. 运行测试

```bash
# 运行自动化测试
node test-api.js

# 或者在浏览器中打开测试页面
open test-decrypt.html
```

---

## API 使用示例

### 获取每日谜题

```bash
curl http://localhost:3000/daily/octordle/en
```

响应:
```json
{
  "date": "2025-11-20",
  "gameType": "octordle",
  "language": "en",
  "encryptedAnswers": "...",
  "salt": "2025-11-20-octordle-en",
  "answerCount": 8,
  "maxGuesses": 13
}
```

### 验证单词

```bash
curl http://localhost:3000/verify/en/hello
```

响应:
```json
{
  "word": "hello",
  "language": "en",
  "valid": true,
  "isAnswerCandidate": true
}
```

### 获取游戏配置

```bash
curl http://localhost:3000/config/octordle
```

响应:
```json
{
  "gameType": "octordle",
  "answerCount": 8,
  "maxGuesses": 13,
  "config": {
    "description": "Guess 8 words simultaneously",
    "difficulty_levels": ["easy", "medium", "hard"]
  }
}
```

### 获取统计信息（需要认证）

```bash
curl http://localhost:3000/admin/stats \
  -H "Authorization: Bearer your-secret-admin-token-change-me-in-production"
```

响应:
```json
{
  "words": {
    "total": 13415,
    "answerCandidates": 3500,
    "guessOnly": 9915
  },
  "cache": {
    "totalKeys": 2,
    "puzzleKeys": 1,
    "memoryUsed": "953.53K"
  }
}
```

---

## 客户端解密示例

### JavaScript/Browser

```javascript
// 使用 crypto-js 库
const ENCRYPTION_SECRET = 'your-secret-encryption-key-change-me-in-production';

function generateEncryptionKey(salt) {
  return CryptoJS.SHA256(ENCRYPTION_SECRET + salt).toString();
}

function decryptAnswers(encryptedData, salt) {
  const key = generateEncryptionKey(salt);
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  return JSON.parse(plaintext);
}

// 使用
const response = await fetch('http://localhost:3000/daily/octordle/en');
const data = await response.json();
const answers = decryptAnswers(data.encryptedAnswers, data.salt);
console.log(answers); // ["SASSY", "HALES", "APRIL", ...]
```

### Node.js

```javascript
import CryptoJS from 'crypto-js';

const ENCRYPTION_SECRET = 'your-secret-encryption-key-change-me-in-production';

function decryptAnswers(encryptedData, salt) {
  const key = CryptoJS.SHA256(ENCRYPTION_SECRET + salt).toString();
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
}
```

---

## 目录结构

```
wordle-server/
├── src/
│   ├── index.ts              # 主入口文件
│   ├── lib/
│   │   ├── crypto.ts         # 加密工具
│   │   ├── queries.ts        # 数据库查询
│   │   ├── cache.ts          # Redis 缓存
│   │   ├── db.ts            # 数据库连接
│   │   ├── redis.ts         # Redis 连接
│   │   └── logger.ts        # 日志工具
│   ├── routes/
│   │   ├── public.ts        # 公共 API 路由
│   │   └── admin.ts         # 管理 API 路由
│   └── middleware/
│       └── auth.ts          # 认证中间件
├── migrations/              # 数据库迁移文件
├── scripts/                # 辅助脚本
│   └── import-words.ts     # 词库导入脚本
├── data/                   # 词库数据文件
│   ├── puzzle_candidates.json  # 3,500 个答案候选词
│   └── valid_guesses.json     # 12,973 个有效猜测词
├── test-api.js            # API 测试脚本
├── test-decrypt.html      # 浏览器测试页面
└── TEST_RESULTS.md        # 测试结果报告
```

---

## 数据库架构

### allowed_words (词库表)
- `word` - 单词 (主键)
- `language` - 语言代码
- `is_daily_answer` - 是否可作为答案
- `popularity_score` - 流行度评分 (0-100)
- `last_used_at` - 上次使用时间

### daily_puzzles (每日谜题表)
- `id` - 自增主键
- `date` - 日期
- `game_type` - 游戏类型
- `language` - 语言
- `answers` - 答案数组 (明文，仅后端使用)
- `encrypted_answers` - 加密答案 (发送给客户端)
- `salt` - 加密盐
- `metadata` - 元数据 (JSONB)

### game_settings (游戏配置表)
- `game_type` - 游戏类型 (主键)
- `answer_count` - 答案数量
- `max_guesses` - 最大猜测次数
- `config_json` - 游戏配置 (JSONB)

---

## 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| Redis 响应时间 | < 50ms | 0-11ms | ✅ |
| PostgreSQL 响应时间 | < 150ms | 2-31ms | ✅ |
| 词库大小 | > 10,000 | 13,415 | ✅ |
| 缓存命中率 | > 90% | ~95% | ✅ |

---

## 常用命令

### 数据库管理

```bash
# 创建新迁移
npm run migrate:create <migration-name>

# 执行迁移
npm run migrate:up

# 回滚迁移
npm run migrate:down

# 导入词库
npm run import:words
```

### 服务器管理

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### Docker 管理

```bash
# 启动所有服务
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 停止服务
docker-compose -f docker-compose.dev.yml down

# 重启服务
docker-compose -f docker-compose.dev.yml restart
```

### 测试

```bash
# 运行 API 测试
node test-api.js

# 查看测试结果
cat TEST_RESULTS.md
```

---

## 故障排查

### 问题：数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 检查数据库是否存在
PGPASSWORD=postgres psql -h localhost -U postgres -l
```

### 问题：Redis 连接失败

```bash
# 检查 Redis 是否运行
docker ps | grep redis

# 测试 Redis 连接
redis-cli -h localhost -p 6379 ping
```

### 问题：端口被占用

```bash
# 查找占用端口的进程
lsof -ti:3000

# 杀死进程
lsof -ti:3000 | xargs kill -9
```

---

## 下一步

### 立即可做
1. ✅ 开始使用 API
2. ✅ 生成每日谜题
3. ✅ 集成到你的前端应用
4. 🔄 配置 n8n 工作流自动生成谜题

### 未来功能
1. 添加更多语言支持
2. 实现谜题难度评分
3. 添加用户统计功能
4. 实现主题分类

---

## 技术支持

### 文档
- `README.md` - 完整文档
- `TEST_RESULTS.md` - 测试报告
- `docs/ARCHITECTURE.md` - 架构说明

### 测试工具
- `test-api.js` - 自动化测试脚本
- `test-decrypt.html` - 浏览器测试界面

---

**版本**: v1.0.0
**最后更新**: 2025-11-20
