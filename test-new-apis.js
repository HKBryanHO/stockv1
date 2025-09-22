#!/usr/bin/env node

/**
 * Test script for new API integrations
 * Tests Finnhub, FMP, and Polygon.io APIs
 */

const https = require('https');

// Test configuration
const TEST_SYMBOL = 'AAPL';
const BASE_URL = 'http://localhost:3001';

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Test functions
async function testFinnhub() {
  console.log('\n🔍 Testing Finnhub API...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/finnhub/quote?symbol=${TEST_SYMBOL}`);
    if (result.status === 200) {
      console.log(`✅ Finnhub: ${TEST_SYMBOL} = $${result.data.price}`);
    } else if (result.status === 503) {
      console.log('⚠️  Finnhub: API key not configured');
    } else {
      console.log(`❌ Finnhub: ${result.status} - ${result.data.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.log(`❌ Finnhub: ${e.message}`);
  }
}

async function testFMP() {
  console.log('\n🔍 Testing Financial Modeling Prep API...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/fmp/quote?symbol=${TEST_SYMBOL}`);
    if (result.status === 200) {
      console.log(`✅ FMP: ${TEST_SYMBOL} = $${result.data.price}`);
    } else if (result.status === 503) {
      console.log('⚠️  FMP: API key not configured');
    } else {
      console.log(`❌ FMP: ${result.status} - ${result.data.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.log(`❌ FMP: ${e.message}`);
  }
}

async function testPolygon() {
  console.log('\n🔍 Testing Polygon.io API...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/polygon/quote?symbol=${TEST_SYMBOL}`);
    if (result.status === 200) {
      console.log(`✅ Polygon: ${TEST_SYMBOL} = $${result.data.price}`);
    } else if (result.status === 503) {
      console.log('⚠️  Polygon: API key not configured');
    } else {
      console.log(`❌ Polygon: ${result.status} - ${result.data.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.log(`❌ Polygon: ${e.message}`);
  }
}

async function testEnhancedFallback() {
  console.log('\n🔍 Testing Enhanced Fallback API...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/quote/enhanced?symbol=${TEST_SYMBOL}`);
    if (result.status === 200) {
      console.log(`✅ Enhanced Fallback: ${TEST_SYMBOL} = $${result.data.price}`);
    } else {
      console.log(`❌ Enhanced Fallback: ${result.status} - ${result.data.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.log(`❌ Enhanced Fallback: ${e.message}`);
  }
}

async function testMarketInsights() {
  console.log('\n🔍 Testing Market Insights (with new fallback)...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/market/insights?symbols=${TEST_SYMBOL}`);
    if (result.status === 200) {
      console.log(`✅ Market Insights: Successfully fetched data for ${TEST_SYMBOL}`);
      console.log(`   Quote: $${result.data.quotes[TEST_SYMBOL] || 'N/A'}`);
    } else {
      console.log(`❌ Market Insights: ${result.status} - ${result.data.error || 'Unknown error'}`);
    }
  } catch (e) {
    console.log(`❌ Market Insights: ${e.message}`);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API Integration Tests...');
  console.log(`📊 Testing symbol: ${TEST_SYMBOL}`);
  console.log(`🌐 Server: ${BASE_URL}`);
  
  await testFinnhub();
  await testFMP();
  await testPolygon();
  await testEnhancedFallback();
  await testMarketInsights();
  
  console.log('\n✨ Test completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Register for API keys at:');
  console.log('   - Finnhub: https://finnhub.io/register');
  console.log('   - FMP: https://site.financialmodelingprep.com/register');
  console.log('   - Polygon: https://polygon.io/register');
  console.log('2. Add keys to your .env file');
  console.log('3. Restart the server');
  console.log('4. Run this test again');
}

// Run tests
runTests().catch(console.error);
