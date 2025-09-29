#!/usr/bin/env node

const { Pool } = require('pg');

console.log('🔗 測試 PostgreSQL 數據庫連接...\n');

// 檢查環境變量
console.log('📋 環境變量檢查:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ 已設置' : '❌ 未設置');
console.log('PG_USER:', process.env.PG_USER || '未設置');
console.log('PG_HOST:', process.env.PG_HOST || '未設置');
console.log('PG_DATABASE:', process.env.PG_DATABASE || '未設置');
console.log('PG_SSL:', process.env.PG_SSL || '未設置');
console.log('');

async function testConnection() {
    try {
        // 創建連接池
        let pool;
        
        if (process.env.DATABASE_URL) {
            console.log('🔗 使用 DATABASE_URL 連接...');
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
            });
        } else {
            console.log('🔗 使用個別環境變量連接...');
            pool = new Pool({
                user: process.env.PG_USER,
                host: process.env.PG_HOST,
                database: process.env.PG_DATABASE,
                password: process.env.PG_PASSWORD,
                port: process.env.PG_PORT || 5432,
                ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
            });
        }
        
        // 測試連接
        console.log('🔄 測試數據庫連接...');
        const client = await pool.connect();
        console.log('✅ 數據庫連接成功！');
        
        // 測試查詢
        console.log('🔄 測試基本查詢...');
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        console.log('✅ 查詢成功！');
        console.log('   當前時間:', result.rows[0].current_time);
        console.log('   數據庫版本:', result.rows[0].version.split(' ')[0]);
        
        // 檢查表是否存在
        console.log('🔄 檢查表結構...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log('✅ 找到以下表:');
            tablesResult.rows.forEach(row => {
                console.log('   -', row.table_name);
            });
        } else {
            console.log('⚠️ 沒有找到任何表，需要創建表結構');
        }
        
        // 檢查用戶數量
        try {
            const userCountResult = await client.query('SELECT COUNT(*) FROM users');
            console.log('👤 用戶數量:', userCountResult.rows[0].count);
        } catch (err) {
            console.log('⚠️ users 表不存在');
        }
        
        // 檢查查詢記錄數量
        try {
            const queryCountResult = await client.query('SELECT COUNT(*) FROM user_queries');
            console.log('📝 查詢記錄數量:', queryCountResult.rows[0].count);
        } catch (err) {
            console.log('⚠️ user_queries 表不存在');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n🎯 數據庫連接測試完成！');
        console.log('\n📋 下一步:');
        console.log('1. 如果表不存在，請在 Supabase SQL 編輯器中創建表');
        console.log('2. 如果表已存在，可以運行遷移腳本');
        console.log('3. 更新 server.js 使用 PostgreSQL');
        
    } catch (error) {
        console.error('❌ 數據庫連接失敗:', error.message);
        
        console.log('\n🔧 故障排除建議:');
        console.log('1. 檢查環境變量是否正確設置');
        console.log('2. 確認 Supabase 項目是否創建成功');
        console.log('3. 檢查數據庫密碼是否正確');
        console.log('4. 確認項目引用 ID 是否正確');
        console.log('5. 檢查網絡連接');
        
        if (error.code === 'ENOTFOUND') {
            console.log('\n💡 如果是 ENOTFOUND 錯誤:');
            console.log('   - 檢查 PG_HOST 或 DATABASE_URL 中的主機名是否正確');
            console.log('   - 確認 Supabase 項目是否已創建完成');
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 如果是 ECONNREFUSED 錯誤:');
            console.log('   - 檢查端口號是否正確 (應該是 5432)');
            console.log('   - 確認 Supabase 項目狀態是否正常');
        }
        
        if (error.code === '28P01') {
            console.log('\n💡 如果是認證錯誤 (28P01):');
            console.log('   - 檢查用戶名和密碼是否正確');
            console.log('   - 確認 DATABASE_URL 中的密碼是否正確');
        }
        
        process.exit(1);
    }
}

// 開始測試
testConnection();
