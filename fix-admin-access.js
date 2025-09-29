const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function fixAdminAccess() {
  try {
    console.log('🔧 修復admin訪問權限...');
    
    // 1. 檢查admin用戶
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .single();
    
    if (userError) {
      console.log('❌ 查找admin用戶時出錯:', userError.message);
      return;
    }
    
    if (!user) {
      console.log('❌ admin用戶不存在');
      return;
    }
    
    console.log('✅ 找到admin用戶:');
    console.log('   ID:', user.id);
    console.log('   用戶名:', user.username);
    console.log('   當前角色:', user.role);
    console.log('   狀態:', user.status);
    
    // 2. 修復admin角色和狀態
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
    } else {
      console.log('✅ admin用戶已修復:');
      console.log('   角色:', updatedUser.role);
      console.log('   狀態:', updatedUser.status);
      console.log('   API配額:', updatedUser.api_quota);
    }
    
    // 3. 檢查sessions表
    console.log('\n🔍 檢查sessions表...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.log('❌ sessions表不存在或無法訪問:', sessionsError.message);
      console.log('\n💡 解決方案:');
      console.log('1. 登入Supabase Dashboard');
      console.log('2. 進入你的項目');
      console.log('3. 在SQL編輯器中執行以下SQL:');
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
    
    console.log('\n🎯 修復完成！現在請:');
    console.log('1. 確保Supabase中有sessions表');
    console.log('2. 重新登入admin帳戶');
    console.log('3. 檢查admin權限是否正常');
    
  } catch (err) {
    console.log('❌ 修復時出錯:', err.message);
  }
}

fixAdminAccess();
