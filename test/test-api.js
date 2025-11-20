#!/usr/bin/env node

/**
 * API Test Script
 * Tests all API endpoints and verifies encryption/decryption
 */

import CryptoJS from 'crypto-js';

const API_BASE = 'http://localhost:3000';
const ADMIN_SECRET = 'your-secret-admin-token-change-me-in-production';
const ENCRYPTION_SECRET = 'your-secret-encryption-key-change-me-in-production';

// Colors for console output
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

function generateEncryptionKey(salt) {
  return CryptoJS.SHA256(ENCRYPTION_SECRET + salt).toString();
}

function decryptAnswers(encryptedData, salt) {
  try {
    const key = generateEncryptionKey(salt);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

async function testEndpoint(name, url, options = {}) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Testing: ${name}`, 'cyan');
  log(`URL: ${url}`, 'blue');

  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;

    log(`Status: ${response.status} ${response.statusText}`, response.ok ? 'green' : 'red');
    log(`Response Time: ${responseTime}ms`, 'yellow');

    const data = await response.json();
    log('\nResponse:', 'blue');
    console.log(JSON.stringify(data, null, 2));

    return { success: response.ok, data, responseTime };
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('🚀 Starting API Tests', 'green');
  log(`API Base URL: ${API_BASE}`, 'blue');

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Test 1: Get daily puzzle
  const puzzleResult = await testEndpoint(
    'Get Daily Octordle Puzzle',
    `${API_BASE}/daily/octordle/en`
  );

  if (puzzleResult.success) {
    results.passed++;
    results.tests.push({ name: 'Get Daily Puzzle', status: 'PASS' });

    // Test decryption
    log('\n--- Testing Decryption ---', 'cyan');
    const { encryptedAnswers, salt } = puzzleResult.data;
    const answers = decryptAnswers(encryptedAnswers, salt);

    if (answers && Array.isArray(answers)) {
      log('✅ Decryption successful!', 'green');
      log(`Decrypted Answers (${answers.length}):`, 'blue');
      answers.forEach((word, i) => log(`  ${i + 1}. ${word.toUpperCase()}`, 'yellow'));
      results.passed++;
      results.tests.push({ name: 'Decrypt Answers', status: 'PASS' });
    } else {
      log('❌ Decryption failed!', 'red');
      results.failed++;
      results.tests.push({ name: 'Decrypt Answers', status: 'FAIL' });
    }
  } else {
    results.failed += 2;
    results.tests.push({ name: 'Get Daily Puzzle', status: 'FAIL' });
    results.tests.push({ name: 'Decrypt Answers', status: 'SKIP' });
  }

  // Test 2: Verify valid word
  const verifyValid = await testEndpoint(
    'Verify Valid Word (hello)',
    `${API_BASE}/verify/en/hello`
  );
  results[verifyValid.success && verifyValid.data.valid ? 'passed' : 'failed']++;
  results.tests.push({
    name: 'Verify Valid Word',
    status: verifyValid.success && verifyValid.data.valid ? 'PASS' : 'FAIL',
  });

  // Test 3: Verify invalid word
  const verifyInvalid = await testEndpoint(
    'Verify Invalid Word (zzzzz)',
    `${API_BASE}/verify/en/zzzzz`
  );
  results[verifyInvalid.success && !verifyInvalid.data.valid ? 'passed' : 'failed']++;
  results.tests.push({
    name: 'Verify Invalid Word',
    status: verifyInvalid.success && !verifyInvalid.data.valid ? 'PASS' : 'FAIL',
  });

  // Test 4: Get game config
  const configResult = await testEndpoint(
    'Get Octordle Config',
    `${API_BASE}/config/octordle`
  );
  results[configResult.success ? 'passed' : 'failed']++;
  results.tests.push({
    name: 'Get Game Config',
    status: configResult.success ? 'PASS' : 'FAIL',
  });

  // Test 5: Get stats (admin)
  const statsResult = await testEndpoint(
    'Get Admin Stats',
    `${API_BASE}/admin/stats`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
    }
  );
  results[statsResult.success ? 'passed' : 'failed']++;
  results.tests.push({
    name: 'Admin Stats',
    status: statsResult.success ? 'PASS' : 'FAIL',
  });

  // Test 6: Test auth middleware with wrong token
  const authFailResult = await testEndpoint(
    'Admin Stats (Wrong Token)',
    `${API_BASE}/admin/stats`,
    {
      headers: {
        Authorization: 'Bearer wrong-token',
      },
    }
  );
  results[!authFailResult.success && authFailResult.data?.error === 'Unauthorized' ? 'passed' : 'failed']++;
  results.tests.push({
    name: 'Auth Middleware',
    status: !authFailResult.success && authFailResult.data?.error === 'Unauthorized' ? 'PASS' : 'FAIL',
  });

  // Print summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');

  results.tests.forEach((test) => {
    const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⏭️';
    const color = test.status === 'PASS' ? 'green' : test.status === 'FAIL' ? 'red' : 'yellow';
    log(`${icon} ${test.name.padEnd(30)} ${test.status}`, color);
  });

  log('\n' + '='.repeat(60), 'cyan');
  log(`Total Tests: ${results.passed + results.failed}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`, 'yellow');
  log('='.repeat(60), 'cyan');

  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log(`\n⚠️  ${results.failed} test(s) failed`, 'red');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
