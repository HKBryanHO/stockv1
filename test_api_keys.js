/**
 * 測試 API Keys 配置
 */

const https = require('https');

// 您提供的 API Keys
const API_KEYS = {
    fmp: 'Pp5qwzCD9YinmB3vd2a5cJEA967BqxBt',
    finnhub: 'd38fgr1r01qlbdj58hqgd38fgr1r01qlbdj58hr0',
    polygon: 'mAXs9GUK8uhrfrLlFRcJzV72xmJBupJt'
};

async function testFMP() {
    console.log('🔍 測試 FMP API...');
    try {
        const url = `https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=${API_KEYS.fmp}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            console.log('✅ FMP API 工作正常:', data[0]);
            return true;
        } else {
            console.log('❌ FMP API 返回空數據:', data);
            return false;
        }
    } catch (error) {
        console.log('❌ FMP API 錯誤:', error.message);
        return false;
    }
}

async function testFinnhub() {
    console.log('🔍 測試 Finnhub API...');
    try {
        const url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${API_KEYS.finnhub}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.c) {
            console.log('✅ Finnhub API 工作正常:', data);
            return true;
        } else {
            console.log('❌ Finnhub API 返回空數據:', data);
            return false;
        }
    } catch (error) {
        console.log('❌ Finnhub API 錯誤:', error.message);
        return false;
    }
}

async function testPolygon() {
    console.log('🔍 測試 Polygon API...');
    try {
        const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apikey=${API_KEYS.polygon}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.results) {
            console.log('✅ Polygon API 工作正常:', data.results);
            return true;
        } else {
            console.log('❌ Polygon API 返回空數據:', data);
            return false;
        }
    } catch (error) {
        console.log('❌ Polygon API 錯誤:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 開始測試 API Keys...\n');
    
    const results = {
        fmp: await testFMP(),
        finnhub: await testFinnhub(),
        polygon: await testPolygon()
    };
    
    console.log('\n📊 測試結果:');
    console.log('FMP:', results.fmp ? '✅ 正常' : '❌ 失敗');
    console.log('Finnhub:', results.finnhub ? '✅ 正常' : '❌ 失敗');
    console.log('Polygon:', results.polygon ? '✅ 正常' : '❌ 失敗');
    
    const workingAPIs = Object.values(results).filter(Boolean).length;
    console.log(`\n🎯 總計: ${workingAPIs}/3 個 API 正常工作`);
    
    if (workingAPIs === 0) {
        console.log('⚠️ 所有 API 都失敗，可能的原因:');
        console.log('1. API Keys 無效或過期');
        console.log('2. 網絡連接問題');
        console.log('3. API 服務暫時不可用');
    }
}

runTests().catch(console.error);
