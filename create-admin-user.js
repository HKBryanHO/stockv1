#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔧 創建管理員用戶...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 創建數據庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接數據庫:', err.message);
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫');
});

// 創建admin用戶
async function createAdminUser() {
    try {
        // 檢查admin用戶是否已存在
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
            if (err) {
                console.error('❌ 檢查用戶失敗:', err.message);
                process.exit(1);
            }

            if (row) {
                console.log('✅ admin用戶已存在');
                console.log('   用戶名: admin');
                console.log('   密碼: admin123');
                console.log('   ⚠️  請在首次登入後立即修改密碼！');
                db.close();
                return;
            }

            // 創建admin用戶
            const password = 'admin123';
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            const sql = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota) 
                       VALUES (?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [
                'admin',
                'admin@stockpredictor.com',
                passwordHash,
                'System Administrator',
                'admin',
                10000 // 更高的API配額
            ], function(err) {
                if (err) {
                    console.error('❌ 創建admin用戶失敗:', err.message);
                    process.exit(1);
                }
                
                console.log('✅ admin用戶創建成功');
                console.log('   用戶名: admin');
                console.log('   密碼: admin123');
                console.log('   ⚠️  請在首次登入後立即修改密碼！');
                
                db.close();
            });
        });
    } catch (error) {
        console.error('❌ 創建用戶時發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始創建用戶
createAdminUser();
