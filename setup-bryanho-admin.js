#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔧 設置 Bryanho 管理員帳戶...\n');

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

// 創建或更新Bryanho管理員用戶
async function setupBryanhoAdmin() {
    try {
        // 檢查Bryanho用戶是否已存在
        db.get('SELECT id, role FROM users WHERE username = ?', ['Bryanho'], async (err, row) => {
            if (err) {
                console.error('❌ 檢查用戶失敗:', err.message);
                process.exit(1);
            }

            if (row) {
                console.log('✅ Bryanho用戶已存在');
                console.log(`   當前角色: ${row.role}`);
                
                if (row.role === 'admin') {
                    console.log('✅ Bryanho已經是管理員，無需更新');
                    console.log('   用戶名: Bryanho');
                    console.log('   角色: admin');
                    db.close();
                    return;
                }
                
                // 更新現有用戶為管理員
                console.log('🔄 更新用戶權限為管理員...');
                db.run('UPDATE users SET role = ?, api_quota = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?', 
                    ['admin', 10000, 'Bryanho'], function(err) {
                    if (err) {
                        console.error('❌ 更新用戶權限失敗:', err.message);
                        process.exit(1);
                    }
                    
                    console.log('✅ Bryanho用戶權限已更新為管理員');
                    console.log('   用戶名: Bryanho');
                    console.log('   角色: admin');
                    console.log('   API配額: 10000');
                    db.close();
                });
                return;
            }

            // 創建新的Bryanho管理員用戶
            console.log('🔄 創建新的Bryanho管理員用戶...');
            const password = 'Bryanho123'; // 默認密碼
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            const sql = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [
                'Bryanho',
                'bryanho@stockpredictor.com',
                passwordHash,
                'Bryan Ho',
                'admin',
                10000, // 更高的API配額
                'active'
            ], function(err) {
                if (err) {
                    console.error('❌ 創建Bryanho管理員用戶失敗:', err.message);
                    process.exit(1);
                }
                
                console.log('✅ Bryanho管理員用戶創建成功');
                console.log('   用戶名: Bryanho');
                console.log('   密碼: Bryanho123');
                console.log('   角色: admin');
                console.log('   API配額: 10000');
                console.log('   狀態: active');
                console.log('   ⚠️  請在首次登入後立即修改密碼！');
                console.log('\n🌐 管理頁面訪問:');
                console.log('   - 登入頁面: /login.html');
                console.log('   - 管理頁面: /admin.html');
                console.log('   - 預測頁面: /index.html');
                
                db.close();
            });
        });
    } catch (error) {
        console.error('❌ 設置用戶時發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始設置用戶
setupBryanhoAdmin();
