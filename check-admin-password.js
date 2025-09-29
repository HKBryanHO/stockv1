const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function checkAdminPassword() {
  try {
    console.log('🔍 檢查admin用戶密碼...');
    
    // 1. 獲取admin用戶信息
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
    console.log('   角色:', user.role);
    console.log('   狀態:', user.status);
    console.log('   密碼哈希:', user.password_hash ? user.password_hash.substring(0, 20) + '...' : '無');
    
    // 2. 測試密碼驗證
    const testPassword = 'admin123';
    console.log('\n🔐 測試密碼驗證...');
    
    if (user.password_hash) {
      const isValidPassword = await bcrypt.compare(testPassword, user.password_hash);
      console.log('密碼驗證結果:', isValidPassword ? '✅ 正確' : '❌ 錯誤');
      
      if (!isValidPassword) {
        console.log('\n⚠️  密碼不匹配，正在重置密碼...');
        
        // 生成新的密碼哈希
        const newPasswordHash = await bcrypt.hash(testPassword, 10);
        
        // 更新密碼
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ password_hash: newPasswordHash })
          .eq('username', 'admin')
          .select()
          .single();
        
        if (updateError) {
          console.log('❌ 更新密碼失敗:', updateError.message);
        } else {
          console.log('✅ 密碼已重置');
          console.log('   用戶名: admin');
          console.log('   密碼: admin123');
        }
      }
    } else {
      console.log('❌ 用戶沒有密碼哈希，正在設置密碼...');
      
      const newPasswordHash = await bcrypt.hash(testPassword, 10);
      
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('username', 'admin')
        .select()
        .single();
      
      if (updateError) {
        console.log('❌ 設置密碼失敗:', updateError.message);
      } else {
        console.log('✅ 密碼已設置');
        console.log('   用戶名: admin');
        console.log('   密碼: admin123');
      }
    }
    
    console.log('\n🎯 修復完成！現在請:');
    console.log('1. 清除瀏覽器緩存和cookies');
    console.log('2. 重新登入 (用戶名: admin, 密碼: admin123)');
    console.log('3. 測試admin權限');
    
  } catch (err) {
    console.log('❌ 檢查密碼時出錯:', err.message);
  }
}

checkAdminPassword();
