const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function rebuildAdmin() {
  try {
    console.log('🔧 重建admin用戶...');
    
    // 1. 刪除現有的admin用戶
    console.log('1. 刪除現有admin用戶...');
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('username', 'admin');
    
    if (deleteError) {
      console.log('⚠️  刪除現有用戶時出錯:', deleteError.message);
    } else {
      console.log('✅ 現有admin用戶已刪除');
    }
    
    // 2. 創建新的admin用戶
    console.log('2. 創建新的admin用戶...');
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        username: 'admin',
        email: 'admin@stockpredictor.com',
        password_hash: hashedPassword,
        full_name: 'System Administrator',
        role: 'admin',
        status: 'active',
        api_quota: 10000,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (createError) {
      console.log('❌ 創建admin用戶失敗:', createError.message);
      return;
    }
    
    console.log('✅ 新的admin用戶已創建:');
    console.log('   ID:', newUser.id);
    console.log('   用戶名:', newUser.username);
    console.log('   角色:', newUser.role);
    console.log('   狀態:', newUser.status);
    console.log('   密碼: admin123');
    
    // 3. 測試密碼驗證
    console.log('\n3. 測試密碼驗證...');
    const testPassword = 'admin123';
    const isValidPassword = await bcrypt.compare(testPassword, newUser.password_hash);
    console.log('密碼驗證結果:', isValidPassword ? '✅ 正確' : '❌ 錯誤');
    
    // 4. 檢查sessions表
    console.log('\n4. 檢查sessions表...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.log('❌ sessions表不存在:', sessionsError.message);
      console.log('💡 請在Supabase Dashboard中創建sessions表');
    } else {
      console.log('✅ sessions表存在');
    }
    
    console.log('\n🎯 重建完成！');
    console.log('現在請:');
    console.log('1. 清除瀏覽器緩存和cookies');
    console.log('2. 重新登入 (用戶名: admin, 密碼: admin123)');
    console.log('3. 測試admin權限');
    
  } catch (err) {
    console.log('❌ 重建admin用戶時出錯:', err.message);
  }
}

rebuildAdmin();
