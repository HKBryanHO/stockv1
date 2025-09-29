const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function quickFixAdmin() {
  try {
    console.log('🚀 快速修復admin權限...');
    
    // 直接更新admin用戶的角色
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        role: 'admin',
        status: 'active',
        api_quota: 10000
      })
      .eq('username', 'admin')
      .select()
      .single();
    
    if (updateError) {
      console.log('❌ 更新admin用戶失敗:', updateError.message);
      console.log('💡 請手動在Supabase Dashboard中執行:');
      console.log("UPDATE users SET role = 'admin', status = 'active' WHERE username = 'admin';");
    } else {
      console.log('✅ admin用戶已修復:');
      console.log('   用戶名:', updatedUser.username);
      console.log('   角色:', updatedUser.role);
      console.log('   狀態:', updatedUser.status);
      console.log('   API配額:', updatedUser.api_quota);
    }
    
    // 檢查sessions表是否存在
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.log('\n⚠️  sessions表不存在，請在Supabase Dashboard中執行:');
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
      console.log('\n✅ sessions表存在');
    }
    
    console.log('\n🎯 修復完成！請:');
    console.log('1. 清除瀏覽器緩存和cookies');
    console.log('2. 重新登入admin帳戶');
    console.log('3. 測試admin權限');
    
  } catch (err) {
    console.log('❌ 修復時出錯:', err.message);
  }
}

quickFixAdmin();
