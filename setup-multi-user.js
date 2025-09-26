#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

console.log('🚀 設置多用戶系統...\n');

// 確保目錄存在
const dbDir = 'database';
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ 創建數據庫目錄');
}

// 創建數據庫和表
const dbPath = path.join(dbDir, 'users.db');
const db = new sqlite3.Database(dbPath);

// 創建表的SQL
const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        preferences TEXT,
        api_quota INTEGER DEFAULT 1000,
        api_usage INTEGER DEFAULT 0
    );

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

    CREATE TABLE IF NOT EXISTS user_portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        holdings JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_default BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        prediction_data JSON NOT NULL,
        model_used VARCHAR(50),
        confidence_score DECIMAL(5,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 索引優化
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON user_portfolios(user_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON user_predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON user_predictions(symbol);
`;

// 執行SQL創建表
db.exec(createTablesSQL, (err) => {
    if (err) {
        console.error('❌ 創建數據庫表失敗:', err);
        process.exit(1);
    }
    console.log('✅ 數據庫表創建成功');
});

// 創建默認管理員用戶
async function createDefaultAdmin() {
    return new Promise((resolve, reject) => {
        // 檢查是否已存在管理員用戶
        db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1', (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (row) {
                console.log('✅ 管理員用戶已存在');
                resolve();
                return;
            }

            // 創建默認管理員用戶
            const adminPassword = 'admin123';
            bcrypt.hash(adminPassword, 10, (err, hash) => {
                if (err) {
                    reject(err);
                    return;
                }

                const sql = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota) 
                           VALUES (?, ?, ?, ?, ?, ?)`;
                
                db.run(sql, [
                    'admin',
                    'admin@stockpredictor.com',
                    hash,
                    'System Administrator',
                    'admin',
                    10000 // 更高的API配額
                ], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('✅ 默認管理員用戶創建成功');
                    console.log('   用戶名: admin');
                    console.log('   密碼: admin123');
                    console.log('   ⚠️  請在首次登入後立即修改密碼！');
                    resolve();
                });
            });
        });
    });
}

// 創建示例用戶
async function createSampleUsers() {
    const sampleUsers = [
        {
            username: 'demo_user',
            email: 'demo@example.com',
            password: 'demo123',
            fullName: 'Demo User',
            role: 'user'
        },
        {
            username: 'premium_user',
            email: 'premium@example.com',
            password: 'premium123',
            fullName: 'Premium User',
            role: 'premium'
        }
    ];

    for (const userData of sampleUsers) {
        await new Promise((resolve, reject) => {
            // 檢查用戶是否已存在
            db.get('SELECT id FROM users WHERE username = ?', [userData.username], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row) {
                    console.log(`✅ 示例用戶 ${userData.username} 已存在`);
                    resolve();
                    return;
                }

                // 創建用戶
                bcrypt.hash(userData.password, 10, (err, hash) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const sql = `INSERT INTO users (username, email, password_hash, full_name, role) 
                               VALUES (?, ?, ?, ?, ?)`;
                    
                    db.run(sql, [
                        userData.username,
                        userData.email,
                        hash,
                        userData.fullName,
                        userData.role
                    ], function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        console.log(`✅ 示例用戶 ${userData.username} 創建成功`);
                        resolve();
                    });
                });
            });
        });
    }
}

// 主設置流程
async function setupMultiUserSystem() {
    try {
        // 創建默認管理員
        await createDefaultAdmin();
        
        // 詢問是否創建示例用戶
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const createSamples = await new Promise((resolve) => {
            rl.question('\n是否創建示例用戶？(y/N): ', (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });

        if (createSamples) {
            await createSampleUsers();
        }

        // 關閉數據庫連接
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉數據庫連接失敗:', err);
                process.exit(1);
            }
            console.log('\n🎉 多用戶系統設置完成！');
            console.log('\n📋 下一步:');
            console.log('1. 運行 npm install 安裝依賴');
            console.log('2. 配置 .env 文件');
            console.log('3. 啟動服務器: npm start');
            console.log('4. 訪問 http://localhost:3001 開始使用');
            console.log('\n🔐 默認管理員帳戶:');
            console.log('   用戶名: admin');
            console.log('   密碼: admin123');
            console.log('   ⚠️  請在首次登入後立即修改密碼！');
        });

    } catch (error) {
        console.error('❌ 設置失敗:', error);
        process.exit(1);
    }
}

// 開始設置
setupMultiUserSystem();
