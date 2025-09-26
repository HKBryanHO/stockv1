#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔧 強制修復管理員帳戶...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 確保數據庫目錄存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ 創建數據庫目錄:', dbDir);
}

// 創建數據庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接數據庫:', err.message);
        console.error('數據庫路徑:', dbPath);
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫:', dbPath);
});

// 強制修復管理員帳戶
async function forceFixAdmin() {
    try {
        console.log('🔄 開始強制修復...');
        
        // 1. 刪除所有現有的admin用戶
        console.log('🗑️ 清理現有的admin用戶...');
        db.run('DELETE FROM users WHERE username = ?', ['admin'], (err) => {
            if (err) {
                console.warn('⚠️ 清理現有用戶時警告:', err.message);
            } else {
                console.log('✅ 清理完成');
            }
        });
        
        // 2. 創建新的admin用戶
        console.log('👤 創建新的admin用戶...');
        const password = 'Admin1234!';
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const sql = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
        
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
            console.log('   ID:', this.lastID);
            console.log('   用戶名: admin');
            console.log('   密碼: Admin1234!');
            console.log('   角色: admin');
            console.log('   API配額: 10000');
            console.log('   狀態: active');
            
            // 3. 驗證用戶創建
            console.log('\n🔍 驗證用戶創建...');
            db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, user) => {
                if (err) {
                    console.error('❌ 驗證失敗:', err.message);
                    process.exit(1);
                }
                
                if (!user) {
                    console.error('❌ 用戶創建後未找到');
                    process.exit(1);
                }
                
                console.log('✅ 用戶驗證成功:');
                console.log('   ID:', user.id);
                console.log('   用戶名:', user.username);
                console.log('   角色:', user.role);
                console.log('   狀態:', user.status);
                console.log('   創建時間:', user.created_at);
                
                // 4. 測試密碼驗證
                console.log('\n🔐 測試密碼驗證...');
                try {
                    const isValid = await bcrypt.compare('Admin1234!', user.password_hash);
                    if (isValid) {
                        console.log('✅ 密碼驗證成功');
                    } else {
                        console.log('❌ 密碼驗證失敗');
                    }
                } catch (error) {
                    console.error('❌ 密碼驗證錯誤:', error.message);
                }
                
                // 5. 清理過期會話
                console.log('\n🧹 清理過期會話...');
                db.run("DELETE FROM user_sessions WHERE expires_at <= datetime('now')", (err) => {
                    if (err) {
                        console.warn('⚠️ 清理會話時警告:', err.message);
                    } else {
                        console.log('✅ 會話清理完成');
                    }
                    
                    console.log('\n🎯 修復完成！');
                    console.log('\n📋 下一步:');
                    console.log('1. 訪問 https://www.bma-hk.com/login.html');
                    console.log('2. 使用 admin / Admin1234! 登入');
                    console.log('3. 如果仍有問題，檢查服務器日誌');
                    console.log('4. 確保 UserManager 已正確初始化');
                    
                    db.close();
                });
            });
        });
        
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始修復
forceFixAdmin();
