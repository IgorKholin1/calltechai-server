#!/usr/bin/env node

/**
 * Voice Response Optimization Test Script
 * Tests the performance improvements made to reduce response delays
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const TEST_CALLS = [
  {
    name: 'Fast Greeting Test',
    endpoint: '/api/voice/handle-greeting',
    data: {
      CallSid: 'test-fast-greeting',
      SpeechResult: 'hello'
    }
  },
  {
    name: 'Fast Recording Test',
    endpoint: '/api/voice/handle-fast-recording',
    data: {
      CallSid: 'test-fast-recording',
      RecordingUrl: 'https://example.com/test-audio.wav'
    }
  },
  {
    name: 'Standard Continue Test',
    endpoint: '/api/voice/continue',
    data: {
      CallSid: 'test-standard',
      SpeechResult: 'I need an appointment'
    }
  }
];

async function testEndpoint(name, endpoint, data) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`📍 Endpoint: ${endpoint}`);
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Success! Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status}`);
    
    // Check if response contains optimized settings
    const responseText = response.data;
    const optimizations = [];
    
    if (responseText.includes('timeout="8"') || responseText.includes('timeout="6"')) {
      optimizations.push('✅ Reduced timeout');
    }
    
    if (responseText.includes('maxLength="8"') || responseText.includes('maxLength="6"')) {
      optimizations.push('✅ Reduced maxLength');
    }
    
    if (responseText.includes('break time="100ms"') || responseText.includes('break time="150ms"')) {
      optimizations.push('✅ Reduced SSML pauses');
    }
    
    if (!responseText.includes('Хорошо, секундочку') && !responseText.includes('Alright, one moment')) {
      optimizations.push('✅ No thinking phrases');
    }
    
    if (optimizations.length > 0) {
      console.log(`🚀 Optimizations detected:`);
      optimizations.forEach(opt => console.log(`   ${opt}`));
    }
    
    return {
      success: true,
      responseTime,
      optimizations: optimizations.length
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`❌ Error: ${error.message}`);
    console.log(`⏱️  Time taken: ${responseTime}ms`);
    
    return {
      success: false,
      responseTime,
      error: error.message
    };
  }
}

async function runPerformanceComparison() {
  console.log('🚀 Voice Response Optimization Test Suite');
  console.log('==========================================');
  
  const results = [];
  
  for (const test of TEST_CALLS) {
    const result = await testEndpoint(test.name, test.endpoint, test.data);
    results.push({
      name: test.name,
      ...result
    });
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const successfulTests = results.filter(r => r.success);
  const avgResponseTime = successfulTests.length > 0 
    ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
    : 0;
  
  console.log(`✅ Successful tests: ${successfulTests.length}/${results.length}`);
  console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(0)}ms`);
  
  if (avgResponseTime < 5000) {
    console.log('🎉 Excellent! Response times are optimized (< 5 seconds)');
  } else if (avgResponseTime < 8000) {
    console.log('👍 Good! Response times are acceptable (< 8 seconds)');
  } else {
    console.log('⚠️  Warning: Response times are slow (> 8 seconds)');
  }
  
  // Optimization score
  const totalOptimizations = successfulTests.reduce((sum, r) => sum + (r.optimizations || 0), 0);
  const maxOptimizations = successfulTests.length * 4; // 4 possible optimizations per test
  
  if (maxOptimizations > 0) {
    const optimizationScore = (totalOptimizations / maxOptimizations) * 100;
    console.log(`🚀 Optimization score: ${optimizationScore.toFixed(0)}%`);
    
    if (optimizationScore >= 75) {
      console.log('🎯 Excellent optimization implementation!');
    } else if (optimizationScore >= 50) {
      console.log('👍 Good optimization level');
    } else {
      console.log('⚠️  Some optimizations may be missing');
    }
  }
  
  return results;
}

async function testSSMLOptimizations() {
  console.log('\n🔍 Testing SSML Optimizations');
  console.log('=============================');
  
  const testCases = [
    {
      name: 'Greeting SSML',
      text: 'Hello! How can I help you?',
      expectedPause: '150ms'
    },
    {
      name: 'Final Response SSML',
      text: 'Your appointment is confirmed.',
      expectedPause: '100ms'
    },
    {
      name: 'Clarification SSML',
      text: 'Could you please clarify?',
      expectedPause: '150ms'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/voice/play-voice`, {
        text: testCase.text,
        lang: 'en-US'
      });
      
      const responseText = response.data;
      
      if (responseText.includes(`break time="${testCase.expectedPause}"`)) {
        console.log(`✅ Correct pause time: ${testCase.expectedPause}`);
      } else if (responseText.includes('break time=')) {
        const match = responseText.match(/break time="([^"]+)"/);
        if (match) {
          console.log(`⚠️  Found pause: ${match[1]} (expected: ${testCase.expectedPause})`);
        }
      } else {
        console.log(`❌ No pause found in SSML`);
      }
      
    } catch (error) {
      console.log(`❌ Error testing SSML: ${error.message}`);
    }
  }
}

async function main() {
  try {
    // Test if server is running
    await axios.get(`${BASE_URL}/api/bot/health`, { timeout: 5000 });
    console.log('✅ Server is running');
    
    // Run performance tests
    await runPerformanceComparison();
    
    // Test SSML optimizations
    await testSSMLOptimizations();
    
    console.log('\n🎉 Optimization testing completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Monitor real call performance');
    console.log('2. Adjust timeouts if speech recognition accuracy drops');
    console.log('3. Fine-tune SSML pauses based on user feedback');
    console.log('4. Consider A/B testing fast vs standard modes');
    
  } catch (error) {
    console.error('❌ Server not running or test failed:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('1. Start the server: npm start');
    console.log('2. Check if port 3000 is available');
    console.log('3. Verify all environment variables are set');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testEndpoint,
  runPerformanceComparison,
  testSSMLOptimizations
}; 