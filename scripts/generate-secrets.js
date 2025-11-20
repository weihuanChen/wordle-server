#!/usr/bin/env node

/**
 * 密钥生成工具
 * 生成安全的随机密钥用于 ADMIN_SECRET 和 ENCRYPTION_SECRET
 */

import crypto from 'crypto';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

function generateHexSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateUUID() {
  return crypto.randomUUID();
}

log('\n🔐 Wordle 服务密钥生成工具', 'cyan');
log('=' .repeat(70), 'cyan');

log('\n📋 生成的密钥（请保存到 .env 文件）\n', 'yellow');

// ADMIN_SECRET - 用于管理 API 认证
const adminSecret = generateSecret(32);
log('# 管理 API 认证密钥', 'blue');
log(`ADMIN_SECRET=${adminSecret}`, 'green');

// ENCRYPTION_SECRET - 用于答案加密
const encryptionSecret = generateSecret(32);
log('\n# 答案加密密钥', 'blue');
log(`ENCRYPTION_SECRET=${encryptionSecret}`, 'green');

// 额外选项
log('\n' + '='.repeat(70), 'cyan');
log('📦 其他密钥格式（可选）\n', 'yellow');

log('# Hex 格式（64 字符）', 'blue');
log(`ADMIN_SECRET_HEX=${generateHexSecret(32)}`, 'cyan');
log(`ENCRYPTION_SECRET_HEX=${generateHexSecret(32)}`, 'cyan');

log('\n# UUID 格式', 'blue');
log(`ADMIN_SECRET_UUID=${generateUUID()}`, 'cyan');

log('\n' + '='.repeat(70), 'cyan');
log('💡 使用说明\n', 'yellow');

log('1. 复制上面的密钥到你的 .env 文件', 'blue');
log('2. 重启服务器使新密钥生效', 'blue');
log('3. 更新客户端的 ENCRYPTION_SECRET（如果已部署）', 'blue');
log('4. 妥善保管密钥，不要提交到版本控制', 'red');

log('\n⚠️  安全提示\n', 'yellow');
log('• 生产环境必须使用强密钥（至少 32 字节）', 'red');
log('• 定期轮换密钥（建议每 90 天）', 'yellow');
log('• 不同环境使用不同密钥', 'yellow');
log('• 将密钥添加到 .gitignore', 'yellow');

log('\n📝 快速设置命令\n', 'yellow');
log('# 自动写入 .env 文件（会覆盖现有密钥）', 'blue');
log(`node scripts/generate-secrets.js --write`, 'cyan');

log('\n' + '='.repeat(70), 'cyan');

// 如果使用 --write 参数，写入 .env 文件
if (process.argv.includes('--write')) {
  const fs = await import('fs');
  const path = await import('path');

  const envPath = path.resolve(process.cwd(), '.env');

  try {
    let envContent = '';

    // 读取现有 .env 文件
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      log('\n📝 更新现有 .env 文件...', 'yellow');
    } else {
      log('\n📝 创建新的 .env 文件...', 'yellow');
    }

    // 更新或添加密钥
    const updateOrAdd = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };

    envContent = updateOrAdd(envContent, 'ADMIN_SECRET', adminSecret);
    envContent = updateOrAdd(envContent, 'ENCRYPTION_SECRET', encryptionSecret);

    fs.writeFileSync(envPath, envContent.trim() + '\n');

    log('✅ 密钥已写入 .env 文件', 'green');
    log(`📄 文件位置: ${envPath}`, 'blue');

  } catch (error) {
    log(`\n❌ 写入失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

log('\n');
