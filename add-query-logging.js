#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📝 添加查詢記錄功能到 server.js...\n');

// 讀取 server.js 文件
const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// 要添加的查詢記錄 API 端點
const queryLoggingAPI = `
// 記錄用戶查詢的 API 端點
app.post('/api/log-query', authRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  try {
    const { type, content, result, metadata } = req.body;
    const username = req.user.username;

    if (!type || !content) {
      return res.status(400).json({ error: 'Type and content are required' });
    }

    const db = userManager.db;
    const insertSQL = \`
      INSERT INTO user_queries (username, type, content, result, metadata) 
      VALUES (?, ?, ?, ?, ?)
    \`;

    const queryId = await new Promise((resolve, reject) => {
      db.run(insertSQL, [username, type, content, result, JSON.stringify(metadata || {})], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.json({ 
      success: true, 
      queryId,
      message: 'Query logged successfully' 
    });
  } catch (error) {
    console.error('Log query error:', error);
    res.status(500).json({ error: 'Failed to log query' });
  }
});

// 記錄股票查詢的專用端點
app.post('/api/log-stock-query', authRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  try {
    const { symbol, query, result, price, change } = req.body;
    const username = req.user.username;

    if (!symbol || !query) {
      return res.status(400).json({ error: 'Symbol and query are required' });
    }

    const db = userManager.db;
    const insertSQL = \`
      INSERT INTO user_queries (username, type, content, result, metadata) 
      VALUES (?, 'stock', ?, ?, ?)
    \`;

    const metadata = {
      symbol: symbol,
      price: price,
      change: change,
      timestamp: new Date().toISOString()
    };

    const queryId = await new Promise((resolve, reject) => {
      db.run(insertSQL, [username, query, result, JSON.stringify(metadata)], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.json({ 
      success: true, 
      queryId,
      message: 'Stock query logged successfully' 
    });
  } catch (error) {
    console.error('Log stock query error:', error);
    res.status(500).json({ error: 'Failed to log stock query' });
  }
});

// 記錄 AI 查詢的專用端點
app.post('/api/log-ai-query', authRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  try {
    const { question, answer, model, category } = req.body;
    const username = req.user.username;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    const db = userManager.db;
    const insertSQL = \`
      INSERT INTO user_queries (username, type, content, result, metadata) 
      VALUES (?, 'ai', ?, ?, ?)
    \`;

    const metadata = {
      model: model || 'GPT-4',
      category: category || 'general',
      timestamp: new Date().toISOString()
    };

    const queryId = await new Promise((resolve, reject) => {
      db.run(insertSQL, [username, question, answer, JSON.stringify(metadata)], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.json({ 
      success: true, 
      queryId,
      message: 'AI query logged successfully' 
    });
  } catch (error) {
    console.error('Log AI query error:', error);
    res.status(500).json({ error: 'Failed to log AI query' });
  }
});

`;

// 查找插入位置（在現有的 API 端點之後）
const insertPosition = serverContent.lastIndexOf('// Admin queries page');
if (insertPosition === -1) {
  console.error('❌ 找不到插入位置');
  process.exit(1);
}

// 在找到的位置之前插入新的 API 端點
const beforeInsert = serverContent.substring(0, insertPosition);
const afterInsert = serverContent.substring(insertPosition);

const newServerContent = beforeInsert + queryLoggingAPI + '\n' + afterInsert;

// 寫入修改後的文件
fs.writeFileSync(serverPath, newServerContent);

console.log('✅ 查詢記錄 API 端點已添加到 server.js');
console.log('\n📋 新增的 API 端點:');
console.log('   POST /api/log-query - 記錄通用查詢');
console.log('   POST /api/log-stock-query - 記錄股票查詢');
console.log('   POST /api/log-ai-query - 記錄 AI 查詢');
console.log('\n🔧 使用方法:');
console.log('   前端需要調用這些 API 來記錄用戶查詢');
console.log('   例如：fetch("/api/log-stock-query", { method: "POST", body: JSON.stringify({...}) })');
console.log('\n🌐 測試頁面:');
console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
console.log('   用戶管理: https://www.bma-hk.com/admin');
