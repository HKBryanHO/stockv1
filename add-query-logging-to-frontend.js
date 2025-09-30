// 這個腳本用於在前端添加查詢記錄功能
// 需要手動將這些代碼添加到 public/js/app.js 中

const queryLoggingCode = `
// ===== 查詢記錄功能 =====
async function logUserQuery(type, content, result, metadata = {}) {
  try {
    const response = await fetch('/api/log-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type,
        content: content,
        result: result,
        metadata: metadata
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 查詢已記錄:', data.message);
    } else {
      console.warn('⚠️ 查詢記錄失敗:', response.status);
    }
  } catch (error) {
    console.error('❌ 查詢記錄錯誤:', error);
  }
}

async function logStockQuery(symbol, query, result, price, change) {
  try {
    const response = await fetch('/api/log-stock-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: symbol,
        query: query,
        result: result,
        price: price,
        change: change
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 股票查詢已記錄:', data.message);
    } else {
      console.warn('⚠️ 股票查詢記錄失敗:', response.status);
    }
  } catch (error) {
    console.error('❌ 股票查詢記錄錯誤:', error);
  }
}

async function logAIQuery(question, answer, model) {
  try {
    const response = await fetch('/api/log-ai-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        answer: answer,
        model: model
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ AI查詢已記錄:', data.message);
    } else {
      console.warn('⚠️ AI查詢記錄失敗:', response.status);
    }
  } catch (error) {
    console.error('❌ AI查詢記錄錯誤:', error);
  }
}
`;

console.log('📝 查詢記錄功能代碼:');
console.log(queryLoggingCode);
console.log('\n🔧 需要手動將上述代碼添加到 public/js/app.js 中');
console.log('\n📍 建議添加位置:');
console.log('1. 在 StockPredictionApp 類的 constructor 之後');
console.log('2. 在 runPrediction() 方法中調用 logStockQuery()');
console.log('3. 在 AI 查詢相關方法中調用 logAIQuery()');
console.log('4. 在其他查詢方法中調用 logUserQuery()');
