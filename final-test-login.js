#!/usr/bin/env node

const http = require('http');
const https = require('https');

console.log('🧪 最終登入測試...\n');

const BASE_URL = process.env.BASE_URL || 'https://www.bma-hk.com';

// 測試函數
async function testEndpoint(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const jsonBody = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonBody });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// 測試登入
async function testLogin() {
    console.log('1️⃣ 測試登入端點...');
    try {
        const result = await testEndpoint('POST', '/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log(`   狀態: ${result.status}`);
        console.log(`   響應: ${JSON.stringify(result.data, null, 2)}`);
        
        if (result.status === 200) {
            console.log('✅ 登入成功');
            console.log(`   用戶: ${result.data.user?.username}`);
            console.log(`   角色: ${result.data.user?.role}`);
            return true;
        } else {
            console.log('❌ 登入失敗');
            console.log(`   錯誤: ${result.data.error || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 登入測試失敗:', error.message);
        return false;
    }
}

// 測試頁面訪問
async function testPages() {
    console.log('\n2️⃣ 測試頁面訪問...');
    
    const pages = [
        { path: '/login.html', name: '標準登入' },
        { path: '/simple-login.html', name: '簡單登入' },
        { path: '/admin', name: '管理頁面' },
        { path: '/index.html', name: '預測頁面' }
    ];
    
    for (const page of pages) {
        try {
            const result = await testEndpoint('GET', page.path);
            console.log(`   ${page.name}: ${result.status}`);
            if (result.status === 200) {
                console.log('   ✅ 可訪問');
            } else {
                console.log('   ❌ 不可訪問');
            }
        } catch (error) {
            console.log(`   ❌ ${page.name} 測試失敗: ${error.message}`);
        }
    }
}

// 測試API端點
async function testAPIEndpoints() {
    console.log('\n3️⃣ 測試API端點...');
    
    const endpoints = [
        { path: '/api/setup/admin', name: '設置端點' },
        { path: '/api/users/register', name: '註冊端點' },
        { path: '/api/users/login', name: '用戶登入端點' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const result = await testEndpoint('GET', endpoint.path);
            console.log(`   ${endpoint.name}: ${result.status}`);
            if (result.status === 200 || result.status === 405) {
                console.log('   ✅ 端點存在');
            } else {
                console.log(`   ❌ 端點錯誤: ${result.data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`   ❌ ${endpoint.name} 測試失敗: ${error.message}`);
        }
    }
}

// 主測試函數
async function runTests() {
    console.log(`🌐 測試服務器: ${BASE_URL}`);
    console.log('=' * 50);
    
    const loginSuccess = await testLogin();
    await testPages();
    await testAPIEndpoints();
    
    console.log('\n🎯 測試完成！');
    
    if (loginSuccess) {
        console.log('\n✅ 登入功能正常！');
        console.log('📋 下一步:');
        console.log('1. 訪問 https://www.bma-hk.com/simple-login.html');
        console.log('2. 使用 admin / admin123 登入');
        console.log('3. 前往管理頁面進行用戶管理');
    } else {
        console.log('\n❌ 登入功能異常！');
        console.log('📋 解決方案:');
        console.log('1. 運行 emergency-fix-admin.js 修復數據庫');
        console.log('2. 檢查服務器是否正在運行');
        console.log('3. 查看服務器日誌');
        console.log('4. 確認數據庫文件存在');
    }
}

// 運行測試
runTests().catch(console.error);
