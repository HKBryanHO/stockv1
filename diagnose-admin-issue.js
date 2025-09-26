#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 診斷管理員登入問題...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 創建數據庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接數據庫:', err.message);
        console.error('數據庫路徑:', dbPath);
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫:', dbPath);
});

// 檢查所有用戶
function checkAllUsers() {
    console.log('\n📋 檢查數據庫中的所有用戶:');
    db.all('SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('❌ 查詢用戶失敗:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            console.log('⚠️ 數據庫中沒有用戶');
            return;
        }
        
        console.log(`找到 ${rows.length} 個用戶:`);
        rows.forEach((user, index) => {
            console.log(`\n${index + 1}. 用戶 ID: ${user.id}`);
            console.log(`   用戶名: ${user.username}`);
            console.log(`   郵箱: ${user.email}`);
            console.log(`   角色: ${user.role}`);
            console.log(`   狀態: ${user.status}`);
            console.log(`   創建時間: ${user.created_at}`);
        });
    });
}

// 檢查特定用戶
function checkSpecificUser(username) {
    console.log(`\n🔍 檢查用戶 "${username}":`);
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('❌ 查詢用戶失敗:', err.message);
            return;
        }
        
        if (!row) {
            console.log(`❌ 用戶 "${username}" 不存在`);
            return;
        }
        
        console.log('✅ 用戶存在:');
        console.log(`   ID: ${row.id}`);
        console.log(`   用戶名: ${row.username}`);
        console.log(`   郵箱: ${row.email}`);
        console.log(`   角色: ${row.role}`);
        console.log(`   狀態: ${row.status}`);
        console.log(`   創建時間: ${row.created_at}`);
        console.log(`   最後登入: ${row.last_login || '從未'}`);
        console.log(`   API配額: ${row.api_quota}`);
        console.log(`   密碼哈希: ${row.password_hash.substring(0, 20)}...`);
    });
}

// 測試密碼驗證
async function testPassword(username, password) {
    console.log(`\n🔐 測試密碼驗證 (用戶: ${username}):`);
    db.get('SELECT password_hash FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) {
            console.error('❌ 查詢密碼失敗:', err.message);
            return;
        }
        
        if (!row) {
            console.log(`❌ 用戶 "${username}" 不存在`);
            return;
        }
        
        try {
            const isValid = await bcrypt.compare(password, row.password_hash);
            if (isValid) {
                console.log('✅ 密碼驗證成功');
            } else {
                console.log('❌ 密碼驗證失敗');
                console.log('   請檢查密碼是否正確');
            }
        } catch (error) {
            console.error('❌ 密碼驗證錯誤:', error.message);
        }
    });
}

// 檢查會話表
function checkSessions() {
    console.log('\n🔑 檢查活躍會話:');
    db.all('SELECT s.*, u.username FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > datetime("now")', (err, rows) => {
        if (err) {
            console.error('❌ 查詢會話失敗:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            console.log('⚠️ 沒有活躍會話');
        } else {
            console.log(`找到 ${rows.length} 個活躍會話:`);
            rows.forEach((session, index) => {
                console.log(`\n${index + 1}. 會話 ID: ${session.id}`);
                console.log(`   用戶: ${session.username}`);
                console.log(`   創建時間: ${session.created_at}`);
                console.log(`   過期時間: ${session.expires_at}`);
                console.log(`   IP地址: ${session.ip_address || '未知'}`);
            });
        }
    });
}

// 主診斷函數
async function runDiagnosis() {
    console.log('=' * 50);
    console.log('🔍 開始診斷管理員登入問題');
    console.log('=' * 50);
    
    // 檢查所有用戶
    checkAllUsers();
    
    // 等待一下讓查詢完成
    setTimeout(() => {
        // 檢查特定用戶
        checkSpecificUser('admin');
        checkSpecificUser('Bryanho');
        
        // 等待一下
        setTimeout(() => {
            // 測試密碼
            testPassword('admin', 'Admin1234!');
            testPassword('Bryanho', 'Bryanho123');
            
            // 等待一下
            setTimeout(() => {
                // 檢查會話
                checkSessions();
                
                // 等待一下後關閉數據庫
                setTimeout(() => {
                    console.log('\n🎯 診斷完成！');
                    console.log('\n📋 可能的解決方案:');
                    console.log('1. 如果用戶不存在，請重新創建');
                    console.log('2. 如果密碼不正確，請檢查密碼');
                    console.log('3. 如果數據庫未初始化，請運行設置腳本');
                    console.log('4. 檢查服務器日誌以獲取更多信息');
                    
                    db.close();
                }, 1000);
            }, 1000);
        }, 1000);
    }, 1000);
}

// 開始診斷
runDiagnosis();
