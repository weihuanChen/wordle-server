#!/usr/bin/env node

/**
 * n8n 工作流模拟测试脚本
 * 模拟完整的 AI 筛选 + 谜题生成流程
 */

const API_BASE = 'http://localhost:3000';
const ADMIN_SECRET = 'your-secret-admin-token-change-me-in-production';

// 模拟从词库获取的候选词
const mockCandidates = [
  'crane', 'slate', 'proud', 'glove', 'chair',
  'music', 'brush', 'flame', 'angel', 'beach',
  'cloud', 'drink', 'eagle', 'frost', 'grasp'
];

// 模拟 AI 筛选后的结果（实际会调用 Claude/GPT）
const mockAIResponse = {
  selected: ['crane', 'slate', 'proud', 'glove', 'chair', 'music', 'brush', 'flame'],
  reasoning: '这8个单词涵盖了不同的词汇类别（动物、自然、物品、动作），字母组合多样，难度适中，没有冒犯性内容。',
  rejected: [
    'angel - 可能涉及宗教敏感',
    'drink - 过于简单',
    '其他词汇保留作为后备'
  ]
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  log('\n' + '='.repeat(70), 'cyan');
}

async function simulateN8nWorkflow() {
  log('🤖 模拟 n8n AI 工作流测试', 'cyan');
  log('这个脚本模拟完整的 n8n 工作流：获取候选词 → AI 筛选 → 提交谜题\n', 'blue');

  try {
    // 步骤 1: 模拟获取候选词
    separator();
    log('步骤 1: 获取候选词', 'yellow');
    log(`候选词数量: ${mockCandidates.length}`, 'blue');
    log(`候选词列表: ${mockCandidates.join(', ')}`, 'blue');

    // 步骤 2: 模拟 AI 筛选
    separator();
    log('步骤 2: AI 筛选单词 (模拟)', 'yellow');
    log('\n🤖 AI 分析中...', 'magenta');

    // 模拟思考延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    log('\n✅ AI 筛选完成', 'green');
    log(`\n精选单词 (${mockAIResponse.selected.length}):`, 'blue');
    mockAIResponse.selected.forEach((word, i) => {
      log(`  ${i + 1}. ${word.toUpperCase()}`, 'green');
    });

    log(`\n📝 AI 选择理由:`, 'blue');
    log(`${mockAIResponse.reasoning}`, 'cyan');

    log(`\n❌ 被排除的单词:`, 'blue');
    mockAIResponse.rejected.forEach(item => {
      log(`  • ${item}`, 'yellow');
    });

    // 步骤 3: 准备数据
    separator();
    log('步骤 3: 准备 API 请求数据', 'yellow');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const puzzleData = {
      gameType: 'octordle',
      language: 'en',
      date: dateStr,
      answers: mockAIResponse.selected,
      regenerate: false
    };

    log('\n请求数据:', 'blue');
    console.log(JSON.stringify(puzzleData, null, 2));

    // 步骤 4: 提交到 API
    separator();
    log('步骤 4: 提交谜题到 API', 'yellow');
    log('\n📡 发送请求...', 'blue');

    const response = await fetch(`${API_BASE}/admin/generate-puzzle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}`
      },
      body: JSON.stringify(puzzleData)
    });

    const result = await response.json();

    if (response.ok) {
      log('\n✅ 谜题生成成功！', 'green');

      separator();
      log('📊 谜题详情', 'cyan');
      log(`\n谜题 ID: ${result.puzzle.id}`, 'blue');
      log(`日期: ${result.puzzle.date}`, 'blue');
      log(`游戏类型: ${result.puzzle.gameType}`, 'blue');
      log(`语言: ${result.puzzle.language}`, 'blue');
      log(`单词数量: ${result.puzzle.answerCount}`, 'blue');
      log(`Salt: ${result.puzzle.salt}`, 'blue');
      log(`\n加密答案 (前50字符):`, 'blue');
      log(result.puzzle.encryptedAnswers.substring(0, 50) + '...', 'cyan');

      // 步骤 5: 验证谜题
      separator();
      log('步骤 5: 验证生成的谜题', 'yellow');
      log('\n📡 获取谜题...', 'blue');

      const verifyResponse = await fetch(
        `${API_BASE}/daily/${puzzleData.gameType}/${puzzleData.language}`
      );
      const verifyData = await verifyResponse.json();

      log('\n✅ 谜题可以正常访问', 'green');
      log(`数据源: ${verifyData._meta.source}`, 'blue');
      log(`响应时间: ${verifyData._meta.responseTime}`, 'blue');

      // 完成总结
      separator();
      log('✨ 工作流测试完成', 'green');
      log('\n📋 总结:', 'cyan');
      log(`  • 候选词数: ${mockCandidates.length}`, 'blue');
      log(`  • AI 精选词数: ${mockAIResponse.selected.length}`, 'blue');
      log(`  • 谜题 ID: ${result.puzzle.id}`, 'blue');
      log(`  • 状态: ${response.ok ? '✅ 成功' : '❌ 失败'}`, response.ok ? 'green' : 'red');

      separator();
      log('\n🎯 下一步:', 'yellow');
      log('1. 在 n8n 中导入 n8n-workflow-example.json', 'blue');
      log('2. 配置 Claude API 凭证', 'blue');
      log('3. 设置定时触发器（建议每天早上6点）', 'blue');
      log('4. 测试运行工作流', 'blue');
      log('5. 启用自动化\n', 'blue');

    } else {
      log('\n❌ 谜题生成失败', 'red');
      log('\n错误详情:', 'red');
      console.error(result);
    }

  } catch (error) {
    log('\n💥 测试过程中发生错误', 'red');
    console.error(error);
  }
}

// 运行测试
log('\n🚀 启动 n8n 工作流模拟测试...\n', 'green');
simulateN8nWorkflow().catch(error => {
  log('\n💥 致命错误', 'red');
  console.error(error);
  process.exit(1);
});
