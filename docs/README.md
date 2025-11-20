# Wordle Server API

一个高性能的 Wordle 变体游戏词库服务，支持 Octordle、Wordle、Quordle 等多种游戏模式。

## 🎯 功能特性

- **多游戏支持**: Octordle (8词)、Wordle (1词)、Quordle (4词)、Dordle (2词)
- **加密保护**: 答案使用 AES-256 加密，防止客户端作弊
- **高性能缓存**: Redis 缓存优先策略，响应时间 <50ms
- **词库管理**: 16,000+ 五字母单词，智能频率评分
- **多语言支持**: 可扩展至多语言词库
- **RESTful API**: 完整的公共和管理 API

## 📦 技术栈

- **Runtime**: Node.js 20+ (TypeScript 5.7)
- **Framework**: Hono.js 4.6
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Deployment**: Docker + Docker Compose

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <your-repo-url>
cd wordle-server

# 安装依赖
npm install

# 生成安全密钥（自动写入 .env）
npm run generate:secrets:write

# 或手动配置
cp .env.example .env
# 然后编辑 .env 文件
```

**重要**: 生产环境必须使用强随机密钥！详见 [SECURITY.md](SECURITY.md)

### 2. 启动开发环境

```bash
# 使用 Docker Compose 启动 PostgreSQL 和 Redis
docker-compose -f docker-compose.dev.yml up -d

# 等待数据库启动完成（约5秒）
sleep 5

# 运行数据库迁移
npm run migrate:up

# 导入词库数据
npm run import:words

# 启动开发服务器
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 3. 生成第一个谜题

```bash
# 为今天生成 Octordle 谜题
curl -X POST http://localhost:3000/admin/generate-puzzle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-admin-token-change-me-in-production" \
  -d '{
    "gameType": "octordle",
    "language": "en"
  }'
```

### 4. 获取每日谜题

```bash
# 获取今天的 Octordle 谜题
curl http://localhost:3000/daily/octordle/en
```

## 📚 API 文档

### 公共 API (无需认证)

#### 获取每日谜题

```http
GET /daily/{gameType}/{lang}
```

**参数:**
- `gameType`: 游戏类型 (`octordle`, `wordle`, `quordle`, `dordle`)
- `lang`: 语言代码 (默认 `en`)

**响应示例:**
```json
{
  "date": "2025-11-20",
  "gameType": "octordle",
  "language": "en",
  "encryptedAnswers": "U2FsdGVkX1+abc123...",
  "salt": "2025-11-20-octordle-en",
  "answerCount": 8,
  "maxGuesses": 13,
  "metadata": {},
  "_meta": {
    "source": "cache",
    "responseTime": "12ms"
  }
}
```

#### 验证单词

```http
GET /verify/{lang}/{word}
```

**参数:**
- `lang`: 语言代码
- `word`: 要验证的5字母单词

**响应示例:**
```json
{
  "word": "hello",
  "language": "en",
  "valid": true,
  "isAnswerCandidate": false
}
```

#### 获取游戏配置

```http
GET /config/{gameType}
```

**响应示例:**
```json
{
  "gameType": "octordle",
  "answerCount": 8,
  "maxGuesses": 13,
  "config": {
    "difficulty_levels": ["easy", "medium", "hard"],
    "description": "Guess 8 words simultaneously"
  }
}
```

### 管理 API (需要 Bearer Token)

#### 生成谜题

```http
POST /admin/generate-puzzle
Authorization: Bearer <ADMIN_SECRET>
Content-Type: application/json

{
  "date": "2025-11-20",        // 可选，默认今天
  "gameType": "octordle",       // 必填
  "language": "en",             // 可选，默认 en
  "answers": ["word1", ...],    // 可选，手动指定答案
  "regenerate": false           // 可选，是否覆盖已有谜题
}
```

#### 更新游戏设置

```http
PUT /admin/game-settings/{gameType}
Authorization: Bearer <ADMIN_SECRET>
Content-Type: application/json

{
  "answerCount": 8,
  "maxGuesses": 13,
  "config": { "difficulty_levels": ["easy", "medium", "hard"] }
}
```

#### 获取候选词列表

获取随机候选词供 AI 筛选（用于 n8n 工作流）

```http
GET /admin/candidates?count=15&language=en&cooldownDays=60
Authorization: Bearer <ADMIN_SECRET>
```

**参数:**
- `count`: 返回词数量 (默认 15, 最大 50)
- `language`: 语言代码 (默认 'en')
- `onlyAnswers`: 只返回答案候选词 (默认 true)
- `cooldownDays`: 最少未使用天数 (默认 60)

**响应示例:**
```json
{
  "candidates": ["crane", "slate", "proud", "glove", ...],
  "count": 15,
  "requestedCount": 15,
  "language": "en",
  "onlyAnswers": true,
  "cooldownDays": 60
}
```

#### 获取统计信息

```http
GET /admin/stats
Authorization: Bearer <ADMIN_SECRET>
```

## 🔐 客户端解密

客户端需要解密答案来验证玩家猜测。以下是 JavaScript 示例：

```javascript
import CryptoJS from 'crypto-js';

// 从 API 获取谜题数据
const puzzleData = await fetch('/daily/octordle/en').then(r => r.json());

// 解密函数
function decryptAnswers(encryptedData, salt, secretKey) {
  const key = CryptoJS.SHA256(secretKey + salt).toString();
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  return JSON.parse(plaintext);
}

// 使用相同的密钥解密（与服务器 ENCRYPTION_SECRET 相同）
const answers = decryptAnswers(
  puzzleData.encryptedAnswers,
  puzzleData.salt,
  'your-secret-encryption-key-change-me-in-production'
);

console.log(answers); // ["word1", "word2", ..., "word8"]
```

## 🗄️ 数据库管理

### 迁移命令

```bash
# 查看迁移状态
npm run migrate -- list

# 运行所有待执行的迁移
npm run migrate:up

# 回滚最后一个迁移
npm run migrate:down

# 创建新迁移
npm run migrate:create <migration-name>
```

### 数据导入

```bash
# 导入词库数据（会清空现有数据）
npm run import:words
```

## 🐳 Docker 部署

### 开发环境

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 生产环境

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 运行迁移
docker-compose exec app npm run migrate:up

# 导入词库
docker-compose exec app npm run import:words
```

## 🧪 测试

```bash
# 启动开发环境
npm run dev

# 在另一个终端运行测试
npm test
```

测试脚本会验证：
- 健康检查端点
- 词汇验证API
- 每日谜题获取
- 游戏配置查询
- 管理API认证
- 缓存性能

## 📊 数据库结构

### allowed_words (词库表)
- **word** (PK): 5字母单词
- **language**: 语言代码
- **is_daily_answer**: 是否可作为答案
- **popularity_score**: 流行度评分 (0-100)
- **last_used_at**: 上次使用时间

### daily_puzzles (每日谜题表)
- **id** (PK): 自增ID
- **date**: 日期
- **game_type**: 游戏类型
- **language**: 语言
- **answers**: 答案数组
- **encrypted_answers**: 加密后的答案
- **salt**: 加密盐值
- **metadata**: 元数据 (JSONB)

### game_settings (游戏配置表)
- **game_type** (PK): 游戏类型
- **answer_count**: 答案数量
- **max_guesses**: 最大猜测次数
- **config_json**: 额外配置 (JSONB)

## 🔧 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | - |
| `REDIS_URL` | Redis 连接字符串 | - |
| `ADMIN_SECRET` | 管理API认证密钥 | - |
| `ENCRYPTION_SECRET` | 答案加密密钥 | - |
| `NODE_ENV` | 运行环境 | `development` |

⚠️ **重要**: 生产环境必须修改 `ADMIN_SECRET` 和 `ENCRYPTION_SECRET`！

## 📈 性能指标

- **Redis缓存命中**: < 50ms
- **数据库查询**: < 150ms
- **词汇验证**: < 10ms

## 🛣️ Roadmap

- [ ] 多语言词库支持
- [ ] Webhook 集成 (n8n)
- [ ] 难度自动评级
- [ ] 词汇黑名单管理
- [ ] 统计分析面板
- [ ] 速率限制

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题，请通过 [GitHub Issues](https://github.com/your-repo/issues) 联系。
