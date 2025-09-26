#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🔍 檢查服務器狀態...\n');

// 檢查數據庫狀態
function checkDatabase() {
    console.log('🗄️ 檢查數據庫狀態:');
    
    const dbPath = path.join(__dirname, 'database', 'users.db');
    
    if (fs.existsSync(dbPath)) {
        console.log('✅ 數據庫文件存在:', dbPath);
        const stats = fs.statSync(dbPath);
        console.log(`   大小: ${stats.size} bytes`);
        console.log(`   修改時間: ${stats.mtime}`);
        
        // 檢查數據庫內容
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.log('❌ 無法打開數據庫:', err.message);
                return;
            }
            
            console.log('✅ 數據庫連接成功');
            
            // 檢查表結構
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    console.log('❌ 查詢表失敗:', err.message);
                    return;
                }
                
                console.log('📋 數據庫表:');
                tables.forEach(table => {
                    console.log(`   - ${table.name}`);
                });
                
                // 檢查用戶數據
                db.all('SELECT id, username, role, status FROM users', (err, users) => {
                    if (err) {
                        console.log('❌ 查詢用戶失敗:', err.message);
                        return;
                    }
                    
                    console.log('\n👥 用戶數據:');
                    if (users.length === 0) {
                        console.log('   ⚠️ 沒有用戶數據');
                    } else {
                        users.forEach(user => {
                            console.log(`   - ID: ${user.id}, 用戶名: ${user.username}, 角色: ${user.role}, 狀態: ${user.status}`);
                        });
                    }
                    
                    // 檢查會話數據
                    db.all('SELECT COUNT(*) as count FROM user_sessions', (err, result) => {
                        if (err) {
                            console.log('❌ 查詢會話失敗:', err.message);
                        } else {
                            console.log(`\n🔑 活躍會話: ${result[0].count} 個`);
                        }
                        
                        db.close();
                    });
                });
            });
        });
    } else {
        console.log('❌ 數據庫文件不存在:', dbPath);
    }
}

// 檢查服務器文件
function checkServerFiles() {
    console.log('\n📁 檢查服務器文件:');
    
    const files = [
        'server.js',
        'auth/userManager.js',
        'public/login.html',
        'public/simple-login.html',
        'public/admin.html'
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

// 檢查環境變量
function checkEnvironment() {
    console.log('\n🌍 檢查環境變量:');
    
    const envVars = [
        'PORT',
        'NODE_ENV',
        'ALPHA_VANTAGE_KEY',
        'FINNHUB_API_KEY',
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

// 主檢查函數
function runChecks() {
    console.log('=' * 50);
    console.log('🔍 服務器狀態檢查');
    console.log('=' * 50);
    
    checkServerFiles();
    checkEnvironment();
    checkDependencies();
    checkDatabase();
    
    console.log('\n🎯 檢查完成！');
    console.log('\n📋 如果發現問題:');
    console.log('1. 運行 emergency-fix-admin.js 修復數據庫');
    console.log('2. 檢查服務器是否正在運行');
    console.log('3. 確認所有依賴已安裝');
    console.log('4. 檢查環境變量設置');
    console.log('5. 查看服務器日誌');
}

// 開始檢查
runChecks();
