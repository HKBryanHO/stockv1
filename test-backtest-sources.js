#!/usr/bin/env node

/**
 * 測試回測數據源連接性
 * 使用方法: node test-backtest-sources.js
 */

const https = require('https');
const fs = require('fs');

// 讀取環境變量
require('dotenv').config();

const FMP_KEY = process.env.FMP_API_KEY || '';
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const POLYGON_KEY = process.env.POLYGON_API_KEY || '';
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';

console.log('🔍 測試回測數據源連接性...\n');

// 測試函數
async function testDataSource(name, testFn) {
    console.log(`📡 測試 ${name}...`);
    try {
        const result = await testFn();
        if (result.success) {
            console.log(`✅ ${name}: 成功 (${result.responseTime}ms, ${result.dataPoints} 數據點)`);
            return { name, status: 'success', ...result };
        } else {
            console.log(`❌ ${name}: 失敗 - ${result.error}`);
            return { name, status: 'error', error: result.error };
        }
    } catch (error) {
        console.log(`❌ ${name}: 異常 - ${error.message}`);
        return { name, status: 'error', error: error.message };
    }
}

// FMP 測試
async function testFMP() {
    if (!FMP_KEY) {
        return { success: false, error: 'API 密鑰未配置' };
    }
    
    const start = Date.now();
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/AAPL?apikey=${FMP_KEY}&limit=5`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const responseTime = Date.now() - start;
                    
                    if (json && json.historical && Array.isArray(json.historical)) {
                        resolve({
                            success: true,
                            responseTime,
                            dataPoints: json.historical.length,
                            sampleData: json.historical[0]
                        });
                    } else {
                        resolve({ success: false, error: '無效的數據格式' });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'JSON 解析失敗' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

// Finnhub 測試
async function testFinnhub() {
    if (!FINNHUB_KEY) {
        return { success: false, error: 'API 密鑰未配置' };
    }
    
    const start = Date.now();
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=AAPL&resolution=D&count=5&token=${FINNHUB_KEY}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const responseTime = Date.now() - start;
                    
                    if (json && json.s === 'ok' && json.c && json.c.length > 0) {
                        resolve({
                            success: true,
                            responseTime,
                            dataPoints: json.c.length,
                            sampleData: { close: json.c[0], volume: json.v[0] }
                        });
                    } else {
                        resolve({ success: false, error: json.s || '無效的數據格式' });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'JSON 解析失敗' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

// Polygon.io 測試
async function testPolygon() {
    if (!POLYGON_KEY) {
        return { success: false, error: 'API 密鑰未配置' };
    }
    
    const start = Date.now();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 10);
    
    const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&sort=asc&apikey=${POLYGON_KEY}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const responseTime = Date.now() - start;
                    
                    if (json && json.results && Array.isArray(json.results)) {
                        resolve({
                            success: true,
                            responseTime,
                            dataPoints: json.results.length,
                            sampleData: json.results[0]
                        });
                    } else {
                        resolve({ success: false, error: json.message || '無效的數據格式' });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'JSON 解析失敗' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

// Alpha Vantage 測試
async function testAlphaVantage() {
    if (!ALPHA_KEY) {
        return { success: false, error: 'API 密鑰未配置' };
    }
    
    const start = Date.now();
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&outputsize=compact&apikey=${ALPHA_KEY}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const responseTime = Date.now() - start;
                    
                    if (json && json['Time Series (Daily)']) {
                        const timeSeries = json['Time Series (Daily)'];
                        const dates = Object.keys(timeSeries);
                        resolve({
                            success: true,
                            responseTime,
                            dataPoints: dates.length,
                            sampleData: timeSeries[dates[0]]
                        });
                    } else if (json['Error Message']) {
                        resolve({ success: false, error: json['Error Message'] });
                    } else if (json['Note']) {
                        resolve({ success: false, error: 'API 額度已用完' });
                    } else {
                        resolve({ success: false, error: '無效的數據格式' });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'JSON 解析失敗' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

// 主測試函數
async function runTests() {
    const results = [];
    
    // 檢查 API 密鑰配置
    console.log('🔑 API 密鑰配置狀態:');
    console.log(`   FMP: ${FMP_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   Finnhub: ${FINNHUB_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   Polygon.io: ${POLYGON_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   Alpha Vantage: ${ALPHA_KEY ? '✅ 已配置' : '❌ 未配置'}\n`);
    
    // 運行測試
    results.push(await testDataSource('Financial Modeling Prep', testFMP));
    results.push(await testDataSource('Finnhub', testFinnhub));
    results.push(await testDataSource('Polygon.io', testPolygon));
    results.push(await testDataSource('Alpha Vantage', testAlphaVantage));
    
    // 總結
    console.log('\n📊 測試結果總結:');
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    
    console.log(`✅ 成功: ${successful.length}/4`);
    console.log(`❌ 失敗: ${failed.length}/4\n`);
    
    if (successful.length > 0) {
        console.log('🎯 推薦使用的數據源 (按性能排序):');
        successful
            .sort((a, b) => a.responseTime - b.responseTime)
            .forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.name} (${result.responseTime}ms)`);
            });
    }
    
    if (failed.length > 0) {
        console.log('\n⚠️  失敗的數據源:');
        failed.forEach(result => {
            console.log(`   - ${result.name}: ${result.error}`);
        });
    }
    
    if (successful.length === 0) {
        console.log('\n🚨 警告: 沒有可用的數據源！');
        console.log('   請檢查 API 密鑰配置或網絡連接。');
        console.log('   參考 BACKTEST_DATA_SOURCES.md 獲取配置指南。');
    } else {
        console.log('\n🎉 回測功能已準備就緒！');
        console.log('   系統將自動使用最快的可用數據源進行回測分析。');
    }
}

// 運行測試
runTests().catch(console.error);
