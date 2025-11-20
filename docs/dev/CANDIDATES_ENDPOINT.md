# /admin/candidates 端点文档

## 概述

`/admin/candidates` 端点专门为 n8n 工作流设计，用于获取随机候选词列表供 AI Agent 筛选。

## 用途

在 n8n 自动化工作流中：
1. **获取候选词** - 从词库中随机选择候选词
2. **AI 筛选** - 将候选词发送给 Claude/GPT 进行内容审核
3. **生成谜题** - 使用 AI 精选的单词调用 `/admin/generate-puzzle`

---

## API 详情

### 端点

```
GET /admin/candidates
```

### 认证

需要 Bearer Token 认证

```http
Authorization: Bearer your-secret-admin-token-change-me-in-production
```

### 查询参数

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `count` | integer | 15 | 1-50 | 返回的候选词数量 |
| `language` | string | 'en' | - | 语言代码 |
| `onlyAnswers` | boolean | true | - | 只返回答案候选词（is_daily_answer=true） |
| `cooldownDays` | integer | 60 | 0-365 | 最少未使用天数（避免重复） |

---

## 请求示例

### 1. 基础请求（默认参数）

```bash
curl -X GET 'http://localhost:3000/admin/candidates' \
  -H 'Authorization: Bearer your-secret-admin-token-change-me-in-production'
```

**响应:**
```json
{
  "candidates": [
    "crane", "slate", "proud", "glove", "chair",
    "music", "brush", "flame", "angel", "beach",
    "cloud", "drink", "eagle", "frost", "grasp"
  ],
  "count": 15,
  "requestedCount": 15,
  "language": "en",
  "onlyAnswers": true,
  "cooldownDays": 60
}
```

### 2. 获取更多候选词（用于充分的 AI 筛选）

```bash
curl -X GET 'http://localhost:3000/admin/candidates?count=30&cooldownDays=30' \
  -H 'Authorization: Bearer your-secret-admin-token-change-me-in-production'
```

**响应:**
```json
{
  "candidates": [
    "words", "array", "with", "30", "random", "words", "..."
  ],
  "count": 30,
  "requestedCount": 30,
  "language": "en",
  "onlyAnswers": true,
  "cooldownDays": 30
}
```

### 3. 降低冷却时间（获取更多可用词）

```bash
curl -X GET 'http://localhost:3000/admin/candidates?count=25&cooldownDays=0' \
  -H 'Authorization: Bearer your-secret-admin-token-change-me-in-production'
```

---

## 响应格式

### 成功响应 (200 OK)

```json
{
  "candidates": ["word1", "word2", ...],
  "count": 15,
  "requestedCount": 15,
  "language": "en",
  "onlyAnswers": true,
  "cooldownDays": 60
}
```

**字段说明:**
- `candidates`: 候选词数组
- `count`: 实际返回的词数量
- `requestedCount`: 请求的词数量
- `language`: 语言代码
- `onlyAnswers`: 是否只返回答案候选词
- `cooldownDays`: 使用的冷却天数

### 错误响应

#### 400 Bad Request - 无效参数

```json
{
  "error": "Invalid Count",
  "message": "Count must be between 1 and 50"
}
```

#### 401 Unauthorized - 未授权

```json
{
  "error": "Unauthorized",
  "message": "Missing Authorization header"
}
```

#### 404 Not Found - 无可用词

```json
{
  "error": "No Candidates Available",
  "message": "No words available matching the criteria",
  "suggestion": "Try reducing cooldownDays or setting onlyAnswers=false"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch candidate words"
}
```

---

## n8n 工作流集成

### 步骤 1: 配置 HTTP Request 节点

**节点配置:**
```
Method: GET
URL: http://localhost:3000/admin/candidates?count=20
Authentication: Header Auth
  Header Name: Authorization
  Header Value: Bearer your-secret-admin-token-change-me-in-production
```

**输出变量:**
```javascript
// 在后续节点中访问候选词
{{ $json.candidates }}        // 候选词数组
{{ $json.count }}             // 词数量
```

### 步骤 2: AI Agent 筛选

将 `{{ $json.candidates }}` 传递给 AI Agent 节点进行筛选。

**AI Prompt 示例:**
```
你是一个专业的单词游戏内容审核专家。从以下候选词中精选 8 个最适合的单词：

候选词列表：{{ $json.candidates }}

筛选标准：
1. 去除冒犯、敏感或不适合的单词
2. 确保单词多样性
3. 平衡难度
4. 优先日常用语

返回 JSON 格式：
{
  "selected": ["word1", "word2", ...],
  "reasoning": "选择理由",
  "rejected": ["被排除的单词"]
}
```

### 步骤 3: 提交谜题

使用 AI 精选的单词调用 `/admin/generate-puzzle`。

---

## 使用建议

### 推荐配置

| 游戏类型 | 需要单词数 | 推荐候选数 | count 参数 |
|---------|-----------|-----------|-----------|
| Wordle | 1 | 5-10 | 10 |
| Dordle | 2 | 8-12 | 12 |
| Quordle | 4 | 12-18 | 15 |
| Octordle | 8 | 20-30 | 25 |

**原因:** 提供更多候选词让 AI 有更大的选择空间，能够筛选出更优质的组合。

### 冷却时间设置

| 使用场景 | cooldownDays | 说明 |
|---------|--------------|------|
| 生产环境 | 60-90 | 确保单词不会频繁重复 |
| 测试环境 | 7-30 | 更快轮换，便于测试 |
| 开发环境 | 0 | 无限制，最大化可用词 |

---

## 性能特性

### 响应时间

- **首次请求**: 10-50ms（数据库查询）
- **后续请求**: 2-10ms（查询优化）

### 数据库优化

- 使用索引加速随机选择
- WHERE 子句过滤已使用的单词
- LIMIT 限制返回数量

### 查询示例

```sql
SELECT word FROM allowed_words
WHERE language = 'en'
  AND is_daily_answer = true
  AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '60 days')
ORDER BY RANDOM()
LIMIT 15;
```

---

## 故障排查

### 问题 1: 返回的单词少于请求数量

**原因:**
- 太多单词最近被使用
- cooldownDays 设置过高

**解决方案:**
```bash
# 降低冷却天数
curl 'http://localhost:3000/admin/candidates?count=30&cooldownDays=30'

# 或设为 0
curl 'http://localhost:3000/admin/candidates?count=30&cooldownDays=0'
```

### 问题 2: 401 Unauthorized

**原因:**
- 缺少 Authorization header
- Token 不正确

**解决方案:**
```bash
# 确保包含正确的 Bearer Token
curl -H 'Authorization: Bearer your-secret-admin-token-change-me-in-production' \
  'http://localhost:3000/admin/candidates'
```

### 问题 3: 404 No Candidates Available

**原因:**
- 词库中没有满足条件的单词
- 所有单词都在冷却期内

**解决方案:**
```bash
# 方案 1: 降低冷却天数
curl 'http://localhost:3000/admin/candidates?cooldownDays=0'

# 方案 2: 包含非答案词
curl 'http://localhost:3000/admin/candidates?onlyAnswers=false'
```

---

## 完整工作流示例

### JavaScript/Node.js

```javascript
const API_BASE = 'http://localhost:3000';
const ADMIN_SECRET = 'your-secret-admin-token-change-me-in-production';

async function generateDailyPuzzle() {
  // 1. 获取候选词
  const candidatesRes = await fetch(
    `${API_BASE}/admin/candidates?count=20`,
    {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    }
  );
  const { candidates } = await candidatesRes.json();

  console.log('获得候选词:', candidates);

  // 2. AI 筛选（这里用简单逻辑模拟）
  const selectedWords = candidates.slice(0, 8);

  console.log('AI 精选单词:', selectedWords);

  // 3. 生成谜题
  const puzzleRes = await fetch(
    `${API_BASE}/admin/generate-puzzle`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}`
      },
      body: JSON.stringify({
        gameType: 'octordle',
        language: 'en',
        answers: selectedWords
      })
    }
  );

  const puzzleData = await puzzleRes.json();
  console.log('谜题创建成功:', puzzleData);
}

generateDailyPuzzle();
```

### Python

```python
import requests

API_BASE = 'http://localhost:3000'
ADMIN_SECRET = 'your-secret-admin-token-change-me-in-production'

headers = {
    'Authorization': f'Bearer {ADMIN_SECRET}',
    'Content-Type': 'application/json'
}

# 1. 获取候选词
response = requests.get(
    f'{API_BASE}/admin/candidates?count=20',
    headers=headers
)
candidates = response.json()['candidates']
print(f'获得候选词: {candidates}')

# 2. AI 筛选
selected = candidates[:8]  # 简单示例
print(f'AI 精选单词: {selected}')

# 3. 生成谜题
puzzle_response = requests.post(
    f'{API_BASE}/admin/generate-puzzle',
    headers=headers,
    json={
        'gameType': 'octordle',
        'language': 'en',
        'answers': selected
    }
)
puzzle = puzzle_response.json()
print(f'谜题创建成功: {puzzle}')
```

---

## 测试

### 运行测试脚本

```bash
# 完整测试
node test-candidates-endpoint.js

# 快速测试
curl -H 'Authorization: Bearer your-secret-admin-token-change-me-in-production' \
  'http://localhost:3000/admin/candidates?count=10' | jq .
```

### 预期结果

```json
{
  "candidates": ["word1", "word2", ..., "word10"],
  "count": 10,
  "requestedCount": 10,
  "language": "en",
  "onlyAnswers": true,
  "cooldownDays": 60
}
```

---

## 相关文档

- **n8n 工作流指南**: `N8N_WORKFLOW_GUIDE.md`
- **完整 API 文档**: `README.md`
- **快速开始**: `QUICK_START.md`
- **测试脚本**: `test-candidates-endpoint.js`

---

## 更新日志

### v1.1.0 (2025-11-20)
- ✅ 新增 `/admin/candidates` 端点
- ✅ 支持自定义候选词数量
- ✅ 支持冷却时间配置
- ✅ 完整的错误处理
- ✅ n8n 工作流集成支持

---

**需要帮助？** 查看 `N8N_WORKFLOW_GUIDE.md` 了解完整的 n8n 集成指南。
