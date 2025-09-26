#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔧 創建簡單管理員解決方案...\n');

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
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫:', dbPath);
});

// 創建簡單的管理員帳戶
async function createSimpleAdmin() {
    try {
        console.log('🔄 創建簡單管理員帳戶...');
        
        // 1. 創建用戶表（如果不存在）
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'premium')),
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                preferences TEXT,
                api_quota INTEGER DEFAULT 1000,
                api_usage INTEGER DEFAULT 0
            );
        `;
        
        db.exec(createTableSQL, (err) => {
            if (err) {
                console.error('❌ 創建表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 用戶表已創建');
        });
        
        // 2. 創建會話表（如果不存在）
        const createSessionTableSQL = `
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `;
        
        db.exec(createSessionTableSQL, (err) => {
            if (err) {
                console.error('❌ 創建會話表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 會話表已創建');
        });
        
        // 3. 刪除現有的admin用戶
        db.run('DELETE FROM users WHERE username = ?', ['admin'], (err) => {
            if (err) {
                console.warn('⚠️ 清理現有用戶時警告:', err.message);
            } else {
                console.log('✅ 清理現有用戶完成');
            }
        });
        
        // 4. 創建新的admin用戶
        const password = 'admin123';
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const insertUserSQL = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) 
                               VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(insertUserSQL, [
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
            console.log('   密碼: admin123');
            console.log('   角色: admin');
            console.log('   API配額: 10000');
            console.log('   狀態: active');
            
            // 5. 驗證用戶
            db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, user) => {
                if (err) {
                    console.error('❌ 驗證失敗:', err.message);
                    process.exit(1);
                }
                
                if (!user) {
                    console.error('❌ 用戶創建後未找到');
                    process.exit(1);
                }
                
                console.log('\n✅ 用戶驗證成功:');
                console.log('   ID:', user.id);
                console.log('   用戶名:', user.username);
                console.log('   角色:', user.role);
                console.log('   狀態:', user.status);
                
                // 6. 測試密碼
                try {
                    const isValid = await bcrypt.compare('admin123', user.password_hash);
                    if (isValid) {
                        console.log('✅ 密碼驗證成功');
                    } else {
                        console.log('❌ 密碼驗證失敗');
                    }
                } catch (error) {
                    console.error('❌ 密碼驗證錯誤:', error.message);
                }
                
                console.log('\n🎯 設置完成！');
                console.log('\n📋 登入信息:');
                console.log('   用戶名: admin');
                console.log('   密碼: admin123');
                console.log('   角色: admin');
                
                console.log('\n🌐 訪問頁面:');
                console.log('   登入: https://www.bma-hk.com/login.html');
                console.log('   管理: https://www.bma-hk.com/admin');
                console.log('   預測: https://www.bma-hk.com/index.html');
                
                db.close();
            });
        });
        
    } catch (error) {
        console.error('❌ 創建過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始創建
createSimpleAdmin();
