# Wordle 变体数据服务架构 (Hono + Docker + Postgres + Redis)

## 🎯 目标与范围

本服务旨在成为所有 Wordle 类游戏（包括 Wordle、Quordle、Octordle、以及未来可能的 N-ordle 变体）的通用、高性能的后端数据源。

## 🚀 技术栈概览

- **API 框架**: Hono.js (轻量级、快速的 Web 框架，适合边缘部署)
- **部署**: Docker (实现环境一致性和易于运维)
- **持久化存储**: PostgreSQL (可靠、结构化，用于存储词库和游戏配置)
- **高速缓存**: Redis (用于缓存每日谜题答案和高频数据)
- **工作流集成**: Webhook (用于触发每日题库生成和更新)

## 🔄 数据流和工作流程

### 1. 题库维护（Postgres）

1. **初始导入**: n8n 工作流将清洗后的 5 字母词汇（允许猜测词库）批量导入到 `allowed_words` 表。
2. **AI 生成**:
   - 外部定时任务（或 n8n）触发服务端的 `/webhook/generate-daily` 端点。
   - 服务端 AI 逻辑运行，生成 8 个谜题答案、难度、以及游戏类型。
   - 答案通过校验后，写入 `daily_puzzles` 表。

### 2. 每日谜题获取（Redis + Postgres）

1. **缓存优先**: 当客户端请求 `/daily/{gameType}/{lang}` 时，Hono.js 首先尝试从 **Redis** 中获取当天的答案。
2. **命中缓存**: 如果 Redis 中有数据，立即返回（毫秒级响应）。
3. **缓存未命中**: 从 **PostgreSQL** 的 `daily_puzzles` 表中查询当天的谜题。
4. **写入缓存**: 将查询结果写入 Redis，并设置 24 小时 TTL (Time-To-Live)，然后返回给客户端。

### 3. Webhook API 规范

Webhook 是外部工作流（如 n8n 或定时任务）与本服务交互的入口。



| **Endpoint**              | **Method** | **描述**                                                     | **身份验证**                     |
| ------------------------- | ---------- | ------------------------------------------------------------ | -------------------------------- |
| `/webhook/generate-daily` | `POST`     | **触发每日谜题生成。** 调用 AI 服务，生成并缓存所有支持的 `game_type` 和 `language` 的谜题。 | `Authorization: Bearer <SECRET>` |
| `/webhook/update-config`  | `POST`     | 更新游戏的配置参数（如难度分级标准，最大猜测次数等）。       | `Authorization: Bearer <SECRET>` |

## 📦 通用表结构设计 (PostgreSQL)

为了支持所有 Wordle 变体，核心在于设计一个灵活的 `daily_puzzles` 表，能够存储任意数量（N）的答案和元数据。

### 1. `allowed_words` (允许猜测的词库)

**用途：** 存储所有经过验证的有效 5 字母单词，用于所有游戏的猜测输入验证。

| **字段名**         | **数据类型**    | **约束**                   | **说明**                                                  |
| ------------------ | --------------- | -------------------------- | --------------------------------------------------------- |
| `word`             | `VARCHAR(5)`    | `PRIMARY KEY`              | 5字母单词本身。                                           |
| `language`         | `VARCHAR(10)`   | `NOT NULL`                 | 单词所属语言（en, es, ja, ru）。                          |
| `is_daily_answer`  | `BOOLEAN`       | `NOT NULL`, `DEFAULT TRUE` | 是否允许作为每日谜题的答案。                              |
| `popularity_score` | `NUMERIC(5, 2)` |                            | 词汇的常用程度（0.00 - 100.00），用于 AI 校验和难度分级。 |

### 2. `daily_puzzles` (每日谜题答案池)

**用途：** 存储每天、每种游戏、每种语言的具体答案和配置。这是最关键的表。

| **字段名**     | **数据类型**  | **约束**        | **说明**                                                     |
| -------------- | ------------- | --------------- | ------------------------------------------------------------ |
| `id`           | `SERIAL`      | `PRIMARY KEY`   | 唯一标识符。                                                 |
| `date`         | `DATE`        | `NOT NULL`      | 谜题生效日期。                                               |
| `game_type`    | `VARCHAR(50)` | `NOT NULL`      | 游戏类型（如 'wordle' for 1, 'octordle' for 8, 'quordle' for 4）。 |
| `language`     | `VARCHAR(10)` | `NOT NULL`      | 谜题语言。                                                   |
| **`answers`**  | **`TEXT[]`**  | `NOT NULL`      | **核心字段：一个数组，存储当天的 N 个答案。** (例如 Octordle 存储 8 个单词)。 |
| **`metadata`** | **`JSONB`**   | `NOT NULL`      | **灵活配置：** 存储该谜题集的具体元数据，如：`{ "difficulty": ["easy", "medium", "hard", "hard", ...], "max_guesses": 13 }`。 |
| `created_by`   | `VARCHAR(50)` |                 | 生成者（'AI', 'Manual', 'n8n'）。                            |
| `created_at`   | `TIMESTAMP`   | `DEFAULT NOW()` | 记录创建时间。                                               |

**重要约束：** 为了保证每日谜题的唯一性，需要在 `date`、`game_type` 和 `language` 上创建**复合唯一索引**。

### 3. `game_settings` (游戏配置表)

**用途：** 存储不同游戏类型的全局配置，可由 Webhook 动态更新。

| **字段名**     | **数据类型**  | **约束**      | **说明**                                                    |
| -------------- | ------------- | ------------- | ----------------------------------------------------------- |
| `game_type`    | `VARCHAR(50)` | `PRIMARY KEY` | 游戏类型名称（如 'octordle'）。                             |
| `answer_count` | `INTEGER`     | `NOT NULL`    | 该游戏类型每天需要的答案数量（Octordle = 8, Quordle = 4）。 |
| `max_guesses`  | `INTEGER`     | `NOT NULL`    | 最大允许猜测次数（Octordle = 13）。                         |
| `config_json`  | `JSONB`       |               | 存储其他自定义配置。                                        |