-- 模擬倉管理系統數據庫結構
-- 擴展現有的多用戶系統

CREATE TABLE IF NOT EXISTS user_watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT '我的模擬倉',
    description TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(200),
    added_price DECIMAL(10,2),
    added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    target_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (watchlist_id) REFERENCES user_watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, symbol)
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_default ON user_watchlists(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_watchlist_id ON watchlist_stocks(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_symbol ON watchlist_stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_active ON watchlist_stocks(is_active);
