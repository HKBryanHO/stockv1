const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function testQueryLogging() {
  try {
    console.log('🧪 測試查詢記錄功能...');
    
    // 1. 檢查現有查詢記錄
    console.log('\n1. 檢查現有查詢記錄:');
    const { data: existingQueries, error: existingError } = await supabase
      .from('user_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (existingError) {
      console.log('❌ 查詢記錄失敗:', existingError.message);
      return;
    }
    
    console.log('✅ 找到', existingQueries.length, '條現有記錄');
    existingQueries.forEach((q, index) => {
      console.log(`   記錄 ${index + 1}:`, {
        id: q.id,
        username: q.username,
        type: q.type,
        content: q.content.substring(0, 30) + '...',
        created_at: q.created_at
      });
    });
    
    // 2. 添加測試查詢記錄
    console.log('\n2. 添加測試查詢記錄:');
    const testQueries = [
      {
        username: 'admin',
        type: 'stock',
        content: 'AAPL 股票預測 - 30天',
        result: '預測價格: $150.00, 信心度: 85.5%',
        metadata: { symbol: 'AAPL', price: 150.00, change: 2.5 }
      },
      {
        username: 'admin',
        type: 'ai',
        content: '什麼是股票投資？',
        result: '股票投資是購買公司股份的行為...',
        metadata: { model: 'GPT-4', category: 'general' }
      },
      {
        username: 'admin',
        type: 'stock',
        content: 'TSLA 技術分析',
        result: 'TSLA技術指標顯示強勢上漲趨勢',
        metadata: { symbol: 'TSLA', analysis: 'technical' }
      }
    ];
    
    for (const query of testQueries) {
      const { data, error } = await supabase
        .from('user_queries')
        .insert([{
          ...query,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.log('❌ 插入查詢記錄失敗:', error.message);
      } else {
        console.log('✅ 已添加查詢記錄:', data.id, query.type);
      }
    }
    
    // 3. 驗證記錄是否正確添加
    console.log('\n3. 驗證記錄添加:');
    const { data: newQueries, error: newError } = await supabase
      .from('user_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (newError) {
      console.log('❌ 驗證查詢失敗:', newError.message);
    } else {
      console.log('✅ 總共找到', newQueries.length, '條記錄');
      
      // 統計各類型查詢
      const stockQueries = newQueries.filter(q => q.type === 'stock').length;
      const aiQueries = newQueries.filter(q => q.type === 'ai').length;
      const todayQueries = newQueries.filter(q => {
        const today = new Date().toISOString().split('T')[0];
        return q.created_at.startsWith(today);
      }).length;
      
      console.log('📊 統計數據:');
      console.log('   總查詢數:', newQueries.length);
      console.log('   股票查詢:', stockQueries);
      console.log('   AI問答:', aiQueries);
      console.log('   今日查詢:', todayQueries);
    }
    
    // 4. 測試JOIN查詢
    console.log('\n4. 測試JOIN查詢:');
    const { data: joinQueries, error: joinError } = await supabase
      .from('user_queries')
      .select(`
        *,
        users (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (joinError) {
      console.log('❌ JOIN查詢失敗:', joinError.message);
      console.log('💡 這可能是admin查詢記錄頁面無法顯示的原因');
    } else {
      console.log('✅ JOIN查詢成功');
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
    
    console.log('\n🎯 測試完成！');
    console.log('現在請:');
    console.log('1. 刷新查詢記錄管理頁面');
    console.log('2. 檢查是否顯示真實的查詢記錄');
    console.log('3. 進行一次股票預測測試');
    console.log('4. 檢查新記錄是否被正確記錄');
    
  } catch (err) {
    console.log('❌ 測試時出錯:', err.message);
  }
}

testQueryLogging();
