#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔍 診斷登入問題...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 檢查數據庫文件
function checkDatabaseFile() {
    console.log('🗄️ 檢查數據庫文件:');
    
    if (fs.existsSync(dbPath)) {
        console.log('✅ 數據庫文件存在:', dbPath);
        const stats = fs.statSync(dbPath);
        console.log(`   大小: ${stats.size} bytes`);
        console.log(`   修改時間: ${stats.mtime}`);
    } else {
        console.log('❌ 數據庫文件不存在:', dbPath);
        return false;
    }
    return true;
}

// 檢查數據庫連接
function checkDatabaseConnection() {
    console.log('\n🔌 檢查數據庫連接:');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ 數據庫連接失敗:', err.message);
                reject(err);
            } else {
                console.log('✅ 數據庫連接成功');
                resolve(db);
            }
        });
    });
}

// 檢查表結構
async function checkTableStructure(db) {
    console.log('\n📋 檢查表結構:');
    
    return new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) {
                console.error('❌ 查詢表失敗:', err.message);
                reject(err);
            } else {
                console.log('📊 數據庫表:');
                tables.forEach(table => {
                    console.log(`   - ${table.name}`);
                });
                resolve(tables);
            }
        });
    });
}

// 檢查用戶數據
async function checkUserData(db) {
    console.log('\n👥 檢查用戶數據:');
    
    return new Promise((resolve, reject) => {
        db.all('SELECT id, username, role, status, created_at FROM users', (err, users) => {
            if (err) {
                console.error('❌ 查詢用戶失敗:', err.message);
                reject(err);
            } else {
                if (users.length === 0) {
                    console.log('⚠️ 沒有用戶數據');
                } else {
                    console.log(`📊 找到 ${users.length} 個用戶:`);
                    users.forEach(user => {
                        console.log(`   - ID: ${user.id}, 用戶名: ${user.username}, 角色: ${user.role}, 狀態: ${user.status}`);
                    });
                }
                resolve(users);
            }
        });
    });
}

// 檢查特定用戶
async function checkSpecificUser(db, username) {
    console.log(`\n🔍 檢查用戶 "${username}":`);
    
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
            if (err) {
                console.error('❌ 查詢用戶失敗:', err.message);
                reject(err);
            } else if (!user) {
                console.log(`❌ 用戶 "${username}" 不存在`);
                resolve(null);
            } else {
                console.log('✅ 用戶存在:');
                console.log(`   ID: ${user.id}`);
                console.log(`   用戶名: ${user.username}`);
                console.log(`   郵箱: ${user.email}`);
                console.log(`   角色: ${user.role}`);
                console.log(`   狀態: ${user.status}`);
                console.log(`   創建時間: ${user.created_at}`);
                console.log(`   密碼哈希: ${user.password_hash.substring(0, 20)}...`);
                resolve(user);
            }
        });
    });
}

// 測試密碼驗證
async function testPasswordVerification(user, password) {
    console.log(`\n🔐 測試密碼驗證 (用戶: ${user.username}):`);
    
    try {
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (isValid) {
            console.log('✅ 密碼驗證成功');
            return true;
        } else {
            console.log('❌ 密碼驗證失敗');
            return false;
        }
    } catch (error) {
        console.error('❌ 密碼驗證錯誤:', error.message);
        return false;
    }
}

// 檢查會話
async function checkSessions(db) {
    console.log('\n🔑 檢查會話:');
    
    return new Promise((resolve, reject) => {
        db.all('SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > datetime("now")', (err, result) => {
            if (err) {
                console.error('❌ 查詢會話失敗:', err.message);
                reject(err);
            } else {
                console.log(`📊 活躍會話: ${result[0].count} 個`);
                resolve(result[0].count);
            }
        });
    });
}

// 主診斷函數
async function runDiagnosis() {
    try {
        console.log('=' * 50);
        console.log('🔍 登入問題診斷');
        console.log('=' * 50);
        
        // 1. 檢查數據庫文件
        if (!checkDatabaseFile()) {
            console.log('\n❌ 數據庫文件不存在，請運行 final-admin-fix.js');
            return;
        }
        
        // 2. 檢查數據庫連接
        const db = await checkDatabaseConnection();
        
        // 3. 檢查表結構
        await checkTableStructure(db);
        
        // 4. 檢查用戶數據
        const users = await checkUserData(db);
        
        // 5. 檢查特定用戶
        const adminUser = await checkSpecificUser(db, 'admin');
        
        if (adminUser) {
            // 6. 測試密碼驗證
            const passwordValid = await testPasswordVerification(adminUser, 'admin123');
            
            if (passwordValid) {
                console.log('\n✅ 用戶和密碼都正確！');
                console.log('\n🔧 可能的問題:');
                console.log('1. 服務器未重啟');
                console.log('2. UserManager 未正確初始化');
                console.log('3. 認證中間件問題');
                console.log('4. 會話管理問題');
            } else {
                console.log('\n❌ 密碼不正確！');
                console.log('🔧 解決方案: 運行 final-admin-fix.js 重新創建用戶');
            }
        } else {
            console.log('\n❌ admin 用戶不存在！');
            console.log('🔧 解決方案: 運行 final-admin-fix.js 創建用戶');
        }
        
        // 7. 檢查會話
        await checkSessions(db);
        
        console.log('\n🎯 診斷完成！');
        console.log('\n📋 建議的解決方案:');
        console.log('1. 運行 final-admin-fix.js 完全重建數據庫');
        console.log('2. 重啟服務器');
        console.log('3. 檢查服務器日誌');
        console.log('4. 確認 UserManager 初始化');
        
        db.close();
        
    } catch (error) {
        console.error('❌ 診斷過程中發生錯誤:', error.message);
    }
}

// 開始診斷
runDiagnosis();
