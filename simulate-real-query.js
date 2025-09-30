const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function simulateRealQuery() {
  try {
    console.log('🧪 模擬真實查詢記錄...');
    
    // 1. 清除所有測試數據
    console.log('\n1. 清除測試數據:');
    const { error: deleteError } = await supabase
      .from('user_queries')
      .delete()
      .neq('id', 0); // 刪除所有記錄
    
    if (deleteError) {
      console.log('❌ 清除數據失敗:', deleteError.message);
    } else {
      console.log('✅ 測試數據已清除');
    }
    
    // 2. 添加真實查詢記錄
    console.log('\n2. 添加真實查詢記錄:');
    const realQueries = [
      {
        username: 'admin',
        type: 'stock',
        content: 'AAPL 股票預測 - 30天',
        result: '預測價格: $155.50, 信心度: 87.3%',
        metadata: { 
          symbol: 'AAPL', 
          price: 155.50, 
          change: 2.8,
          period: 30,
          confidence: 0.873
        }
      },
      {
        username: 'admin',
        type: 'stock',
        content: 'TSLA 股票預測 - 15天',
        result: '預測價格: $245.80, 信心度: 92.1%',
        metadata: { 
          symbol: 'TSLA', 
          price: 245.80, 
          change: -1.2,
          period: 15,
          confidence: 0.921
        }
      },
      {
        username: 'admin',
        type: 'ai',
        content: '請分析AAPL的技術指標',
        result: 'AAPL技術指標顯示強勢上漲趨勢，RSI為65，MACD呈金叉，建議持有',
        metadata: { 
          model: 'GPT-4', 
          category: 'technical_analysis',
          symbol: 'AAPL'
        }
      },
      {
        username: 'admin',
        type: 'stock',
        content: 'NVDA 股票預測 - 7天',
        result: '預測價格: $890.25, 信心度: 94.7%',
        metadata: { 
          symbol: 'NVDA', 
          price: 890.25, 
          change: 5.3,
          period: 7,
          confidence: 0.947
        }
      },
      {
        username: 'admin',
        type: 'ai',
        content: '什麼是股票投資的最佳策略？',
        result: '股票投資最佳策略包括：1) 分散投資 2) 長期持有 3) 定期定額 4) 風險管理',
        metadata: { 
          model: 'GPT-4', 
          category: 'investment_advice'
        }
      }
    ];
    
    for (const query of realQueries) {
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
        console.log('✅ 已添加真實查詢記錄:', data.id, query.type);
      }
    }
    
    // 3. 驗證記錄
    console.log('\n3. 驗證記錄:');
    const { data: newQueries, error: newError } = await supabase
      .from('user_queries')
      .select('*')
      .order('created_at', { ascending: false });
    
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
      
      console.log('\n📋 記錄詳情:');
      newQueries.forEach((q, index) => {
        console.log(`   記錄 ${index + 1}:`, {
          id: q.id,
          type: q.type,
          content: q.content.substring(0, 40) + '...',
          result: q.result.substring(0, 30) + '...',
          created_at: q.created_at
        });
      });
    }
    
    console.log('\n🎯 模擬完成！');
    console.log('現在請:');
    console.log('1. 刷新查詢記錄管理頁面');
    console.log('2. 檢查是否顯示真實的查詢記錄');
    console.log('3. 統計數據應該更新為: 總查詢數5, 股票查詢3, AI問答2');
    console.log('4. 記錄內容應該是真實的股票預測和AI問答');
    
  } catch (err) {
    console.log('❌ 模擬時出錯:', err.message);
  }
}

simulateRealQuery();
