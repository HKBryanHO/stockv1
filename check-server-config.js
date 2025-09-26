#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 檢查服務器配置...\n');

// 檢查關鍵文件
function checkFiles() {
    console.log('📁 檢查關鍵文件:');
    
    const files = [
        'server.js',
        'auth/userManager.js',
        'database/users.sql',
        'public/login.html',
        'public/admin.html',
        'public/setup-bryanho-admin.html',
        'public/test-login.html'
    ];
    
    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file}`);
        } else {
            console.log(`❌ ${file} - 文件不存在`);
        }
    });
}

// 檢查數據庫
function checkDatabase() {
    console.log('\n🗄️ 檢查數據庫:');
    
    const dbPath = path.join(__dirname, 'database', 'users.db');
    const dbDir = path.dirname(dbPath);
    
    if (fs.existsSync(dbDir)) {
        console.log('✅ 數據庫目錄存在:', dbDir);
    } else {
        console.log('❌ 數據庫目錄不存在:', dbDir);
    }
    
    if (fs.existsSync(dbPath)) {
        console.log('✅ 數據庫文件存在:', dbPath);
        const stats = fs.statSync(dbPath);
        console.log(`   大小: ${stats.size} bytes`);
        console.log(`   修改時間: ${stats.mtime}`);
    } else {
        console.log('❌ 數據庫文件不存在:', dbPath);
    }
}

// 檢查環境變量
function checkEnvironment() {
    console.log('\n🌍 檢查環境變量:');
    
    const envVars = [
        'PORT',
        'ALPHA_VANTAGE_KEY',
        'FINNHUB_API_KEY',
        'FMP_API_KEY',
        'POLYGON_API_KEY',
        'AUTH_USER',
        'AUTH_PASS'
    ];
    
    envVars.forEach(envVar => {
        const value = process.env[envVar];
        if (value) {
            console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`);
        } else {
            console.log(`⚠️ ${envVar}: 未設置`);
        }
    });
}

// 檢查依賴
function checkDependencies() {
    console.log('\n📦 檢查依賴:');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const dependencies = packageJson.dependencies || {};
        
        const requiredDeps = [
            'express',
            'sqlite3',
            'bcrypt',
            'cors',
            'dotenv'
        ];
        
        requiredDeps.forEach(dep => {
            if (dependencies[dep]) {
                console.log(`✅ ${dep}: ${dependencies[dep]}`);
            } else {
                console.log(`❌ ${dep}: 未安裝`);
            }
        });
    } catch (error) {
        console.log('❌ 無法讀取 package.json:', error.message);
    }
}

// 檢查服務器代碼
function checkServerCode() {
    console.log('\n🔧 檢查服務器代碼:');
    
    try {
        const serverCode = fs.readFileSync('server.js', 'utf8');
        
        const checks = [
            { name: 'UserManager 導入', pattern: /require.*userManager/ },
            { name: '數據庫初始化', pattern: /new UserManager/ },
            { name: '認證端點', pattern: /\/auth\/login/ },
            { name: '管理員端點', pattern: /\/api\/admin/ },
            { name: '設置端點', pattern: /\/api\/setup\/admin/ }
        ];
        
        checks.forEach(check => {
            if (check.pattern.test(serverCode)) {
                console.log(`✅ ${check.name}`);
            } else {
                console.log(`❌ ${check.name} - 未找到`);
            }
        });
    } catch (error) {
        console.log('❌ 無法讀取 server.js:', error.message);
    }
}

// 主檢查函數
function runChecks() {
    console.log('=' * 50);
    console.log('🔍 服務器配置檢查');
    console.log('=' * 50);
    
    checkFiles();
    checkDatabase();
    checkEnvironment();
    checkDependencies();
    checkServerCode();
    
    console.log('\n🎯 檢查完成！');
    console.log('\n📋 如果發現問題:');
    console.log('1. 確保所有文件都存在');
    console.log('2. 運行 npm install 安裝依賴');
    console.log('3. 檢查環境變量設置');
    console.log('4. 運行 force-fix-admin.js 修復數據庫');
    console.log('5. 重啟服務器');
}

// 開始檢查
runChecks();
