const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function debugSession() {
  try {
    console.log('🔍 調試會話和用戶數據...');
    
    // 1. 檢查admin用戶
    console.log('\n1. 檢查admin用戶:');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .single();
    
    if (userError) {
      console.log('❌ 查找admin用戶時出錯:', userError.message);
      return;
    }
    
    if (user) {
      console.log('✅ admin用戶信息:');
      console.log('   ID:', user.id);
      console.log('   用戶名:', user.username);
      console.log('   角色:', user.role);
      console.log('   狀態:', user.status);
      console.log('   創建時間:', user.created_at);
      
      if (user.role !== 'admin') {
        console.log('⚠️  角色不是admin，正在修復...');
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('username', 'admin')
          .select()
          .single();
        
        if (updateError) {
          console.log('❌ 更新角色失敗:', updateError.message);
        } else {
          console.log('✅ 角色已修復為admin');
        }
      }
    } else {
      console.log('❌ admin用戶不存在');
    }
    
    // 2. 檢查sessions表
    console.log('\n2. 檢查sessions表:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(5);
    
    if (sessionsError) {
      console.log('❌ sessions表不存在:', sessionsError.message);
      console.log('💡 需要在Supabase中創建sessions表');
    } else {
      console.log('✅ sessions表存在，找到', sessions.length, '個會話');
      sessions.forEach((session, index) => {
        console.log(`   會話 ${index + 1}:`);
        console.log('     Token:', session.token.substring(0, 20) + '...');
        console.log('     用戶ID:', session.user_id);
        console.log('     過期時間:', session.expires_at);
      });
    }
    
    // 3. 檢查會話關聯的用戶
    if (sessions && sessions.length > 0) {
      console.log('\n3. 檢查會話關聯的用戶:');
      for (const session of sessions) {
        const { data: sessionUser, error: sessionUserError } = await supabase
          .from('users')
          .select('username, role, status')
          .eq('id', session.user_id)
          .single();
        
        if (sessionUserError) {
          console.log('❌ 查找會話用戶時出錯:', sessionUserError.message);
        } else {
          console.log('   會話用戶:', sessionUser.username, '角色:', sessionUser.role);
        }
      }
    }
    
    console.log('\n🎯 診斷完成！');
    console.log('如果admin用戶角色不是admin，請在Supabase Dashboard中執行:');
    console.log("UPDATE users SET role = 'admin' WHERE username = 'admin';");
    
  } catch (err) {
    console.log('❌ 調試時出錯:', err.message);
  }
}

debugSession();
