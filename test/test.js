#!/usr/bin/env node

import http from 'http';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function runTests() {
  console.log('🧪 开始测试...\n');
  const results = [];

  // 测试 1: 根路径
  try {
    console.log('测试 1: GET /');
    const result = await makeRequest('/');
    if (result.status === 200 && result.data.message) {
      console.log('✅ 通过 - 根路径响应正常');
      results.push({ test: 'Root path', status: 'PASS' });
    } else {
      console.log('❌ 失败 - 根路径响应异常');
      results.push({ test: 'Root path', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`❌ 失败 - ${error.message}`);
    results.push({ test: 'Root path', status: 'FAIL', error: error.message });
  }

  // 测试 2: 存活检查
  try {
    console.log('\n测试 2: GET /health/live');
    const result = await makeRequest('/health/live');
    if (result.status === 200 && result.data.status === 'ok') {
      console.log('✅ 通过 - 存活检查正常');
      results.push({ test: 'Liveness check', status: 'PASS' });
    } else {
      console.log('❌ 失败 - 存活检查异常');
      results.push({ test: 'Liveness check', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`❌ 失败 - ${error.message}`);
    results.push({ test: 'Liveness check', status: 'FAIL', error: error.message });
  }

  // 测试 3: 健康检查
  try {
    console.log('\n测试 3: GET /health');
    const result = await makeRequest('/health');
    if (result.status === 200 && result.data.status === 'healthy') {
      console.log('✅ 通过 - 健康检查正常');
      console.log(`   检查结果:`, result.data.checks);
      results.push({ test: 'Health check', status: 'PASS' });
    } else {
      console.log('⚠️  警告 - 健康检查返回不健康状态');
      console.log(`   状态:`, result.data.status);
      console.log(`   检查结果:`, result.data.checks);
      results.push({ test: 'Health check', status: 'WARN' });
    }
  } catch (error) {
    console.log(`❌ 失败 - ${error.message}`);
    results.push({ test: 'Health check', status: 'FAIL', error: error.message });
  }

  // 测试 4: 404 处理
  try {
    console.log('\n测试 4: GET /nonexistent');
    const result = await makeRequest('/nonexistent');
    if (result.status === 404) {
      console.log('✅ 通过 - 404 处理正常');
      results.push({ test: '404 handling', status: 'PASS' });
    } else {
      console.log('❌ 失败 - 404 处理异常');
      results.push({ test: '404 handling', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`❌ 失败 - ${error.message}`);
    results.push({ test: '404 handling', status: 'FAIL', error: error.message });
  }

  // 汇总结果
  console.log('\n' + '='.repeat(50));
  console.log('测试结果汇总:');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warned = results.filter((r) => r.status === 'WARN').length;
  console.log(`✅ 通过: ${passed}`);
  console.log(`⚠️  警告: ${warned}`);
  console.log(`❌ 失败: ${failed}`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('测试执行出错:', error);
  process.exit(1);
});

