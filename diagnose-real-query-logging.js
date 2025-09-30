const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function diagnoseRealQueryLogging() {
  try {
    console.log('🔍 診斷真實查詢記錄問題...');
    
    // 1. 檢查所有查詢記錄
    console.log('\n1. 檢查所有查詢記錄:');
    const { data: allQueries, error: allError } = await supabase
      .from('user_queries')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.log('❌ 查詢記錄失敗:', allError.message);
      return;
    }
    
    console.log('✅ 總共找到', allQueries.length, '條記錄');
    
    // 2. 分析記錄來源
    console.log('\n2. 分析記錄來源:');
    const testDataPattern = /(AAPL股價分析|什麼是股票投資|TSLA技術分析)/;
    const realDataPattern = /(股票預測|預測價格|信心度)/;
    
    let testRecords = 0;
    let realRecords = 0;
    let unknownRecords = 0;
    
    allQueries.forEach((q, index) => {
      const isTest = testDataPattern.test(q.content);
      const isReal = realDataPattern.test(q.content) || realDataPattern.test(q.result);
      
      if (isTest) {
        testRecords++;
        console.log(`   記錄 ${index + 1}: 測試數據 - ${q.content.substring(0, 30)}...`);
      } else if (isReal) {
        realRecords++;
        console.log(`   記錄 ${index + 1}: 真實數據 - ${q.content.substring(0, 30)}...`);
      } else {
        unknownRecords++;
        console.log(`   記錄 ${index + 1}: 未知類型 - ${q.content.substring(0, 30)}...`);
      }
    });
    
    console.log('\n📊 記錄分析結果:');
    console.log('   測試數據:', testRecords);
    console.log('   真實數據:', realRecords);
    console.log('   未知類型:', unknownRecords);
    
    // 3. 檢查最近的記錄時間
    console.log('\n3. 檢查最近的記錄時間:');
    if (allQueries.length > 0) {
      const latestRecord = allQueries[0];
      const recordTime = new Date(latestRecord.created_at);
      const now = new Date();
      const timeDiff = now - recordTime;
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      
      console.log('   最新記錄時間:', latestRecord.created_at);
      console.log('   記錄時間差:', minutesAgo, '分鐘前');
      console.log('   記錄內容:', latestRecord.content.substring(0, 50) + '...');
      
      if (minutesAgo > 60) {
        console.log('⚠️  最新記錄超過1小時，可能沒有新的真實查詢');
      }
    }
    
    // 4. 檢查用戶會話
    console.log('\n4. 檢查用戶會話:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sessionsError) {
      console.log('❌ 查詢會話失敗:', sessionsError.message);
    } else {
      console.log('✅ 找到', sessions.length, '個會話');
      sessions.forEach((s, index) => {
        const sessionTime = new Date(s.created_at);
        const now = new Date();
        const timeDiff = now - sessionTime;
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        
        console.log(`   會話 ${index + 1}:`, {
          user_id: s.user_id,
          created_at: s.created_at,
          minutes_ago: minutesAgo,
          expires_at: s.expires_at
        });
      });
    }
    
    // 5. 提供解決方案
    console.log('\n🎯 問題診斷結果:');
    if (realRecords === 0) {
      console.log('❌ 沒有找到真實查詢記錄');
      console.log('💡 可能的原因:');
      console.log('   1. 用戶沒有登入，查詢記錄API返回錯誤');
      console.log('   2. 前端查詢記錄功能沒有被觸發');
      console.log('   3. 查詢記錄API有問題');
      console.log('   4. 用戶沒有進行股票預測');
      
      console.log('\n🔧 解決方案:');
      console.log('   1. 確保用戶已登入 (admin/admin123)');
      console.log('   2. 進行一次股票預測測試');
      console.log('   3. 檢查瀏覽器控制台是否有錯誤');
      console.log('   4. 檢查服務器日誌');
    } else {
      console.log('✅ 找到真實查詢記錄');
      console.log('💡 查詢記錄功能正常工作');
    }
    
    // 6. 提供測試步驟
    console.log('\n🧪 測試步驟:');
    console.log('1. 確保已登入 admin 帳戶');
    console.log('2. 打開預測器頁面');
    console.log('3. 輸入股票代碼 (如 AAPL)');
    console.log('4. 進行預測');
    console.log('5. 檢查瀏覽器控制台是否有 "✅ 股票查詢已記錄" 消息');
    console.log('6. 刷新查詢記錄管理頁面');
    console.log('7. 檢查是否有新的真實記錄');
    
  } catch (err) {
    console.log('❌ 診斷時出錯:', err.message);
  }
}

diagnoseRealQueryLogging();
