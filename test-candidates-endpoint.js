#!/usr/bin/env node

/**
 * 测试 /admin/candidates 端点
 * 完整演示 n8n 工作流的第一步：获取候选词
 */

const API_BASE = 'http://localhost:3000';
const ADMIN_SECRET = 'your-secret-admin-token-change-me-in-production';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCandidatesEndpoint() {
  log('\n🧪 测试 /admin/candidates 端点\n', 'cyan');

  const tests = [
    {
      name: '默认参数（15 个候选词）',
      url: `${API_BASE}/admin/candidates`,
      expectedCount: 15,
    },
    {
      name: '自定义数量（20 个候选词）',
      url: `${API_BASE}/admin/candidates?count=20`,
      expectedCount: 20,
    },
    {
      name: '大量候选词（30 个，用于充分的 AI 筛选）',
      url: `${API_BASE}/admin/candidates?count=30&cooldownDays=30`,
      expectedCount: 30,
    },
    {
      name: '最小冷却时间（获取更多可用词）',
      url: `${API_BASE}/admin/candidates?count=25&cooldownDays=0`,
      expectedCount: 25,
    },
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    log(`\n${'='.repeat(70)}`, 'cyan');
    log(`测试: ${test.name}`, 'yellow');
    log(`URL: ${test.url}`, 'blue');

    try {
      const startTime = Date.now();
      const response = await fetch(test.url, {
        headers: {
          Authorization: `Bearer ${ADMIN_SECRET}`,
        },
      });
      const responseTime = Date.now() - startTime;

      const data = await response.json();

      if (response.ok && data.count === test.expectedCount) {
        log(`✅ 测试通过`, 'green');
        log(`响应时间: ${responseTime}ms`, 'blue');
        log(`获得候选词: ${data.count}/${data.requestedCount}`, 'blue');
        log(`语言: ${data.language}`, 'blue');
        log(`冷却天数: ${data.cooldownDays}`, 'blue');

        // 显示前 5 个单词作为样本
        log(`\n样本单词:`, 'cyan');
        data.candidates.slice(0, 5).forEach((word, i) => {
          log(`  ${i + 1}. ${word.toUpperCase()}`, 'yellow');
        });

        passedTests++;
      } else {
        log(`❌ 测试失败`, 'red');
        log(`期望: ${test.expectedCount} 个单词`, 'red');
        log(`实际: ${data.count || 0} 个单词`, 'red');
        console.log('\n响应:', data);
        failedTests++;
      }
    } catch (error) {
      log(`❌ 测试失败: ${error.message}`, 'red');
      failedTests++;
    }
  }

  // 测试错误处理
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`测试: 错误处理（count > 50）`, 'yellow');

  try {
    const response = await fetch(`${API_BASE}/admin/candidates?count=100`, {
      headers: {
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
    });
    const data = await response.json();

    if (!response.ok && data.error === 'Invalid Count') {
      log(`✅ 正确拒绝无效请求`, 'green');
      log(`错误消息: ${data.message}`, 'blue');
      passedTests++;
    } else {
      log(`❌ 应该返回错误`, 'red');
      failedTests++;
    }
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    failedTests++;
  }

  // 测试认证
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`测试: 认证检查（无 token）`, 'yellow');

  try {
    const response = await fetch(`${API_BASE}/admin/candidates`);
    const data = await response.json();

    if (!response.ok && data.error === 'Unauthorized') {
      log(`✅ 正确拒绝未授权请求`, 'green');
      passedTests++;
    } else {
      log(`❌ 应该返回 401 错误`, 'red');
      failedTests++;
    }
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    failedTests++;
  }

  // 完整工作流演示
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`📋 完整 n8n 工作流演示`, 'cyan');
  log(`${'='.repeat(70)}`, 'cyan');

  try {
    // 步骤 1: 获取候选词
    log(`\n1️⃣ 获取候选词列表`, 'yellow');
    const candidatesResponse = await fetch(`${API_BASE}/admin/candidates?count=15`, {
      headers: {
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
    });
    const candidatesData = await candidatesResponse.json();
    log(`✅ 获得 ${candidatesData.count} 个候选词`, 'green');

    // 步骤 2: 模拟 AI 筛选（实际中由 Claude/GPT 完成）
    log(`\n2️⃣ AI 筛选单词（模拟）`, 'yellow');
    const aiSelectedWords = candidatesData.candidates.slice(0, 8);
    log(`✅ AI 精选了 ${aiSelectedWords.length} 个单词`, 'green');
    log(`精选单词: ${aiSelectedWords.join(', ')}`, 'cyan');

    // 步骤 3: 提交谜题
    log(`\n3️⃣ 提交每日谜题`, 'yellow');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2); // 后天
    const puzzleDate = tomorrow.toISOString().split('T')[0];

    const puzzleResponse = await fetch(`${API_BASE}/admin/generate-puzzle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
      body: JSON.stringify({
        gameType: 'octordle',
        language: 'en',
        date: puzzleDate,
        answers: aiSelectedWords,
      }),
    });

    const puzzleData = await puzzleResponse.json();

    if (puzzleResponse.ok) {
      log(`✅ 谜题创建成功`, 'green');
      log(`谜题 ID: ${puzzleData.puzzle.id}`, 'blue');
      log(`日期: ${puzzleData.puzzle.date}`, 'blue');
      log(`单词数量: ${puzzleData.puzzle.answerCount}`, 'blue');

      log(`\n🎉 完整工作流测试成功！`, 'green');
    } else {
      log(`⚠️  谜题创建失败（可能已存在）`, 'yellow');
      log(`消息: ${puzzleData.message || puzzleData.error}`, 'yellow');
    }

  } catch (error) {
    log(`❌ 工作流演示失败: ${error.message}`, 'red');
  }

  // 总结
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`📊 测试总结`, 'cyan');
  log(`${'='.repeat(70)}`, 'cyan');
  log(`\n通过: ${passedTests}`, 'green');
  log(`失败: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`总计: ${passedTests + failedTests}`, 'blue');
  log(`成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`, 'yellow');

  if (failedTests === 0) {
    log(`🎉 所有测试通过！\n`, 'green');
    log(`✨ /admin/candidates 端点已准备好用于 n8n 工作流\n`, 'cyan');
  }
}

// 运行测试
testCandidatesEndpoint().catch((error) => {
  log(`\n💥 致命错误: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
