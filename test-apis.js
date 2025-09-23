#!/usr/bin/env node

/**
 * API 配置測試腳本
 * 用於驗證股票數據 API 是否正確配置
 */

const https = require('https');
const http = require('http');

// 顏色輸出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function testAPI(name, url, expectedFields = []) {
    return new Promise((resolve) => {
        log(`\n🧪 測試 ${name}...`, 'blue');
        
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + (urlObj.search || ''),
            method: 'GET',
            headers: {
                'User-Agent': 'Stock-Predictor-Test/1.0'
            }
        };
        
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const hasError = json.error || json['Error Message'] || json.Note;
                    
                    if (hasError) {
                        log(`❌ ${name}: ${hasError}`, 'red');
                        resolve({ name, status: 'error', error: hasError });
                    } else {
                        // 檢查預期字段
                        const missingFields = expectedFields.filter(field => !json[field]);
                        if (missingFields.length > 0) {
                            log(`⚠️  ${name}: 缺少字段 ${missingFields.join(', ')}`, 'yellow');
                        } else {
                            log(`✅ ${name}: 配置正確`, 'green');
                        }
                        resolve({ name, status: 'success', data: json });
                    }
                } catch (e) {
                    log(`❌ ${name}: JSON 解析錯誤`, 'red');
                    resolve({ name, status: 'error', error: e.message });
                }
            });
        });
        
        req.on('error', (err) => {
            log(`❌ ${name}: 網絡錯誤 - ${err.message}`, 'red');
            resolve({ name, status: 'error', error: err.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            log(`❌ ${name}: 請求超時`, 'red');
            resolve({ name, status: 'error', error: 'Timeout' });
        });
        
        req.end();
    });
}

async function testLocalServer() {
    log(`\n🏠 測試本地服務器...`, 'blue');
    
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/debug/env',
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    log(`📊 API 配置狀態:`, 'blue');
                    Object.entries(json).forEach(([key, value]) => {
                        const status = value ? '✅' : '❌';
                        const color = value ? 'green' : 'red';
                        log(`  ${status} ${key}: ${value}`, color);
                    });
                    resolve(json);
                } catch (e) {
                    log(`❌ 本地服務器未運行或配置錯誤`, 'red');
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => {
            log(`❌ 本地服務器未運行 (請先運行: npm start)`, 'red');
            resolve(null);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            log(`❌ 本地服務器連接超時`, 'red');
            resolve(null);
        });
        
        req.end();
    });
}

async function main() {
    log(`${colors.bold}🚀 股票數據 API 配置測試${colors.reset}`, 'bold');
    log('========================================', 'blue');
    
    // 檢查環境變數
    const envVars = [
        'ALPHA_VANTAGE_KEY',
        'FINNHUB_API_KEY', 
        'FMP_API_KEY',
        'POLYGON_API_KEY'
    ];
    
    log(`\n🔍 檢查環境變數...`, 'blue');
    envVars.forEach(varName => {
        const value = process.env[varName];
        const status = value && value !== `your_${varName.toLowerCase()}_here` ? '✅' : '❌';
        const color = value && value !== `your_${varName.toLowerCase()}_here` ? 'green' : 'red';
        log(`  ${status} ${varName}: ${value ? '已設置' : '未設置'}`, color);
    });
    
    // 測試本地服務器
    const serverConfig = await testLocalServer();
    
    if (serverConfig) {
        log(`\n🎯 推薦配置:`, 'blue');
        if (!serverConfig.finnhub_configured) {
            log(`  1. 註冊 Finnhub: https://finnhub.io/register`, 'yellow');
        }
        if (!serverConfig.fmp_configured) {
            log(`  2. 註冊 FMP: https://financialmodelingprep.com/developer/docs`, 'yellow');
        }
        if (!serverConfig.polygon_configured) {
            log(`  3. 註冊 Polygon.io: https://polygon.io/`, 'yellow');
        }
        if (!serverConfig.alpha_configured) {
            log(`  4. 註冊 Alpha Vantage: https://www.alphavantage.co/support/#api-key`, 'yellow');
        }
    }
    
    log(`\n📖 詳細設置指南: API_SETUP_GUIDE.md`, 'blue');
    log(`\n🎉 測試完成！`, 'green');
}

// 運行測試
main().catch(console.error);
