# n8n 工作流集成指南

## 概述

这份指南将帮助你在 n8n 中设置自动化工作流，使用 AI Agent 精选单词，过滤冒犯性词汇，并自动生成每日谜题。

---

## ✅ 当前 API 支持情况

你的需求**完全支持**！API 提供以下功能：

### 1. 接受自定义单词列表 ✅
```http
POST /admin/generate-puzzle
Content-Type: application/json
Authorization: Bearer your-secret-admin-token-change-me-in-production

{
  "gameType": "octordle",
  "language": "en",
  "answers": ["hello", "world", "crane", "stale", "audio", "house", "lucky", "brave"],
  "date": "2025-11-21"
}
```

### 2. 单词验证 ✅
- 验证单词长度（必须 5 个字母）
- 验证单词数量（Octordle = 8，Wordle = 1，等等）
- 自动转换为小写

### 3. 自动加密 ✅
- 服务器自动加密答案
- 生成对应的 salt
- 返回加密后的数据供客户端使用

### 4. 缓存管理 ✅
- 自动缓存到 Redis
- 支持 `regenerate: true` 参数覆盖现有谜题

---

## n8n 工作流设计

### 工作流架构

```
┌─────────────────┐
│  1. Schedule    │  每天固定时间触发
│   (Cron Trigger)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. HTTP Request│  获取候选单词
│  (GET Random)   │  从你的 API 随机获取 12-15 个候选词
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. AI Agent    │  Claude/GPT 过滤
│  (Filter Words) │  - 去除冒犯性词汇
└────────┬────────┘  - 确保单词多样性
         │           - 评估难度平衡
         ▼
┌─────────────────┐
│  4. Function    │  选取最终 8 个单词
│  (Select Final) │  根据 AI 推荐
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. HTTP Request│  提交谜题
│  (POST Puzzle)  │  调用 /admin/generate-puzzle
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  6. Notification│  发送成功通知
│  (Optional)     │  Slack/Email/Discord
└─────────────────┘
```

---

## 详细节点配置

### 节点 1: Schedule Trigger (定时触发器)

**配置**:
```
触发类型: Cron
Cron 表达式: 0 0 * * *  (每天午夜)
或: 0 6 * * *  (每天早上 6 点)
时区: Asia/Shanghai
```

---

### 节点 2: HTTP Request - 获取候选单词

**目的**: 从词库随机获取更多候选词供 AI 筛选

**方法 A**: 使用现有的随机选择（通过调用不带 answers 参数）
```
Method: POST
URL: http://localhost:3000/admin/generate-puzzle
Authentication: Header Auth
  Header Name: Authorization
  Header Value: Bearer your-secret-admin-token-change-me-in-production
Body:
{
  "gameType": "octordle",
  "language": "en",
  "date": "{{ DateTime.now().plus({days: 1}).toFormat('yyyy-MM-dd') }}"
}
```

**方法 B**: 创建新的 API 端点获取候选词列表（推荐）

如果你想要更多控制，我可以为你添加一个新端点：
```
GET /admin/candidates?count=15&language=en
```

返回 15 个随机候选词供 AI 筛选。

---

### 节点 3: AI Agent - 过滤和精选单词

**AI Provider**: Claude (Anthropic) / GPT-4 (OpenAI)

**Prompt 模板**:
```
你是一个专业的单词游戏内容审核专家。我需要你从以下候选单词中精选出 8 个最适合作为 Wordle/Octordle 游戏答案的单词。

候选单词列表：
{{ $json.candidateWords }}

筛选标准：
1. 必须去除任何可能冒犯、敏感或不适合的单词
2. 确保单词多样性（避免相似的字母组合）
3. 平衡难度（包含常见词和稍难的词）
4. 优先选择日常用语
5. 确保所有单词都是 5 个字母的有效英文单词

请以 JSON 格式返回你精选的 8 个单词：

{
  "selected": ["word1", "word2", "word3", "word4", "word5", "word6", "word7", "word8"],
  "reasoning": "简短说明选择理由",
  "rejected": ["被排除的单词和原因"]
}

只返回 JSON，不要其他说明。
```

**输出解析**: 使用 JSON Parse 节点提取 `selected` 数组

---

### 节点 4: Function - 数据转换

**代码**:
```javascript
// 从 AI 响应中提取单词列表
const aiResponse = $input.item.json;
let selectedWords;

// 尝试解析 AI 的响应
try {
  if (typeof aiResponse === 'string') {
    const parsed = JSON.parse(aiResponse);
    selectedWords = parsed.selected;
  } else if (aiResponse.selected) {
    selectedWords = aiResponse.selected;
  } else {
    throw new Error('Invalid AI response format');
  }
} catch (error) {
  // 如果解析失败，使用默认的候选词
  console.error('Failed to parse AI response:', error);
  selectedWords = $input.item.json.candidateWords.slice(0, 8);
}

// 验证单词
if (!Array.isArray(selectedWords) || selectedWords.length !== 8) {
  throw new Error(`Expected 8 words, got ${selectedWords?.length || 0}`);
}

// 转换为小写并清理
selectedWords = selectedWords.map(w => w.toLowerCase().trim());

// 返回用于下一步的数据
return {
  json: {
    answers: selectedWords,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // 明天的日期
    gameType: 'octordle',
    language: 'en',
    regenerate: false,
    aiReasoning: aiResponse.reasoning || 'N/A'
  }
};
```

---

### 节点 5: HTTP Request - 提交谜题

**配置**:
```
Method: POST
URL: http://localhost:3000/admin/generate-puzzle
Authentication: Header Auth
  Header Name: Authorization
  Header Value: Bearer your-secret-admin-token-change-me-in-production

Body:
{
  "gameType": "{{ $json.gameType }}",
  "language": "{{ $json.language }}",
  "date": "{{ $json.date }}",
  "answers": {{ $json.answers }},
  "regenerate": {{ $json.regenerate }}
}

Response Format: JSON
```

**期望响应**:
```json
{
  "success": true,
  "puzzle": {
    "id": 2,
    "date": "2025-11-21",
    "gameType": "octordle",
    "language": "en",
    "answerCount": 8,
    "encryptedAnswers": "...",
    "salt": "2025-11-21-octordle-en"
  },
  "message": "Puzzle created successfully"
}
```

---

### 节点 6: Notification (可选)

**Slack 通知示例**:
```
Method: POST
URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL

Body:
{
  "text": "✅ Daily Octordle puzzle generated!",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Date:* {{ $json.date }}\n*Words:* {{ $json.answers.join(', ').toUpperCase() }}\n*AI Reasoning:* {{ $json.aiReasoning }}"
      }
    }
  ]
}
```

---

## 测试工作流

### 手动测试 Webhook

你可以先手动测试 API 是否接受 AI 精选的单词：

```bash
# 测试脚本
curl -X POST http://localhost:3000/admin/generate-puzzle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-admin-token-change-me-in-production" \
  -d '{
    "gameType": "octordle",
    "language": "en",
    "date": "2025-11-21",
    "answers": ["crane", "slate", "proud", "glove", "chair", "music", "brush", "flame"]
  }'
```

**期望响应**:
```json
{
  "success": true,
  "puzzle": {
    "id": 2,
    "date": "2025-11-21T00:00:00.000Z",
    "gameType": "octordle",
    "language": "en",
    "answerCount": 8,
    "encryptedAnswers": "U2FsdGVkX1...",
    "salt": "2025-11-21-octordle-en"
  },
  "message": "Puzzle created successfully"
}
```

---

## 需要添加的新 API 端点（推荐）

为了让 n8n 工作流更方便，我建议添加以下端点：

### GET /admin/candidates

**用途**: 获取随机候选词列表供 AI 筛选

**参数**:
- `count`: 数量 (默认 15)
- `language`: 语言 (默认 'en')
- `onlyAnswers`: 只返回答案候选词 (默认 true)

**示例**:
```bash
curl "http://localhost:3000/admin/candidates?count=15&language=en" \
  -H "Authorization: Bearer your-secret-admin-token-change-me-in-production"
```

**响应**:
```json
{
  "candidates": [
    "crane", "slate", "proud", "glove", "chair",
    "music", "brush", "flame", "angel", "beach",
    "cloud", "drink", "eagle", "frost", "grasp"
  ],
  "count": 15,
  "language": "en"
}
```

需要我为你实现这个端点吗？

---

## n8n 工作流 JSON 模板

我可以为你创建一个完整的 n8n 工作流 JSON 文件，你可以直接导入到 n8n 中。需要我生成吗？

---

## 常见问题

### Q1: 如果 AI 返回的单词少于 8 个怎么办？

**方案 A**: 在 Function 节点中添加后备逻辑，从原始候选词中补充：
```javascript
if (selectedWords.length < 8) {
  const needed = 8 - selectedWords.length;
  const backup = candidateWords
    .filter(w => !selectedWords.includes(w))
    .slice(0, needed);
  selectedWords = [...selectedWords, ...backup];
}
```

**方案 B**: 配置错误处理节点，发送警报并使用随机生成

### Q2: 如何处理重复的日期？

使用 `regenerate: true` 参数：
```json
{
  "regenerate": true,
  "date": "2025-11-21",
  "answers": [...]
}
```

这会覆盖现有的谜题。

### Q3: 如何确保单词在词库中？

API 会自动验证：
- 如果单词不在 `allowed_words` 表中，会返回错误
- 建议在 AI Prompt 中明确要求使用常见英文单词

### Q4: 可以为不同游戏类型设置不同的工作流吗？

可以！只需更改 `gameType` 参数：
- `"wordle"` - 1 个单词
- `"dordle"` - 2 个单词
- `"quordle"` - 4 个单词
- `"octordle"` - 8 个单词

---

## 下一步

1. ✅ **测试手动提交** - 使用上面的 curl 命令测试
2. 🔄 **创建 n8n 工作流** - 按照上面的节点配置
3. 🔄 **配置 AI Agent** - 使用 Claude 或 GPT-4
4. 🔄 **设置定时任务** - 配置每日自动运行
5. 🔄 **添加监控** - 设置失败通知

需要我：
1. 添加 `/admin/candidates` 端点？
2. 生成完整的 n8n 工作流 JSON？
3. 创建更详细的 AI Prompt 模板？

请告诉我你需要哪些帮助！
