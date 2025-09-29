const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function fixQueryRecords() {
  try {
    console.log('🔧 修復查詢記錄功能...');
    
    // 1. 檢查user_queries表是否存在
    console.log('1. 檢查user_queries表...');
    const { data: queries, error: queriesError } = await supabase
      .from('user_queries')
      .select('*')
      .limit(1);
    
    if (queriesError) {
      console.log('❌ user_queries表不存在:', queriesError.message);
      console.log('💡 請在Supabase Dashboard中執行以下SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS user_queries (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
  content TEXT NOT NULL,
  result TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_queries_username ON user_queries(username);
CREATE INDEX IF NOT EXISTS idx_user_queries_type ON user_queries(type);
CREATE INDEX IF NOT EXISTS idx_user_queries_created_at ON user_queries(created_at);
      `);
    } else {
      console.log('✅ user_queries表存在');
      console.log('   找到', queries.length, '條查詢記錄');
    }
    
    // 2. 檢查sessions表
    console.log('\n2. 檢查sessions表...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.log('❌ sessions表不存在:', sessionsError.message);
      console.log('💡 請在Supabase Dashboard中執行以下SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);
    } else {
      console.log('✅ sessions表存在');
    }
    
    // 3. 添加一些測試查詢記錄
    console.log('\n3. 添加測試查詢記錄...');
    const testQueries = [
      {
        username: 'admin',
        type: 'stock',
        content: 'AAPL股價分析',
        result: 'AAPL當前價格: $150.00',
        metadata: { symbol: 'AAPL', price: 150.00 }
      },
      {
        username: 'admin',
        type: 'ai',
        content: '什麼是股票投資？',
        result: '股票投資是購買公司股份的行為...',
        metadata: { model: 'GPT-4', category: 'general' }
      }
    ];
    
    const { data: insertedQueries, error: insertError } = await supabase
      .from('user_queries')
      .insert(testQueries)
      .select();
    
    if (insertError) {
      console.log('⚠️  添加測試記錄失敗:', insertError.message);
    } else {
      console.log('✅ 已添加', insertedQueries.length, '條測試查詢記錄');
    }
    
    // 4. 檢查查詢統計
    console.log('\n4. 檢查查詢統計...');
    const { data: allQueries, error: statsError } = await supabase
      .from('user_queries')
      .select('type, created_at');
    
    if (statsError) {
      console.log('❌ 獲取統計數據失敗:', statsError.message);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        total: allQueries.length,
        stock: allQueries.filter(q => q.type === 'stock').length,
        ai: allQueries.filter(q => q.type === 'ai').length,
        today: allQueries.filter(q => q.created_at.startsWith(today)).length
      };
      
      console.log('📊 查詢統計:');
      console.log('   總查詢數:', stats.total);
      console.log('   股票查詢:', stats.stock);
      console.log('   AI查詢:', stats.ai);
      console.log('   今日查詢:', stats.today);
    }
    
    console.log('\n🎯 修復完成！');
    console.log('現在請:');
    console.log('1. 刷新admin查詢管理頁面');
    console.log('2. 檢查查詢記錄是否正常顯示');
    console.log('3. 測試篩選和導出功能');
    
  } catch (err) {
    console.log('❌ 修復查詢記錄時出錯:', err.message);
  }
}

fixQueryRecords();
