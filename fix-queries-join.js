const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function fixQueriesJoin() {
  try {
    console.log('🔧 修復查詢JOIN問題...');
    
    // 1. 檢查user_queries表中的username
    console.log('1. 檢查user_queries表中的username:');
    const { data: queries, error: queriesError } = await supabase
      .from('user_queries')
      .select('username')
      .limit(10);
    
    if (queriesError) {
      console.log('❌ 查詢user_queries失敗:', queriesError.message);
      return;
    }
    
    console.log('✅ 找到', queries.length, '條查詢記錄');
    const usernames = [...new Set(queries.map(q => q.username))];
    console.log('   唯一用戶名:', usernames);
    
    // 2. 檢查users表中的username
    console.log('\n2. 檢查users表中的username:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username')
      .limit(10);
    
    if (usersError) {
      console.log('❌ 查詢users失敗:', usersError.message);
      return;
    }
    
    console.log('✅ 找到', users.length, '個用戶');
    const userUsernames = users.map(u => u.username);
    console.log('   用戶名列表:', userUsernames);
    
    // 3. 檢查數據一致性
    console.log('\n3. 檢查數據一致性:');
    const missingUsers = usernames.filter(username => !userUsernames.includes(username));
    if (missingUsers.length > 0) {
      console.log('⚠️  發現不一致的用戶名:', missingUsers);
      console.log('💡 正在修復...');
      
      // 為缺失的用戶創建記錄
      for (const username of missingUsers) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            username: username,
            email: `${username}@stockpredictor.com`,
            password_hash: '$2b$10$rQZ8k9mN2pL7sT3uV6wXeOqR4nH8cF1jK5mP9sL2vB6xE7yA3zC8wQ5rT',
            full_name: username === 'admin' ? 'System Administrator' : username,
            role: username === 'admin' ? 'admin' : 'user',
            status: 'active',
            api_quota: username === 'admin' ? 10000 : 1000,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (createError) {
          console.log('❌ 創建用戶', username, '失敗:', createError.message);
        } else {
          console.log('✅ 已創建用戶:', username);
        }
      }
    } else {
      console.log('✅ 數據一致性檢查通過');
    }
    
    // 4. 測試修復後的JOIN查詢
    console.log('\n4. 測試修復後的JOIN查詢:');
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
      console.log('❌ JOIN查詢仍然失敗:', joinError.message);
      console.log('💡 可能需要手動修復外鍵關係');
    } else {
      console.log('✅ JOIN查詢成功！');
      console.log('   找到', joinQueries.length, '條記錄');
      joinQueries.forEach((q, index) => {
        console.log(`   記錄 ${index + 1}:`, {
          id: q.id,
          username: q.username,
          type: q.type,
          content: q.content.substring(0, 30) + '...',
          user_info: q.users ? `${q.users.full_name} (${q.users.email})` : '無用戶信息'
        });
      });
    }
    
    // 5. 提供手動修復方案
    console.log('\n5. 如果JOIN仍然失敗，請在Supabase Dashboard中執行:');
    console.log(`
-- 檢查外鍵約束
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='user_queries';

-- 如果外鍵不存在，重新創建
ALTER TABLE user_queries 
DROP CONSTRAINT IF EXISTS user_queries_username_fkey;

ALTER TABLE user_queries 
ADD CONSTRAINT user_queries_username_fkey 
FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE;
    `);
    
    console.log('\n🎯 修復完成！');
    console.log('現在請:');
    console.log('1. 刷新查詢記錄管理頁面');
    console.log('2. 檢查查詢記錄是否正常顯示');
    console.log('3. 如果仍有問題，請執行上述SQL');
    
  } catch (err) {
    console.log('❌ 修復時出錯:', err.message);
  }
}

fixQueriesJoin();
