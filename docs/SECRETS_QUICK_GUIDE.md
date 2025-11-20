# 🔐 密钥生成快速指南

## 一键生成密钥

### 方法 1: 自动生成并写入 .env（推荐）

```bash
npm run generate:secrets:write
```

这会：
- ✅ 生成两个强随机密钥（32 字节）
- ✅ 自动更新 `.env` 文件
- ✅ 保留其他环境变量不变

### 方法 2: 查看生成的密钥

```bash
npm run generate:secrets
```

输出示例：
```
🔐 Wordle 服务密钥生成工具
======================================================================

📋 生成的密钥（请保存到 .env 文件）

# 管理 API 认证密钥
ADMIN_SECRET=5Bi0oc41xxUyuyktf2aWFMbdQiVndDbkNQdTFaeIuQ4

# 答案加密密钥
ENCRYPTION_SECRET=ZicVhSeV6nWgSp9ubL16TyS0YrLFLEs3sOfv0QGlc7E
```

然后手动复制到 `.env` 文件。

---

## 密钥说明

### ADMIN_SECRET
**用途**: Bearer Token 认证
**格式**: Base64 URL-safe（32 字节）
**使用位置**:
```bash
# 管理 API 调用时需要
curl -H "Authorization: Bearer <ADMIN_SECRET>" \
  http://localhost:3000/admin/generate-puzzle
```

### ENCRYPTION_SECRET
**用途**: AES-256 答案加密
**格式**: Base64 URL-safe（32 字节）
**使用位置**:
- 服务端：加密谜题答案
- 客户端：解密谜题答案（需要同步）

---

## 快速命令

```bash
# 生成并写入 .env
npm run generate:secrets:write

# 仅查看生成的密钥
npm run generate:secrets

# 或直接运行脚本
node scripts/generate-secrets.js
node scripts/generate-secrets.js --write
```

---

## 完整设置流程

```bash
# 1. 安装依赖
npm install

# 2. 生成密钥
npm run generate:secrets:write

# 3. 检查 .env 文件
cat .env

# 4. 启动服务
npm run dev
```

---

## 安全提示

⚠️ **切勿使用示例密钥**
```bash
# ❌ 不安全
ADMIN_SECRET=your-secret-admin-token-change-me-in-production

# ✅ 安全
ADMIN_SECRET=5Bi0oc41xxUyuyktf2aWFMbdQiVndDbkNQdTFaeIuQ4
```

✅ **最佳实践**
- 生产环境必须生成新密钥
- 定期轮换密钥（每 90 天）
- 不要提交 `.env` 到 Git
- 使用环境变量管理密钥

📚 **详细文档**: 查看 [SECURITY.md](SECURITY.md)

---

## 常见问题

**Q: 密钥会过期吗？**
A: 不会自动过期，但建议定期轮换。

**Q: 可以自己创建密钥吗？**
A: 可以，但必须足够随机和复杂（至少 32 字节）。推荐使用工具生成。

**Q: 不同环境使用不同密钥吗？**
A: 是的！开发、测试、生产环境应该使用不同的密钥。

**Q: 密钥泄露怎么办？**
A: 立即生成新密钥并重启服务。详见 [SECURITY.md](SECURITY.md#应急响应)

---

**生成命令**: `npm run generate:secrets`
**文档**: [SECURITY.md](SECURITY.md) | [README.md](README.md)
