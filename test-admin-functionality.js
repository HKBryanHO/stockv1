#!/usr/bin/env node

const http = require('http');
const https = require('https');

console.log('🧪 測試 Bryanho 管理員功能...\n');

// 測試配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_USERNAME = 'Bryanho';
const ADMIN_PASSWORD = 'Bryanho123';

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

// 測試管理員設置
async function testAdminSetup() {
    console.log('1️⃣ 測試管理員設置...');
    try {
        const result = await testEndpoint('POST', '/api/setup/admin', {
            username: ADMIN_USERNAME,
            email: 'bryanho@stockpredictor.com',
            password: ADMIN_PASSWORD,
            fullName: 'Bryan Ho'
        });
        
        if (result.status === 200 || result.status === 201) {
            console.log('✅ 管理員設置成功');
            console.log(`   狀態: ${result.status}`);
            console.log(`   訊息: ${result.data.message || 'OK'}`);
        } else {
            console.log('⚠️ 管理員設置響應:', result.status);
            console.log(`   錯誤: ${result.data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.log('❌ 管理員設置失敗:', error.message);
    }
}

// 測試用戶登入
async function testUserLogin() {
    console.log('\n2️⃣ 測試用戶登入...');
    try {
        const result = await testEndpoint('POST', '/api/users/login', {
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD
        });
        
        if (result.status === 200) {
            console.log('✅ 用戶登入成功');
            console.log(`   用戶: ${result.data.user?.username}`);
            console.log(`   角色: ${result.data.user?.role}`);
            return result.data.session_token;
        } else {
            console.log('❌ 用戶登入失敗');
            console.log(`   狀態: ${result.status}`);
            console.log(`   錯誤: ${result.data.error || 'Unknown error'}`);
            return null;
        }
    } catch (error) {
        console.log('❌ 登入測試失敗:', error.message);
        return null;
    }
}

// 測試管理員功能
async function testAdminFeatures(sessionToken) {
    if (!sessionToken) {
        console.log('\n⚠️ 跳過管理員功能測試 (無有效會話)');
        return;
    }

    console.log('\n3️⃣ 測試管理員功能...');
    
    // 測試獲取用戶列表
    try {
        const result = await testEndpoint('GET', '/api/admin/users', null, {
            'Authorization': `Bearer ${sessionToken}`
        });
        
        if (result.status === 200) {
            console.log('✅ 管理員用戶列表訪問成功');
            console.log(`   用戶數量: ${result.data.users?.length || 0}`);
        } else {
            console.log('❌ 管理員用戶列表訪問失敗');
            console.log(`   狀態: ${result.status}`);
            console.log(`   錯誤: ${result.data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.log('❌ 管理員功能測試失敗:', error.message);
    }
}

// 測試頁面訪問
async function testPageAccess() {
    console.log('\n4️⃣ 測試頁面訪問...');
    
    const pages = [
        { path: '/login.html', name: '登入頁面' },
        { path: '/admin.html', name: '管理頁面' },
        { path: '/setup-bryanho-admin.html', name: '設置頁面' }
    ];
    
    for (const page of pages) {
        try {
            const result = await testEndpoint('GET', page.path);
            if (result.status === 200) {
                console.log(`✅ ${page.name} 可訪問`);
            } else {
                console.log(`❌ ${page.name} 不可訪問 (狀態: ${result.status})`);
            }
        } catch (error) {
            console.log(`❌ ${page.name} 訪問失敗: ${error.message}`);
        }
    }
}

// 主測試函數
async function runTests() {
    console.log(`🌐 測試服務器: ${BASE_URL}`);
    console.log(`👤 測試用戶: ${ADMIN_USERNAME}`);
    console.log('=' * 50);
    
    await testAdminSetup();
    const sessionToken = await testUserLogin();
    await testAdminFeatures(sessionToken);
    await testPageAccess();
    
    console.log('\n🎯 測試完成！');
    console.log('\n📋 下一步:');
    console.log('1. 訪問您的應用 URL');
    console.log('2. 前往 /login.html 登入');
    console.log('3. 使用 Bryanho / Bryanho123 登入');
    console.log('4. 前往 /admin.html 管理用戶');
}

// 運行測試
runTests().catch(console.error);
