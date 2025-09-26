#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔧 修復管理員登入問題...\n');

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

// 修復管理員帳戶
async function fixAdminAccount() {
    try {
        // 檢查現有的admin用戶
        db.get('SELECT id, role FROM users WHERE username = ?', ['admin'], async (err, row) => {
            if (err) {
                console.error('❌ 檢查用戶失敗:', err.message);
                process.exit(1);
            }

            if (row) {
                console.log('✅ 找到現有的admin用戶');
                console.log(`   當前角色: ${row.role}`);
                
                // 更新密碼為 Admin1234!
                const newPassword = 'Admin1234!';
                const saltRounds = 10;
                const passwordHash = await bcrypt.hash(newPassword, saltRounds);
                
                console.log('🔄 更新admin用戶密碼...');
                db.run('UPDATE users SET password_hash = ?, role = ?, api_quota = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?', 
                    [passwordHash, 'admin', 10000, 'admin'], function(err) {
                    if (err) {
                        console.error('❌ 更新用戶失敗:', err.message);
                        process.exit(1);
                    }
                    
                    console.log('✅ admin用戶已更新');
                    console.log('   用戶名: admin');
                    console.log('   密碼: Admin1234!');
                    console.log('   角色: admin');
                    console.log('   API配額: 10000');
                    console.log('\n🌐 現在您可以:');
                    console.log('1. 訪問 https://www.bma-hk.com/login.html');
                    console.log('2. 使用 admin / Admin1234! 登入');
                    console.log('3. 訪問管理頁面進行用戶管理');
                    
                    db.close();
                });
                return;
            }

            // 創建新的admin用戶
            console.log('🔄 創建新的admin用戶...');
            const password = 'Admin1234!';
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            const sql = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [
                'admin',
                'admin@bma-hk.com',
                passwordHash,
                'System Administrator',
                'admin',
                10000,
                'active'
            ], function(err) {
                if (err) {
                    console.error('❌ 創建admin用戶失敗:', err.message);
                    process.exit(1);
                }
                
                console.log('✅ admin用戶創建成功');
                console.log('   用戶名: admin');
                console.log('   密碼: Admin1234!');
                console.log('   角色: admin');
                console.log('   API配額: 10000');
                console.log('\n🌐 現在您可以:');
                console.log('1. 訪問 https://www.bma-hk.com/login.html');
                console.log('2. 使用 admin / Admin1234! 登入');
                console.log('3. 訪問管理頁面進行用戶管理');
                
                db.close();
            });
        });
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始修復
fixAdminAccount();
