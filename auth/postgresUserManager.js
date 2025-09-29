const bcrypt = require('bcrypt');
const { Pool } = require('pg');

class PostgresUserManager {
    constructor() {
        this.pool = null;
        this.init();
    }

    async init() {
        try {
            // 從環境變量獲取數據庫配置
            const config = {
                user: process.env.PG_USER || process.env.POSTGRES_USER,
                host: process.env.PG_HOST || process.env.POSTGRES_HOST,
                database: process.env.PG_DATABASE || process.env.POSTGRES_DB,
                password: process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD,
                port: process.env.PG_PORT || process.env.POSTGRES_PORT || 5432,
                ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
            };

            // 如果提供了完整的連接字符串，使用它
            if (process.env.DATABASE_URL) {
                this.pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
                });
            } else {
                this.pool = new Pool(config);
            }

            // 測試連接
            const client = await this.pool.connect();
            console.log('✅ PostgreSQL 數據庫連接成功');
            client.release();

        } catch (error) {
            console.error('❌ PostgreSQL 數據庫連接失敗:', error.message);
            throw error;
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        try {
            const createTablesSQL = `
                -- 用戶表
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(100),
                    role VARCHAR(20) DEFAULT 'user' CHECK(role IN ('admin', 'user', 'premium')),
                    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    preferences TEXT,
                    api_quota INTEGER DEFAULT 1000,
                    api_usage INTEGER DEFAULT 0
                );

                -- 用戶會話表
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    session_token VARCHAR(255) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45),
                    user_agent TEXT
                );

                -- 用戶投資組合表
                CREATE TABLE IF NOT EXISTS user_portfolios (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    holdings JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_default BOOLEAN DEFAULT FALSE
                );

                -- 用戶預測表
                CREATE TABLE IF NOT EXISTS user_predictions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    symbol VARCHAR(20) NOT NULL,
                    prediction_data JSONB NOT NULL,
                    model_used VARCHAR(50),
                    confidence_score DECIMAL(5,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- 用戶查詢表
                CREATE TABLE IF NOT EXISTS user_queries (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
                    content TEXT NOT NULL,
                    result TEXT,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- 創建索引
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
                CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
                CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
                CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON user_portfolios(user_id);
                CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON user_predictions(user_id);
                CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON user_predictions(symbol);
                CREATE INDEX IF NOT EXISTS idx_queries_username ON user_queries(username);
                CREATE INDEX IF NOT EXISTS idx_queries_type ON user_queries(type);
                CREATE INDEX IF NOT EXISTS idx_queries_created_at ON user_queries(created_at);

                -- 創建 JSONB 索引
                CREATE INDEX IF NOT EXISTS idx_portfolios_holdings ON user_portfolios USING GIN (holdings);
                CREATE INDEX IF NOT EXISTS idx_predictions_data ON user_predictions USING GIN (prediction_data);
                CREATE INDEX IF NOT EXISTS idx_queries_metadata ON user_queries USING GIN (metadata);
            `;

            await client.query(createTablesSQL);
            console.log('✅ PostgreSQL 表結構創建成功');

        } catch (error) {
            console.error('❌ 創建表結構失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async createUser(userData) {
        const { username, email, password, full_name, role = 'user' } = userData;
        const passwordHash = await bcrypt.hash(password, 10);
        
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO users (username, email, password_hash, full_name, role)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, username, email, role, status, created_at
            `;
            
            const result = await client.query(query, [username, email, passwordHash, full_name, role]);
            return result.rows[0];
        } catch (error) {
            console.error('創建用戶失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async authenticateUser(username, password) {
        const client = await this.pool.connect();
        try {
            const query = 'SELECT * FROM users WHERE username = $1 OR email = $1';
            const result = await client.query(query, [username]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return null;
            }
            
            // 更新最後登入時間
            await client.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
                full_name: user.full_name,
                api_quota: user.api_quota,
                api_usage: user.api_usage
            };
        } catch (error) {
            console.error('用戶認證失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserById(userId) {
        const client = await this.pool.connect();
        try {
            const query = 'SELECT * FROM users WHERE id = $1';
            const result = await client.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('獲取用戶失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserByUsername(username) {
        const client = await this.pool.connect();
        try {
            const query = 'SELECT * FROM users WHERE username = $1 OR email = $1';
            const result = await client.query(query, [username]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('獲取用戶失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getAllUsers(page = 1, limit = 20) {
        const client = await this.pool.connect();
        try {
            const offset = (page - 1) * limit;
            
            // 獲取用戶列表
            const usersQuery = `
                SELECT id, username, email, full_name, role, status, 
                       created_at, last_login, api_quota, api_usage
                FROM users 
                ORDER BY created_at DESC 
                LIMIT $1 OFFSET $2
            `;
            const usersResult = await client.query(usersQuery, [limit, offset]);
            
            // 獲取總數
            const countQuery = 'SELECT COUNT(*) FROM users';
            const countResult = await client.query(countQuery);
            const total = parseInt(countResult.rows[0].count);
            
            // 獲取統計信息
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_users
                FROM users
            `;
            const statsResult = await client.query(statsQuery);
            
            return {
                users: usersResult.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats: statsResult.rows[0]
            };
        } catch (error) {
            console.error('獲取用戶列表失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateUser(userId, updates) {
        const client = await this.pool.connect();
        try {
            const allowedFields = ['username', 'email', 'full_name', 'role', 'status', 'api_quota'];
            const updateFields = [];
            const values = [];
            let paramCount = 1;
            
            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updateFields.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }
            
            if (updateFields.length === 0) {
                throw new Error('沒有有效的更新字段');
            }
            
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(userId);
            
            const query = `
                UPDATE users 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramCount}
                RETURNING id, username, email, full_name, role, status, updated_at
            `;
            
            const result = await client.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('更新用戶失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteUser(userId) {
        const client = await this.pool.connect();
        try {
            const query = 'DELETE FROM users WHERE id = $1 RETURNING username';
            const result = await client.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('刪除用戶失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async logQuery(username, type, content, result, metadata = {}) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO user_queries (username, type, content, result, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `;
            
            const result_query = await client.query(query, [username, type, content, result, metadata]);
            return result_query.rows[0].id;
        } catch (error) {
            console.error('記錄查詢失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getQueryStats() {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_queries,
                    COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                    COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                    COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries,
                    COUNT(CASE WHEN type = 'analysis' THEN 1 END) as analysis_queries,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_queries
                FROM user_queries
            `;
            
            const result = await client.query(query);
            return result.rows[0];
        } catch (error) {
            console.error('獲取查詢統計失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getQueries(filters = {}, page = 1, limit = 20) {
        const client = await this.pool.connect();
        try {
            const { user, type, date_from, date_to, keyword } = filters;
            const offset = (page - 1) * limit;
            
            let whereConditions = [];
            let params = [];
            let paramCount = 1;
            
            if (user) {
                whereConditions.push(`q.username = $${paramCount}`);
                params.push(user);
                paramCount++;
            }
            if (type) {
                whereConditions.push(`q.type = $${paramCount}`);
                params.push(type);
                paramCount++;
            }
            if (date_from) {
                whereConditions.push(`DATE(q.created_at) >= $${paramCount}`);
                params.push(date_from);
                paramCount++;
            }
            if (date_to) {
                whereConditions.push(`DATE(q.created_at) <= $${paramCount}`);
                params.push(date_to);
                paramCount++;
            }
            if (keyword) {
                whereConditions.push(`(q.content ILIKE $${paramCount} OR q.result ILIKE $${paramCount})`);
                params.push(`%${keyword}%`);
                paramCount++;
            }
            
            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
            
            // 獲取查詢記錄
            const queriesQuery = `
                SELECT q.*, u.full_name, u.email
                FROM user_queries q
                LEFT JOIN users u ON q.username = u.username
                ${whereClause}
                ORDER BY q.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;
            params.push(limit, offset);
            
            const queriesResult = await client.query(queriesQuery, params);
            
            // 獲取總數
            const countQuery = `
                SELECT COUNT(*) as count
                FROM user_queries q
                ${whereClause}
            `;
            const countParams = params.slice(0, -2); // 移除 limit 和 offset
            const countResult = await client.query(countQuery, countParams);
            
            return {
                queries: queriesResult.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0].count),
                    pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
                }
            };
        } catch (error) {
            console.error('獲取查詢記錄失敗:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('PostgreSQL 連接池已關閉');
        }
    }
}

module.exports = PostgresUserManager;
