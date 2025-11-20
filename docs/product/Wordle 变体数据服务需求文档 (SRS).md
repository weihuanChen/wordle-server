# Wordle 变体数据服务需求文档 (SRS)

## 1. 引言 (Introduction)

### 1.1 项目目标

构建一个高性能、可扩展的后端服务，为所有基于 5 字母单词的 Wordle 类游戏（如 Wordle, Quordle, Octordle, N-ordle）提供核心数据支撑，包括词库管理和每日谜题调度。

### 1.2 服务范围

本服务专注于数据管理和提供 API 接口，不涉及游戏客户端的 UI 或核心猜测逻辑（如颜色反馈算法）。

### 1.3 技术栈

- **API/运行时**: Hono.js, Docker
- **持久化**: PostgreSQL (Vercel Postgres)
- **缓存**: Redis (Upstash Redis)
- **工作流**: Webhook 集成 (n8n)

## 2. 功能需求 (Functional Requirements - FR)

### FR-1. 词库管理 (Word Pool Management)



| **ID**     | **描述**                                                     | **来源表**      |
| ---------- | ------------------------------------------------------------ | --------------- |
| **FR-1.1** | 服务必须能够高效地查询和验证一个 5 字母单词是否在 `allowed_words` 词库中。 | `allowed_words` |
| **FR-1.2** | 必须支持按**语言** (`language`) 过滤词库。                   | `allowed_words` |
| **FR-1.3** | 必须支持按**是否可作为答案** (`is_daily_answer`) 过滤词库，供 AI 选取答案时使用。 | `allowed_words` |
| **FR-1.4** | 必须提供管理接口（仅限管理员/Webhook 调用），用于批量导入、更新或删除 `allowed_words`。 | `allowed_words` |

### FR-2. 谜题生成与调度 (Puzzle Generation & Scheduling)

| **ID**     | **描述**                                                     | **来源表**      |
| ---------- | ------------------------------------------------------------ | --------------- |
| **FR-2.1** | 服务必须提供一个 Webhook 接口 (`/webhook/generate-daily`)，用于触发每日谜题生成任务。 | N/A             |
| **FR-2.2** | 谜题生成任务必须根据 `game_settings` 表中的配置，为所有已定义的 `game_type`（如 Octordle, Quordle）和所有支持的 `language` 生成答案。 | `game_settings` |
| **FR-2.3** | 生成的谜题答案 (`answers`) 必须经过校验，确保其存在于 `allowed_words` 词库中。 | `allowed_words` |
| **FR-2.4** | 谜题生成成功后，必须将完整的答案集写入 `daily_puzzles` 表。  | `daily_puzzles` |
| **FR-2.5** | 谜题生成成功后，必须将答案 JSON 缓存到 **Redis** 中，并设置 24 小时 TTL。 | Redis           |

### FR-3. 客户端数据获取 (Client Data Retrieval)

| **ID**     | **描述**                                                     | **来源表**                       |
| ---------- | ------------------------------------------------------------ | -------------------------------- |
| **FR-3.1** | 必须提供一个 API 接口 (`/daily/{gameType}/{lang}`)，供客户端获取当天的谜题答案。 | Redis / `daily_puzzles`          |
| **FR-3.2** | 此接口必须遵循“缓存优先”原则：先查 Redis，若未命中，再查 PostgreSQL。 | Redis / `daily_puzzles`          |
| **FR-3.3** | 接口返回的数据应包含谜题答案 (`answers`)、该游戏类型的最大猜测次数 (`max_guesses`) 和任何相关的 `metadata`。 | `daily_puzzles`, `game_settings` |

### FR-4. 配置管理 (Configuration Management)

| **ID**     | **描述**                                                     | **来源表**      |
| ---------- | ------------------------------------------------------------ | --------------- |
| **FR-4.1** | 必须提供一个 Webhook 接口 (`/webhook/update-config`)，用于更新 `game_settings` 表中的配置（如更改 Octordle 的 `max_guesses`）。 | `game_settings` |
| **FR-4.2** | 必须能够从 `game_settings` 表中按 `game_type` 查询配置。     | `game_settings` |

## 3. 非功能需求 (Non-Functional Requirements - NFR)

### NFR-1. 性能 (Performance)

| **ID**      | **描述**                                                     |
| ----------- | ------------------------------------------------------------ |
| **NFR-1.1** | **缓存命中延迟**: 每日谜题获取 API（Redis 命中）的平均响应时间必须**低于 50ms**。 |
| **NFR-1.2** | **数据库查询延迟**: 每日谜题获取 API（Postgres 查询）的平均响应时间必须**低于 150ms**。 |
| **NFR-1.3** | **词汇验证延迟**: 客户端猜测的词汇验证（FR-1.1）必须在**毫秒级**完成。 |

### NFR-2. 可扩展性 (Scalability)

| **ID**      | **描述**                                                     |
| ----------- | ------------------------------------------------------------ |
| **NFR-2.1** | 架构必须能够通过 Docker 轻松横向扩展，以应对高流量。         |
| **NFR-2.2** | 数据库结构必须能够支撑未来扩展到 6 字母 Wordle 或其他变体，主要通过调整 `game_settings` 和 `answers` 数组长度实现。 |

### NFR-3. 安全性 (Security)

| **ID**      | **描述**                                                     |
| ----------- | ------------------------------------------------------------ |
| **NFR-3.1** | 所有 Webhook 接口 (`/webhook/*`) 必须要求有效的 `Authorization: Bearer <SECRET>` 头部进行身份验证。 |
| **NFR-3.2** | API 必须实施速率限制，防止恶意或过度调用。                   |
| **NFR-3.3** | 数据库连接字符串和 API Key 必须使用环境变量和 Docker Secret 进行管理。 |

## 4. 接口规范 (API Specification)

本服务提供以下两个核心 API 组：

### 4.1 客户端 API (Public)

用于游戏客户端获取数据。

| **Endpoint**               | **Method** | **描述**                                       | **示例**             |
| -------------------------- | ---------- | ---------------------------------------------- | -------------------- |
| `/daily/{gameType}/{lang}` | `GET`      | 获取特定游戏类型和语言的今日谜题集。           | `/daily/octordle/en` |
| `/config/{gameType}`       | `GET`      | 获取特定游戏类型的全局配置。                   | `/config/quordle`    |
| `/verify/{lang}/{word}`    | `GET`      | 快速校验玩家输入的单词是否有效（返回布尔值）。 | `/verify/en/WEARY`   |

### 4.2 Webhook API (Private)

用于后台工作流管理。

| **Endpoint**              | **Method** | **描述**                               | **请求体示例**                                   |
| ------------------------- | ---------- | -------------------------------------- | ------------------------------------------------ |
| `/webhook/generate-daily` | `POST`     | 触发所有游戏类型和语言的每日谜题生成。 | `{ "date": "2025-11-20", "regenerate": false }`  |
| `/webhook/update-config`  | `POST`     | 更新游戏配置。                         | `{ "game_type": "octordle", "max_guesses": 14 }` |

## 5. 数据模型 (Data Model)

本服务依赖三个核心 PostgreSQL 表格 (已在 `pg_wordle_master_schema.sql` 中定义)：

1. **`allowed_words`**: 核心词库。
2. **`game_settings`**: 存储游戏配置 (N 个答案, 最大猜测次数)。
3. **`daily_puzzles`**: 存储每日答案，使用 **`TEXT[]` 数组** (`answers`) 和 **`JSONB`** (`metadata`) 字段来支持任意数量的谜题 (N-ordle) 和灵活配置。