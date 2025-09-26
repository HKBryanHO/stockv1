#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🚨 繞過認證問題的最終修復...\n');

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

// 繞過認證問題的最終修復
async function bypassAuthFix() {
    try {
        console.log('🔄 開始繞過認證修復...');
        
        // 1. 完全清理數據庫
        console.log('🗑️ 完全清理數據庫...');
        db.exec('DROP TABLE IF EXISTS user_sessions;');
        db.exec('DROP TABLE IF EXISTS user_queries;');
        db.exec('DROP TABLE IF EXISTS user_portfolios;');
        db.exec('DROP TABLE IF EXISTS user_predictions;');
        db.exec('DROP TABLE IF EXISTS users;');
        
        // 等待清理完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. 重新創建用戶表
        console.log('🏗️ 重新創建用戶表...');
        const createUsersTable = `
            CREATE TABLE users (
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
        
        db.exec(createUsersTable, (err) => {
            if (err) {
                console.error('❌ 創建用戶表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 用戶表創建成功');
        });
        
        // 3. 創建會話表
        const createSessionsTable = `
            CREATE TABLE user_sessions (
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
        
        db.exec(createSessionsTable, (err) => {
            if (err) {
                console.error('❌ 創建會話表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 會話表創建成功');
        });
        
        // 4. 創建查詢表
        const createQueriesTable = `
            CREATE TABLE user_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
                content TEXT NOT NULL,
                result TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
        `;
        
        db.exec(createQueriesTable, (err) => {
            if (err) {
                console.error('❌ 創建查詢表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 查詢表創建成功');
        });
        
        // 5. 創建索引
        console.log('📊 創建索引...');
        const indexes = [
            'CREATE INDEX idx_users_username ON users(username);',
            'CREATE INDEX idx_users_email ON users(email);',
            'CREATE INDEX idx_sessions_token ON user_sessions(session_token);',
            'CREATE INDEX idx_queries_username ON user_queries(username);'
        ];
        
        indexes.forEach((indexSQL, i) => {
            db.exec(indexSQL, (err) => {
                if (err) {
                    console.warn(`⚠️ 創建索引 ${i + 1} 警告:`, err.message);
                } else {
                    console.log(`✅ 索引 ${i + 1} 創建成功`);
                }
            });
        });
        
        // 6. 創建多個管理員用戶
        console.log('👥 創建多個管理員用戶...');
        const adminUsers = [
            { username: 'admin', password: 'admin123' },
            { username: 'Bryanho', password: 'Bryanho123' },
            { username: 'administrator', password: 'admin123' }
        ];
        
        for (const userData of adminUsers) {
            const passwordHash = await bcrypt.hash(userData.password, 10);
            
            const insertUserSQL = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) 
                                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(insertUserSQL, [
                userData.username,
                `${userData.username}@bma-hk.com`,
                passwordHash,
                `System Administrator (${userData.username})`,
                'admin',
                10000,
                'active'
            ], function(err) {
                if (err) {
                    console.warn(`⚠️ 創建用戶 ${userData.username} 警告:`, err.message);
                } else {
                    console.log(`✅ 用戶 ${userData.username} 創建成功 (ID: ${this.lastID})`);
                }
            });
        }
        
        // 等待用戶創建完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 7. 驗證所有用戶
        console.log('\n🔍 驗證所有用戶...');
        db.all('SELECT id, username, role, status FROM users', (err, users) => {
            if (err) {
                console.error('❌ 查詢用戶失敗:', err.message);
                process.exit(1);
            }
            
            console.log(`📊 找到 ${users.length} 個用戶:`);
            users.forEach(user => {
                console.log(`   - ID: ${user.id}, 用戶名: ${user.username}, 角色: ${user.role}, 狀態: ${user.status}`);
            });
            
            // 8. 測試密碼驗證
            console.log('\n🔐 測試密碼驗證...');
            const testPasswords = async () => {
                for (const user of users) {
                    try {
                        const userDetail = await new Promise((resolve, reject) => {
                            db.get('SELECT password_hash FROM users WHERE username = ?', [user.username], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
                        
                        const isValid = await bcrypt.compare('admin123', userDetail.password_hash);
                        console.log(`   ${user.username}: ${isValid ? '✅ 密碼正確' : '❌ 密碼錯誤'}`);
                    } catch (error) {
                        console.log(`   ${user.username}: ❌ 測試失敗 - ${error.message}`);
                    }
                }
            };
            
            testPasswords().then(() => {
                console.log('\n🎯 繞過認證修復完成！');
                console.log('\n📋 可用的管理員帳戶:');
                console.log('   1. 用戶名: admin, 密碼: admin123');
                console.log('   2. 用戶名: Bryanho, 密碼: Bryanho123');
                console.log('   3. 用戶名: administrator, 密碼: admin123');
                
                console.log('\n🌐 測試頁面:');
                console.log('   簡單登入: https://www.bma-hk.com/simple-login.html');
                console.log('   標準登入: https://www.bma-hk.com/login.html');
                console.log('   管理頁面: https://www.bma-hk.com/admin');
                console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                
                console.log('\n🔧 如果仍有問題:');
                console.log('1. 檢查服務器是否重啟');
                console.log('2. 檢查 UserManager 初始化');
                console.log('3. 查看服務器日誌');
                console.log('4. 嘗試不同的用戶名/密碼組合');
                
                db.close();
            });
        });
        
    } catch (error) {
        console.error('❌ 繞過認證修復過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始繞過認證修復
bypassAuthFix();
