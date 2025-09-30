const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function debugQueriesAPI() {
  try {
    console.log('🔍 調試查詢API問題...');
    
    // 1. 檢查user_queries表
    console.log('\n1. 檢查user_queries表:');
    const { data: queries, error: queriesError } = await supabase
      .from('user_queries')
      .select('*')
      .limit(5);
    
    if (queriesError) {
      console.log('❌ user_queries表查詢失敗:', queriesError.message);
      return;
    }
    
    console.log('✅ user_queries表查詢成功');
    console.log('   找到', queries.length, '條記錄');
    queries.forEach((q, index) => {
      console.log(`   記錄 ${index + 1}:`, q.username, q.type, q.content.substring(0, 20) + '...');
    });
    
    // 2. 檢查users表
    console.log('\n2. 檢查users表:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username, full_name, email')
      .limit(5);
    
    if (usersError) {
      console.log('❌ users表查詢失敗:', usersError.message);
    } else {
      console.log('✅ users表查詢成功');
      console.log('   找到', users.length, '個用戶');
      users.forEach((u, index) => {
        console.log(`   用戶 ${index + 1}:`, u.username, u.full_name);
      });
    }
    
    // 3. 測試JOIN查詢（這是問題所在）
    console.log('\n3. 測試JOIN查詢:');
    const { data: joinQueries, error: joinError } = await supabase
      .from('user_queries')
      .select(`
        *,
        users (
          full_name,
          email
        )
      `)
      .limit(3);
    
    if (joinError) {
      console.log('❌ JOIN查詢失敗:', joinError.message);
      console.log('💡 這可能是問題的原因！');
      
      // 嘗試不帶JOIN的查詢
      console.log('\n4. 嘗試不帶JOIN的查詢:');
      const { data: simpleQueries, error: simpleError } = await supabase
        .from('user_queries')
        .select('*')
        .limit(3);
      
      if (simpleError) {
        console.log('❌ 簡單查詢也失敗:', simpleError.message);
      } else {
        console.log('✅ 簡單查詢成功，問題在於JOIN操作');
        console.log('   找到', simpleQueries.length, '條記錄');
      }
    } else {
      console.log('✅ JOIN查詢成功');
      console.log('   找到', joinQueries.length, '條記錄');
    }
    
    // 4. 檢查外鍵關係
    console.log('\n5. 檢查外鍵關係:');
    const { data: foreignKeyTest, error: fkError } = await supabase
      .from('user_queries')
      .select('username')
      .limit(1);
    
    if (fkError) {
      console.log('❌ 外鍵檢查失敗:', fkError.message);
    } else {
      console.log('✅ 外鍵檢查成功');
      
      // 檢查username是否在users表中存在
      if (foreignKeyTest.length > 0) {
        const username = foreignKeyTest[0].username;
        const { data: userExists, error: userExistsError } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .single();
        
        if (userExistsError) {
          console.log('⚠️  用戶', username, '在users表中不存在');
          console.log('💡 這可能是JOIN失敗的原因');
        } else {
          console.log('✅ 用戶', username, '在users表中存在');
        }
      }
    }
    
    console.log('\n🎯 診斷完成！');
    console.log('如果JOIN查詢失敗，請檢查:');
    console.log('1. user_queries表中的username是否與users表中的username匹配');
    console.log('2. 外鍵約束是否正確設置');
    console.log('3. 可能需要修復數據一致性');
    
  } catch (err) {
    console.log('❌ 調試時出錯:', err.message);
  }
}

debugQueriesAPI();
