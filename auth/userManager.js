const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class UserManager {
    constructor(dbPath = 'database/users.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            // 確保數據庫目錄存在
            const fs = require('fs');
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            const sqlPath = path.join(__dirname, '..', 'database', 'users.sql');
            
            if (!fs.existsSync(sqlPath)) {
                // 如果SQL文件不存在，創建基本表結構
                const createTablesSQL = `
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

                    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
                    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

                    INSERT OR IGNORE INTO users (username, email, password_hash, full_name, role) 
                    VALUES ('admin', 'admin@stockpredictor.com', '$2b$10$rQZ8k9mN2pL7sT3uV6wXeOqR4nH8cF1jK5mP9sL2vB6xE7yA3zC8wQ5rT', 'System Administrator', 'admin');
                `;
                
                this.db.exec(createTablesSQL, (err) => {
                    if (err) {
                        console.error('Error creating tables:', err);
                        reject(err);
                    } else {
                        console.log('Database tables created successfully');
                        resolve();
                    }
                });
            } else {
                const sql = fs.readFileSync(sqlPath, 'utf8');
                this.db.exec(sql, (err) => {
                    if (err) {
                        console.error('Error creating tables from SQL file:', err);
                        reject(err);
                    } else {
                        console.log('Database tables created from SQL file');
                        resolve();
                    }
                });
            }
        });
    }

    async createUser(userData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { username, email, password, fullName, role = 'user' } = userData;
                
                // 檢查用戶名和郵箱是否已存在
                const existingUser = await this.getUserByUsername(username);
                if (existingUser) {
                    return reject(new Error('Username already exists'));
                }

                const existingEmail = await this.getUserByEmail(email);
                if (existingEmail) {
                    return reject(new Error('Email already exists'));
                }

                // 加密密碼
                const saltRounds = 10;
                const passwordHash = await bcrypt.hash(password, saltRounds);

                const sql = `INSERT INTO users (username, email, password_hash, full_name, role) 
                           VALUES (?, ?, ?, ?, ?)`;
                
                this.db.run(sql, [username, email, passwordHash, fullName, role], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, username, email, fullName, role });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE username = ? AND status = "active"';
            this.db.get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE email = ? AND status = "active"';
            this.db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE id = ? AND status = "active"';
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async authenticateUser(username, password) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user) {
                return null;
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return null;
            }

            // 更新最後登入時間
            await this.updateLastLogin(user.id);

            // 返回用戶信息（不包含密碼）
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    async updateLastLogin(userId) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
            this.db.run(sql, [userId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async createSession(userId, ipAddress, userAgent) {
        return new Promise((resolve, reject) => {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12小時

            // 清理過期會話
            this.cleanExpiredSessions();

            const sql = `INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent) 
                        VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [userId, token, expiresAt.toISOString(), ipAddress, userAgent], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ token, expiresAt });
                }
            });
        });
    }

    async getSession(token) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT s.*, u.username, u.email, u.full_name, u.role, u.status 
                        FROM user_sessions s 
                        JOIN users u ON s.user_id = u.id 
                        WHERE s.session_token = ? AND s.expires_at > datetime('now')`;
            
            this.db.get(sql, [token], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async deleteSession(token) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM user_sessions WHERE session_token = ?';
            this.db.run(sql, [token], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async cleanExpiredSessions() {
        return new Promise((resolve, reject) => {
            const sql = "DELETE FROM user_sessions WHERE expires_at <= datetime('now')";
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async getAllUsers(limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, username, email, full_name, role, status, created_at, last_login 
                        FROM users 
                        ORDER BY created_at DESC 
                        LIMIT ? OFFSET ?`;
            
            this.db.all(sql, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateUser(userId, updates) {
        return new Promise((resolve, reject) => {
            const allowedFields = ['full_name', 'email', 'role', 'status', 'preferences', 'api_quota'];
            const updateFields = [];
            const values = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updateFields.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updateFields.length === 0) {
                return resolve(false);
            }

            values.push(userId);
            const sql = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async changePassword(userId, newPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('UserManager.changePassword called with:', { userId, hasPassword: !!newPassword });
                
                if (!this.db) {
                    throw new Error('Database not initialized');
                }
                
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
                console.log('Password hashed successfully');
                
                const sql = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                this.db.run(sql, [hashedPassword, userId], function(err) {
                    if (err) {
                        console.error('Database error in changePassword:', err);
                        reject(err);
                    } else {
                        console.log('Password update result:', this.changes);
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                console.error('Error in changePassword:', error);
                reject(error);
            }
        });
    }

    async deleteUser(userId) {
        return new Promise((resolve, reject) => {
            // 軟刪除：將狀態設為 inactive
            const sql = 'UPDATE users SET status = "inactive" WHERE id = ?';
            this.db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async getUserStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                    COUNT(CASE WHEN last_login > datetime('now', '-30 days') THEN 1 END) as recent_users
                FROM users
            `;
            
            this.db.get(sql, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = UserManager;
