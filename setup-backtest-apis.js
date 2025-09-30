#!/usr/bin/env node

/**
 * 回測 API 密鑰設置助手
 * 使用方法: node setup-backtest-apis.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setupAPIs() {
    console.log('🚀 回測數據源 API 密鑰設置助手\n');
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // 讀取現有的 .env 文件
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        console.log('📁 發現現有的 .env 文件，將更新現有配置\n');
    } else {
        console.log('📁 將創建新的 .env 文件\n');
    }
    
    const apis = [
        {
            name: 'Financial Modeling Prep (FMP)',
            key: 'FMP_API_KEY',
            description: '最推薦的數據源，數據品質高，響應快速',
            url: 'https://financialmodelingprep.com/',
            free: '250 請求/天'
        },
        {
            name: 'Finnhub',
            key: 'FINNHUB_API_KEY', 
            description: '全球市場覆蓋，實時數據',
            url: 'https://finnhub.io/',
            free: '60 請求/分鐘'
        },
        {
            name: 'Polygon.io',
            key: 'POLYGON_API_KEY',
            description: '專業級數據，低延遲',
            url: 'https://polygon.io/',
            free: '5 請求/分鐘'
        },
        {
            name: 'Alpha Vantage',
            key: 'ALPHA_VANTAGE_KEY',
            description: '免費額度較大，備用選項',
            url: 'https://www.alphavantage.co/',
            free: '25 請求/天'
        }
    ];
    
    const newEnvLines = [];
    
    for (const api of apis) {
        console.log(`🔧 配置 ${api.name}`);
        console.log(`   描述: ${api.description}`);
        console.log(`   網站: ${api.url}`);
        console.log(`   免費額度: ${api.free}\n`);
        
        // 檢查是否已存在
        const existingKey = envContent.match(new RegExp(`^${api.key}=(.+)$`, 'm'));
        if (existingKey) {
            console.log(`   現有配置: ${api.key}=${existingKey[1].substring(0, 10)}...`);
            const update = await question('   是否更新此配置？(y/N): ');
            if (update.toLowerCase() !== 'y') {
                newEnvLines.push(`${api.key}=${existingKey[1]}`);
                console.log('   ✅ 保留現有配置\n');
                continue;
            }
        }
        
        const apiKey = await question(`   請輸入 ${api.name} API 密鑰 (按 Enter 跳過): `);
        
        if (apiKey.trim()) {
            newEnvLines.push(`${api.key}=${apiKey.trim()}`);
            console.log(`   ✅ ${api.name} API 密鑰已保存\n`);
        } else {
            console.log(`   ⏭️  跳過 ${api.name}\n`);
        }
    }
    
    // 保留其他現有的環境變量
    const existingLines = envContent.split('\n').filter(line => {
        if (!line.trim() || line.startsWith('#')) return true;
        return !apis.some(api => line.startsWith(api.key + '='));
    });
    
    // 合併所有配置
    const allLines = [...existingLines, ...newEnvLines];
    const finalEnvContent = allLines.join('\n');
    
    // 寫入 .env 文件
    fs.writeFileSync(envPath, finalEnvContent);
    
    console.log('🎉 API 密鑰配置完成！\n');
    
    // 顯示配置摘要
    const configuredAPIs = newEnvLines.length;
    console.log('📊 配置摘要:');
    console.log(`   ✅ 已配置: ${configuredAPIs}/${apis.length} 個數據源`);
    
    if (configuredAPIs > 0) {
        console.log('\n🔍 建議下一步:');
        console.log('   1. 運行測試: node test-backtest-sources.js');
        console.log('   2. 重啟服務器: npm start');
        console.log('   3. 開始使用回測功能！');
    } else {
        console.log('\n⚠️  警告: 沒有配置任何 API 密鑰');
        console.log('   回測功能將無法正常工作');
        console.log('   請參考 BACKTEST_DATA_SOURCES.md 獲取詳細指南');
    }
    
    console.log('\n📚 更多信息:');
    console.log('   - 配置指南: BACKTEST_DATA_SOURCES.md');
    console.log('   - API 測試: node test-backtest-sources.js');
    console.log('   - 數據源狀態: http://localhost:3001/api/backtest/sources');
    
    rl.close();
}

// 運行設置
setupAPIs().catch(console.error);
