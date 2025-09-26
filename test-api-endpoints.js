#!/usr/bin/env node

const http = require('http');
const https = require('https');

console.log('🧪 測試 API 端點...\n');

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
            password: 'Admin1234!'
        });
        
        console.log(`   狀態: ${result.status}`);
        if (result.status === 200) {
            console.log('✅ 登入成功');
            console.log(`   用戶: ${result.data.user?.username}`);
            console.log(`   角色: ${result.data.user?.role}`);
            return result.data.session_token;
        } else {
            console.log('❌ 登入失敗');
            console.log(`   錯誤: ${result.data.error || 'Unknown error'}`);
            return null;
        }
    } catch (error) {
        console.log('❌ 登入測試失敗:', error.message);
        return null;
    }
}

// 測試管理員端點
async function testAdminEndpoints(sessionToken) {
    console.log('\n2️⃣ 測試管理員端點...');
    
    const endpoints = [
        { path: '/api/admin/users', name: '用戶列表' },
        { path: '/api/setup/admin', name: '設置端點' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const result = await testEndpoint('GET', endpoint.path, null, {
                'Authorization': `Bearer ${sessionToken}`
            });
            
            console.log(`   ${endpoint.name}: ${result.status}`);
            if (result.status === 200) {
                console.log('   ✅ 可訪問');
            } else {
                console.log(`   ❌ 錯誤: ${result.data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`   ❌ ${endpoint.name} 測試失敗: ${error.message}`);
        }
    }
}

// 測試頁面訪問
async function testPages() {
    console.log('\n3️⃣ 測試頁面訪問...');
    
    const pages = [
        { path: '/login.html', name: '登入頁面' },
        { path: '/admin.html', name: '管理頁面' },
        { path: '/test-login.html', name: '測試頁面' },
        { path: '/setup-bryanho-admin.html', name: '設置頁面' }
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

// 主測試函數
async function runTests() {
    console.log(`🌐 測試服務器: ${BASE_URL}`);
    console.log('=' * 50);
    
    const sessionToken = await testLogin();
    await testAdminEndpoints(sessionToken);
    await testPages();
    
    console.log('\n🎯 測試完成！');
    console.log('\n📋 如果測試失敗:');
    console.log('1. 檢查服務器是否運行');
    console.log('2. 運行 check-server-config.js 檢查配置');
    console.log('3. 運行 force-fix-admin.js 修復數據庫');
    console.log('4. 檢查網絡連接和防火牆設置');
}

// 運行測試
runTests().catch(console.error);
