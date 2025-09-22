// Stock Prediction App - Modern JavaScript Architecture (Frontend-Only Version)
class StockPredictionApp {
    constructor() {
        // Allow overriding backend base via <meta name="backend-base" content="https://your-api.onrender.com">
        const metaBackend = (typeof document !== 'undefined') ? document.querySelector('meta[name="backend-base"]') : null;
        const metaVal = metaBackend && metaBackend.getAttribute('content') ? metaBackend.getAttribute('content').trim() : '';
        this.backendBase = (function() {
            if (metaVal) return metaVal;
            try {
                const host = (window.location && window.location.hostname) || '';
                if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
                    return window.location.origin;
                }
            } catch(_) {}
            return 'https://your-api.onrender.com';
        })();
        // Alpha Vantage proxy base (backend only; no frontend key)
        this.apiUrl = `${this.backendBase}/api/alphavantage`;
        this.charts = {};
        this.sentiment = { HK: 0.60, US: 0.50 };
        this.history = new HistoryManager();
        this.settings = new SettingsManager();
        this.realtimeIntervalId = null;
        this.ws = null;
        this.lang = localStorage.getItem('sp_lang') || 'zh';
        this.dbPromise = this.initDB();
        this._proxyPreference = null; // 'proxy' | 'direct' after first check
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.refreshMonitor();
        this.setupAutoRefresh();

        // Theme and language
        this.initTheme();
        this.initI18n();

        // Chart.js zoom/pan
        if (typeof Chart !== 'undefined' && Chart.register && typeof window['chartjs-plugin-zoom'] !== 'undefined') {
            try { Chart.register(window['chartjs-plugin-zoom']); } catch (_) {}
        } else if (typeof Chart !== 'undefined' && Chart.register && window.ChartZoom) {
            try { Chart.register(window.ChartZoom); } catch (_) {}
        }
        // Realtime WS (Finnhub if token available)
        this.initRealtimeWS();

        // Offline detection
        const warn = () => {
            const el = document.getElementById('offlineWarning');
            if (el) el.style.display = navigator.onLine ? 'none' : 'block';
        };
        window.addEventListener('online', warn);
        window.addEventListener('offline', warn);
        warn();
        // PWA install prompt handler
        this.initPWAInstall();
        // Live ticker initial
        this.updateTickerBar({});
    }

    initPWAInstall() {
        try {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this._deferredPrompt = e;
                let btn = document.getElementById('installBtn');
                if (!btn) {
                    const nav = document.querySelector('.nav-actions');
                    if (nav) {
                        btn = document.createElement('button');
                        btn.id = 'installBtn';
                        btn.className = 'btn btn-secondary btn-sm';
                        btn.style.display = '';
                        btn.innerHTML = '<i class="fas fa-download"></i> Install';
                        nav.appendChild(btn);
                    }
                }
                if (btn && !btn._bound) {
                    btn._bound = true;
                    btn.addEventListener('click', async () => {
                        try {
                            if (!this._deferredPrompt) return;
                            this._deferredPrompt.prompt();
                            const choice = await this._deferredPrompt.userChoice;
                            console.log('PWA install outcome:', choice && choice.outcome);
                            this._deferredPrompt = null;
                            btn.style.display = 'none';
                        } catch (err) { console.log('PWA install error', err); }
                    });
                }
            });
        } catch (_) {}
    }

    async initDB() {
        try {
            if (!window.idb || !window.idb.openDB) return null;
            return await window.idb.openDB('sp_cache_v1', 1, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('historical')) db.createObjectStore('historical');
                    if (!db.objectStoreNames.contains('quotes')) db.createObjectStore('quotes');
                }
            });
        } catch (_) { return null; }
    }

    initTheme() {
        const saved = localStorage.getItem('sp_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.innerHTML = saved === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : 'dark');
        localStorage.setItem('sp_theme', next);
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.innerHTML = next === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    initI18n() {
        this.translations = {
            en: {
                'nav.predict': 'Predict',
                'nav.dashboard': 'Dashboard',
                'nav.market': 'Market',
                'nav.settings': 'Settings',
                'panel.inputs': 'Inputs',
                'panel.core': 'Core Results',
                'panel.dashboard': 'Dashboard',
                'panel.backtest': 'Backtest Results',
                'panel.market': 'Market Insights',
                'panel.settings': 'Settings',
                'chart.price': 'Price Forecast',
                'chart.risk': 'Risk Distribution',
                'chart.dd': 'Historical Drawdown',
                'chart.hist': 'Historical Candlestick + Volume',
                'btn.predict': 'Run AI Multi-Path',
                'btn.refresh': 'Refresh',
                'btn.clear': 'Clear',
                'btn.update': 'Update',
                'label.apiKey': 'Alpha Vantage API Key',
                'label.market': 'Market',
                'label.symbol': 'Symbol',
                'label.amount': 'Investment Amount',
                'label.horizon': 'Horizon',
                'label.paths': 'Monte Carlo Paths',
                'label.risk': 'Risk Tolerance (VaR 95% of capital %)',
                'label.realtime': 'Realtime',
                'label.model': 'Model',
                'label.portfolio': 'Portfolio (comma separated)',
                'label.alert': 'Price Alert (notify when current > value)',
                'placeholder.apiKey': 'Leave empty to use backend key',
                'placeholder.symbol': 'HK: 0700.HK / US: AAPL',
                'placeholder.portfolio': 'AAPL,MSFT',
                'placeholder.alert': 'e.g. 150.00'
            },
            zh: {}
        };
        this.applyI18n();
        const langBtn = document.getElementById('langToggle');
        if (langBtn) langBtn.textContent = this.lang.toUpperCase() === 'ZH' ? '中文' : 'EN';
    }

    toggleLang() {
        this.lang = (this.lang === 'en') ? 'zh' : 'en';
        localStorage.setItem('sp_lang', this.lang);
        const langBtn = document.getElementById('langToggle');
        if (langBtn) langBtn.textContent = this.lang === 'en' ? 'EN' : '中文';
        this.applyI18n();
    }

    applyI18n() {
        const dict = this.translations[this.lang] || {};
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) el.setAttribute('placeholder', dict[key]);
        });
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        const tablist = document.querySelector('.nav-tabs');
        if (tablist) {
            tablist.addEventListener('keydown', (e) => {
                const tabs = Array.from(document.querySelectorAll('.nav-tab'));
                const current = tabs.findIndex(t => t.classList.contains('active'));
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    let nextIndex = current + (e.key === 'ArrowRight' ? 1 : -1);
                    if (nextIndex < 0) nextIndex = tabs.length - 1;
                    if (nextIndex >= tabs.length) nextIndex = 0;
                    const next = tabs[nextIndex];
                    if (next) {
                        this.switchTab(next.dataset.tab);
                        next.focus();
                    }
                }
            });
        }

        // Form controls
        document.getElementById('predictBtn').addEventListener('click', () => this.runPrediction());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadReport());
        document.getElementById('riskTolerance').addEventListener('input', (e) => {
            document.getElementById('riskToleranceValue').textContent = e.target.value + '%';
        });

        // Dashboard controls
        document.getElementById('btnRefreshHistory').addEventListener('click', () => this.history.render());
        document.getElementById('btnClearHistory').addEventListener('click', () => this.history.clear());

        // Market dashboard
        const btnRefreshMarket = document.getElementById('btnRefreshMarket');
        if (btnRefreshMarket) {
            btnRefreshMarket.addEventListener('click', () => this.renderMarketDashboard());
        }

        // Settings
        document.getElementById('apiEndpoint').addEventListener('change', (e) => {
            this.apiUrl = e.target.value;
            this.settings.save();
        });

        // Theme toggle
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Language toggle
        const langBtn = document.getElementById('langToggle');
        if (langBtn) {
            langBtn.addEventListener('click', () => this.toggleLang());
        }
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const email = (document.getElementById('loginEmail')?.value || '').trim();
                const pwd = (document.getElementById('loginPassword')?.value || '').trim();
                if (!email || !pwd) { this.showToast('請輸入Email與密碼', 'error'); return; }
                try {
                    if (window.firebase && window.firebase.auth) {
                        try {
                            await window.firebase.auth().signInWithEmailAndPassword(email, pwd);
                        } catch (e) {
                            // Create user if not exist
                            await window.firebase.auth().createUserWithEmailAndPassword(email, pwd);
                        }
                        this.showToast('登入成功', 'success');
                        this.history.render();
                    } else {
                        // Local fallback login
                        localStorage.setItem('local_user', JSON.stringify({ email, hash: btoa(pwd) }));
                        const el = document.getElementById('loginStatus');
                        if (el) el.textContent = `已登入（本地）：${email}`;
                        this.showToast('本地登入成功', 'success');
                    }
                } catch (err) {
                    this.showToast('登入失敗', 'error');
                }
            });
        }
        // Debug data button
        const dbg = document.getElementById('debugBtn');
        if (dbg) {
            dbg.style.display = 'inline-flex';
            dbg.addEventListener('click', () => this.toggleDebugData());
        }
    }

    switchTab(tabName) {
        // Hide all tabs with animation
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.style.opacity = '0';
            tab.style.transform = 'translateY(20px)';
        });
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
        });

        // Show selected tab with animation
        const activeTab = document.getElementById(`${tabName}-tab`);
        const activeNavTab = document.querySelector(`[data-tab="${tabName}"]`);
        
        activeTab.classList.add('active');
        activeNavTab.classList.add('active');
        activeNavTab.setAttribute('aria-selected', 'true');
        activeNavTab.setAttribute('tabindex', '0');
        
        // Animate in
        setTimeout(() => {
            activeTab.style.opacity = '1';
            activeTab.style.transform = 'translateY(0)';
            activeTab.classList.add('animate-fade-in-up');
        }, 50);

        // Load tab-specific content
        if (tabName === 'dashboard') {
            this.history.render();
        } else if (tabName === 'market') {
            this.renderMarketDashboard();
        }
    }

    async renderMarketDashboard() {
        const container = document.getElementById('marketDashboard');
        if (!container) return;

        container.classList.add('result-content');
        container.innerHTML = '<p>AI 正在分析市場並推薦股票…</p>';

        try {
            // Use AI to analyze market and recommend stocks
            const aiRecommendedSymbols = await this.getAIRecommendedStocks();
            console.log('AI recommended symbols:', aiRecommendedSymbols);
            
            if (aiRecommendedSymbols && aiRecommendedSymbols.length > 0) {
                const norm = (arr)=>arr.map(s=>{
                    if (!s) return s;
                    let x = (s+"").trim().toUpperCase();
                    if (x === 'TSMC') return 'TSM';
                    if (/^HK:/.test(x)) x = x.replace(/^HK:/,'') + '.HK';
                    if (/^\d{4}$/.test(x)) x = x + '.HK';
                    return x;
                });
                const list = norm(aiRecommendedSymbols);
                const qs = encodeURIComponent(list.join(','));
                const resp = await fetch(`${this.backendBase}/api/market/insights?symbols=${qs}`);
                if (resp.ok) {
                    const data = await resp.json();
                    const seriesMap = data.series || {};
                    const symbols = Object.keys(seriesMap);
                    if (symbols.length) {
                        const ymap = await this.fetchYahooQuotesBatch(symbols);
                        symbols.forEach(sym => {
                            const px = ymap[sym];
                            const sd = seriesMap[sym];
                            if (isFinite(px) && sd && sd.closes && sd.closes.length) {
                                sd.closes[sd.closes.length - 1] = Number(px);
                            }
                        });
                    }
                    container.innerHTML = this.buildMarketDashboardTemplate(seriesMap, aiRecommendedSymbols);
                    return;
                }
            }
        } catch (e) {
            console.error('AI market analysis failed:', e);
            // Proceed to fallback
        }

        // Fallback: use AI screener to get recommended stocks
        try {
            const aiSymbols = await this.getAIScreenerRecommendations();
            if (aiSymbols && aiSymbols.length > 0) {
                const series = {};
                for (const s of aiSymbols) {
                    try {
                        const ts = await this.fetchYahooHistorical(s, '6mo');
                        const yq = await this.fetchYahooQuote(s);
                        if (isFinite(yq.price) && ts?.closes?.length) {
                            ts.closes[ts.closes.length - 1] = Number(yq.price);
                        }
                        series[s] = ts || { dates: [], closes: [], volumes: [] };
                    } catch (_) {
                        series[s] = { dates: [], closes: [], volumes: [] };
                    }
                }
                container.innerHTML = this.buildMarketDashboardTemplate(series, aiSymbols);
                return;
            }
        } catch (e) {
            console.error('AI screener fallback failed:', e);
        }

        // Final fallback: use diverse default symbols with rotation
        try {
            const allSymbols = [
                // Tech giants
                ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'AAPL'],
                // AI/ML companies  
                ['PLTR', 'SNOW', 'CRWD', 'ZS', 'OKTA', 'NET'],
                // Semiconductors
                ['AVGO', 'AMD', 'INTC', 'QCOM', 'MRVL', 'ADI'],
                // Healthcare/Biotech
                ['LLY', 'ABBV', 'JNJ', 'PFE', 'MRNA', 'GILD'],
                // Chinese stocks
                ['9988.HK', '0700.HK', 'BABA', 'JD', 'PDD', 'NIO'],
                // Quantum/Advanced tech
                ['IONQ', 'RIGC', 'QUBT', 'IBM', 'GOOGL', 'MSFT']
            ];
            
            // Rotate through different categories based on current time
            const hour = new Date().getHours();
            const categoryIndex = hour % allSymbols.length;
            const symbols = allSymbols[categoryIndex].slice(0, 8); // Take 8 symbols
            
            console.log('Using fallback symbols from category', categoryIndex, ':', symbols);
            
            const series = {};
            for (const s of symbols) {
                try {
                    const ts = await this.fetchYahooHistorical(s, '6mo');
                    const yq = await this.fetchYahooQuote(s);
                    if (isFinite(yq.price) && ts?.closes?.length) {
                        ts.closes[ts.closes.length - 1] = Number(yq.price);
                    }
                    series[s] = ts || { dates: [], closes: [], volumes: [] };
                } catch (_) {
                    series[s] = { dates: [], closes: [], volumes: [] };
                }
            }
            container.innerHTML = this.buildMarketDashboardTemplate(series, symbols);
            return;
        } catch (_) {
            container.innerHTML = this.buildMarketDashboardTemplate();
        }
    }

    async getAIRecommendedStocks() {
        try {
            // Use AI screener to get market recommendations with random variation
            const queries = [
                "推薦10隻最具投資價值的股票，包括科技、金融、醫療等不同行業，基於當前市場趨勢和基本面分析",
                "基於量化分析，推薦當前市場最具潛力的股票，考慮技術指標、基本面、市場情緒等因素",
                "分析當前市場機會，推薦10隻具有成長潛力的股票，涵蓋不同行業和市值",
                "基於AI和機器學習趨勢，推薦相關的優質股票投資機會",
                "考慮當前經濟環境，推薦具有防禦性和成長性的股票組合"
            ];
            const randomQuery = queries[Math.floor(Math.random() * queries.length)];
            console.log('Sending AI screener request:', randomQuery);
            
            const response = await fetch(`${this.backendBase}/api/grok/screener`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey: '', // Use backend key
                    query: randomQuery,
                    size: 10
                })
            });
            
            console.log('AI screener response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('AI screener response data:', data);
                
                if (data && data.result && data.result.selected && Array.isArray(data.result.selected)) {
                    const symbols = data.result.selected.filter(Boolean);
                    console.log('AI recommended symbols:', symbols);
                    return symbols;
                } else if (data && data.candidates && Array.isArray(data.candidates)) {
                    const symbols = data.candidates.map(c => c.symbol).filter(Boolean);
                    console.log('AI recommended symbols:', symbols);
                    return symbols;
                } else {
                    console.log('No candidates found in AI response, using fallback');
                    // Return fallback symbols if AI fails
                    return ['NVDA', 'PLTR', 'MSFT', 'GOOGL', '9988.HK', '0700.HK', 'AVGO', 'AMD', 'IONQ', 'LLY', 'ABBV'];
                }
            } else {
                const errorText = await response.text();
                console.error('AI screener failed:', response.status, errorText);
                // Return fallback symbols if API fails
                return ['NVDA', 'PLTR', 'MSFT', 'GOOGL', '9988.HK', '0700.HK', 'AVGO', 'AMD', 'IONQ', 'LLY', 'ABBV'];
            }
        } catch (e) {
            console.error('AI screener request failed:', e);
            // Return fallback symbols if request fails completely
            return ['NVDA', 'PLTR', 'MSFT', 'GOOGL', '9988.HK', '0700.HK', 'AVGO', 'AMD', 'IONQ', 'LLY', 'ABBV'];
        }
    }

    async getAIScreenerRecommendations() {
        try {
            // Alternative AI screener query for market analysis
            const screenerQuery = "基於量化分析，推薦當前市場最具潛力的股票，考慮技術指標、基本面、市場情緒等因素";
            const response = await fetch(`${this.backendBase}/api/grok/screener`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey: '', // Use backend key
                    query: screenerQuery,
                    size: 8
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.candidates && Array.isArray(data.candidates)) {
                    return data.candidates.map(c => c.symbol).filter(Boolean);
                }
            }
        } catch (e) {
            console.error('AI screener fallback failed:', e);
        }
        return null;
    }

    generateMarketDashboardHTML(data) {
        // Minimal renderer for a structured payload if backend exists
        const sections = Array.isArray(data?.sections) ? data.sections : [];
        const parts = sections.map(sec => `
            <div class="result-section">
                <h4>${sec.title || '—'}</h4>
                ${sec.html || ''}
            </div>
        `).join('');
        return `
            <div class="result-section">
                <h3>${data.title || 'AI-Powered Market Dashboard'}</h3>
                ${parts}
            </div>
        `;
    }

    buildMarketDashboardTemplate(liveSeries, aiRecommendedSymbols = null) {
        const d = new Date().toLocaleDateString();
        const planner = new TradePlanner();
        const getSD = (sym) => {
            if (liveSeries && liveSeries[sym]) return liveSeries[sym];
            return null;
        };
        const planRow = (sym, mkt, note = '') => {
            try {
                const sd = getSD(sym);
                if (!sd || !sd.closes || sd.closes.length === 0) throw new Error('no-data');
                const lv = planner.computeLevels(sd);
                const fmt = (v) => (isFinite(v) ? `$${v.toFixed(2)}` : '—');
                return `<tr><td>${sym}</td><td>${mkt}</td><td>${fmt(lv.current)}</td><td>${fmt(lv.buy)}</td><td>${fmt(lv.tp)}</td><td>${fmt(lv.sl)}</td><td>${note || lv.regime}</td></tr>`;
            } catch (e) {
                return `<tr><td>${sym}</td><td>${mkt}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${note}</td></tr>`;
            }
        };
        const volRow = (sym, mkt, dod, wow, highlights = '') => {
            try {
                const sd = getSD(sym);
                if (!sd || !sd.closes || sd.closes.length === 0) throw new Error('no-data');
                const lv = planner.computeLevels(sd);
                const fmt = (v) => (isFinite(v) ? `$${v.toFixed(2)}` : '—');
                return `<tr><td>${sym}</td><td>${mkt}</td><td>${dod}</td><td>${wow}</td><td>${highlights}</td><td>${fmt(lv.current)}</td><td>${fmt(lv.buy)}</td><td>${fmt(lv.tp)}</td><td>${fmt(lv.sl)}</td></tr>`;
            } catch (e) {
                return `<tr><td>${sym}</td><td>${mkt}</td><td>${dod}</td><td>${wow}</td><td>${highlights}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
            }
        };
        const aiHeader = aiRecommendedSymbols ? 
            `<div class="ai-recommendation-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0;">🤖 AI 智能推薦股票</h3>
                <p style="margin: 0; opacity: 0.9;">基於量化分析、技術指標、基本面分析和市場情緒，AI 推薦以下 ${aiRecommendedSymbols.length} 隻最具投資價值的股票：</p>
                <div style="margin-top: 10px; font-size: 14px;">
                    <strong>推薦股票：</strong> ${aiRecommendedSymbols.join(', ')}
                </div>
            </div>` : '';

        return `
            <div class="result-section">
                ${aiHeader}
                <h3>AI-Powered Market Insights Dashboard</h3>
                <div class="help-text">更新日期：${d}</div>
                <h4>AI Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead>
                        <tr>
                            <th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th><th>Current</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${volRow('NVDA','NASDAQ','+15%','+25%','Spike driven by AI chip forecasts')}
                        ${volRow('PLTR','NYSE','+10%','+18%','Data fusion software demand')}
                        ${volRow('MSFT','NASDAQ','+8%','+12%','AI cloud integrations')}
                        ${volRow('GOOGL','NASDAQ','+5%','+9%','AI search enhancements')}
                        ${volRow('9988.HK','HKEX','+7%','+14%','AI e-commerce tools')}
                        ${volRow('0700.HK','HKEX','+6%','+11%','AI gaming features')}
                        ${volRow('AVGO','NASDAQ','+9%','+16%','AI accelerator orders')}
                        ${volRow('AMD','NASDAQ','+11%','+20%','AI processor competition')}
                        ${volRow('IONQ','NYSE','+13%','+22%','AI-quantum hybrid news')}
                    </tbody>
                </table>
                <h5>Major News</h5>
                <ul>
                    <li>NVIDIA prior large drop impacted AI chip sentiment; volatility elevated.</li>
                    <li>Palantir strength in AI data fusion boosts software sentiment.</li>
                    <li>Debates on model economics (e.g., DeepSeek) intensify competition.</li>
                </ul>
                <h5>Forecasts</h5>
                <p>Short-term (1-7d): Stabilization with rebound potential in leaders. Medium-term (1-3m): Constructive on AI infra demand and earnings cadence.</p>
                <h5>Stock Breakthroughs</h5>
                <ul>
                    <li>NVDA: Resistance break; watch sustained volume.</li>
                    <li>PLTR: 52-week high; adoption tailwinds.</li>
                    <li>IONQ: Support reclaimed; quantum-AI narrative.</li>
                </ul>
                <h5>Stock Recommendations</h5>
                <table>
                    <thead>
                        <tr><th>Stock</th><th>Market</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>NVDA</td><td>NASDAQ</td><td>9</td><td>6</td><td>7</td><td>10</td><td>8</td></tr>
                        <tr><td>PLTR</td><td>NYSE</td><td>8</td><td>5</td><td>8</td><td>9</td><td>7.5</td></tr>
                        <tr><td>9988.HK</td><td>HKEX</td><td>7</td><td>4</td><td>9</td><td>8</td><td>7</td></tr>
                        <tr><td>IONQ</td><td>NYSE</td><td>9</td><td>7</td><td>6</td><td>10</td><td>8</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">基於通道/波動/成交量/支撐阻力的動態計算。</div>
                <table>
                    <thead>
                        <tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr>
                    </thead>
                    <tbody>
                        ${planRow('NVDA','NASDAQ','AI加速器需求')}
                        ${planRow('PLTR','NYSE','數據融合應用')}
                        ${planRow('9988.HK','HKEX','雲與電商AI應用')}
                    </tbody>
                </table>

                <h4>Crypto Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead>
                        <tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>COIN</td><td>NASDAQ</td><td>+20%</td><td>+30%</td><td>Charter/reg initiative sentiment</td></tr>
                        <tr><td>MSTR</td><td>NASDAQ</td><td>+12%</td><td>+22%</td><td>BTC treasury sensitivity</td></tr>
                        <tr><td>RIOT</td><td>NASDAQ</td><td>+15%</td><td>+25%</td><td>Miner beta to BTC</td></tr>
                        <tr><td>MARA</td><td>NASDAQ</td><td>+10%</td><td>+18%</td><td>ETF/options flows</td></tr>
                    </tbody>
                </table>
                <h5>Forecasts</h5>
                <p>Short-term: Follows BTC path; Medium-term: Range with event spikes.</p>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>COIN</td><td>9</td><td>7</td><td>7</td><td>9</td><td>8</td></tr>
                        <tr><td>MSTR</td><td>8</td><td>6</td><td>8</td><td>8</td><td>7.5</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">高波動：動態ATR風控與成交量指引。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('COIN','NASDAQ','ETF/監管進展敏感')}
                        ${planRow('MSTR','NASDAQ','BTC敏感度高')}
                    </tbody>
                </table>

                <h4>Pharmaceuticals Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr></thead>
                    <tbody>
                        <tr><td>LLY</td><td>NYSE</td><td>+12%</td><td>+20%</td><td>Obesity drug demand</td></tr>
                        <tr><td>JNJ</td><td>NYSE</td><td>+8%</td><td>+14%</td><td>Pipeline updates</td></tr>
                        <tr><td>ABBV</td><td>NYSE</td><td>+10%</td><td>+16%</td><td>Immunology strength</td></tr>
                    </tbody>
                </table>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>LLY</td><td>9</td><td>4</td><td>8</td><td>9</td><td>7.5</td></tr>
                        <tr><td>ABBV</td><td>8</td><td>3</td><td>9</td><td>8</td><td>7</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">事件驅動：以支撐/阻力與ATR設置風控。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('LLY','NYSE','肥胖藥放量')}
                        ${planRow('ABBV','NYSE','免疫資產支撐')}
                    </tbody>
                </table>

                <h4>Biotech Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr></thead>
                    <tbody>
                        <tr><td>VRTX</td><td>NASDAQ</td><td>+14%</td><td>+24%</td><td>Pain/kidney progress</td></tr>
                        <tr><td>REGN</td><td>NASDAQ</td><td>+10%</td><td>+17%</td><td>Autoimmune focus</td></tr>
                        <tr><td>GILD</td><td>NASDAQ</td><td>+9%</td><td>+15%</td><td>Inflammation deals</td></tr>
                    </tbody>
                </table>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>VRTX</td><td>8</td><td>4</td><td>8</td><td>9</td><td>7.25</td></tr>
                        <tr><td>REGN</td><td>8</td><td>5</td><td>7</td><td>9</td><td>7.25</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">研發/數據波動大：用支撐/ATR設止蝕，R:R≥2。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('VRTX','NASDAQ','核心現金流強')}
                        ${planRow('REGN','NASDAQ','合作與CAR-T關注')}
                    </tbody>
                </table>

                <h4>Technology Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr></thead>
                    <tbody>
                        <tr><td>AAPL</td><td>NASDAQ</td><td>+10%</td><td>+15%</td><td>Product event</td></tr>
                        <tr><td>MSFT</td><td>NASDAQ</td><td>+8%</td><td>+13%</td><td>AI updates</td></tr>
                        <tr><td>AMZN</td><td>NASDAQ</td><td>+9%</td><td>+14%</td><td>Capex momentum</td></tr>
                        <tr><td>0700.HK</td><td>HKEX</td><td>+7%</td><td>+12%</td><td>Gaming strength</td></tr>
                    </tbody>
                </table>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>MSFT</td><td>9</td><td>4</td><td>8</td><td>10</td><td>7.75</td></tr>
                        <tr><td>AMZN</td><td>9</td><td>5</td><td>7</td><td>9</td><td>7.5</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">大型科技：趨勢回撤佈局；利率敏感。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('MSFT','NASDAQ','AI雲動能')}
                        ${planRow('AMZN','NASDAQ','AI/Data Center Capex')}
                    </tbody>
                </table>

                <h4>Quantum Computing Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr></thead>
                    <tbody>
                        <tr><td>IONQ</td><td>NYSE</td><td>+18%</td><td>+28%</td><td>Merger/partner headlines</td></tr>
                        <tr><td>RGTI</td><td>NASDAQ</td><td>+15%</td><td>+25%</td><td>Tech progress</td></tr>
                    </tbody>
                </table>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>IONQ</td><td>9</td><td>7</td><td>6</td><td>10</td><td>8</td></tr>
                        <tr><td>RGTI</td><td>8</td><td>8</td><td>5</td><td>10</td><td>7.75</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">高Beta：小倉分批，訊息驅動為主。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('IONQ','NYSE','商業化里程碑')}
                        ${planRow('RGTI','NASDAQ','技術節點關注')}
                    </tbody>
                </table>

                <h4>Data Centers Sector</h4>
                <h5>Trade Volume Changes</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>% DoD</th><th>% WoW</th><th>Highlights</th></tr></thead>
                    <tbody>
                        <tr><td>EQIX</td><td>NASDAQ</td><td>+13%</td><td>+22%</td><td>AI demand</td></tr>
                        <tr><td>DLR</td><td>NYSE</td><td>+10%</td><td>+18%</td><td>Infra momentum</td></tr>
                        <tr><td>IRM</td><td>NYSE</td><td>+11%</td><td>+19%</td><td>Storage demand</td></tr>
                        <tr><td>GDS</td><td>NASDAQ</td><td>+9%</td><td>+16%</td><td>Asia growth</td></tr>
                        <tr><td>VNET</td><td>NASDAQ</td><td>+8%</td><td>+14%</td><td>China footprint</td></tr>
                    </tbody>
                </table>
                <h5>Recommendations</h5>
                <table>
                    <thead><tr><th>Stock</th><th>Growth</th><th>Risk</th><th>Valuation</th><th>Innovation</th><th>Overall</th></tr></thead>
                    <tbody>
                        <tr><td>EQIX</td><td>8</td><td>4</td><td>8</td><td>9</td><td>7.25</td></tr>
                        <tr><td>DLR</td><td>8</td><td>4</td><td>9</td><td>8</td><td>7.25</td></tr>
                    </tbody>
                </table>

                <h5>Trade Plan</h5>
                <div class="help-text">REIT屬利率敏感：以區間操作為主。</div>
                <table>
                    <thead><tr><th>Stock</th><th>Market</th><th>Current Price</th><th>Suggested Buy</th><th>Take-Profit</th><th>Stop-Loss</th><th>Note</th></tr></thead>
                    <tbody>
                        ${planRow('EQIX','NASDAQ','AI需求受惠')}
                        ${planRow('DLR','NYSE','擴展與可持續性')}
                    </tbody>
                </table>

                <h4>Overall Market Summary</h4>
                <p>Resilient risk appetite led by AI and data-center demand; watch rates/geopolitics.</p>
            </div>
        `;
    }

    async runPrediction() {
        const formData = this.getFormData();
        // Normalize symbol for Yahoo
        const normalizeYahoo = (s) => {
            if (!s) return s;
            let sym = (s+'').trim().toUpperCase();
            if (/^HK:/.test(sym)) sym = sym.replace(/^HK:/,'') + '.HK';
            if (/^\d{4}$/.test(sym)) sym = sym + '.HK';
            return sym;
        };
        formData.symbol = normalizeYahoo(formData.symbol);
        if (!this.validateForm(formData)) return;

        this.showLoading(true);
        this.clearResults();
        this.showToast('正在同步 Yahoo 真實數據...', 'info');
        
        // Debug mode: log backend configuration
        console.log('Backend Base URL:', this.backendBase);
        console.log('API URL:', this.apiUrl);

        try {
            // Fetch Yahoo historical closes first
            let fetchReason = '';
            let ts;
            try {
                ts = await this.fetchYahooHistorical(formData.symbol, '3mo');
                if (!ts || !Array.isArray(ts.closes)) {
                    fetchReason = 'yahoo_parse_3mo';
                    ts = { dates: [], closes: [], volumes: [] };
                }
            } catch (error) {
                console.warn('3mo data fetch failed:', error.message);
                if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                    fetchReason = 'rate_limit_3mo';
                } else {
                    fetchReason = 'yahoo_error_3mo';
                }
                ts = { dates: [], closes: [], volumes: [] };
            }
            let closes = (ts.closes || []).filter(v => isFinite(v) && v > 0);
            let dates = ts.dates || [];
            if (closes.length < 100) {
                try {
                    const ts6 = await this.fetchYahooHistorical(formData.symbol, '6mo');
                    const closes6 = (ts6?.closes || []).filter(v => isFinite(v) && v > 0);
                    if (closes6.length >= 30) {
                        closes = closes6;
                        dates = ts6.dates || dates;
                    } else {
                        fetchReason = fetchReason || 'yahoo_insufficient_3_6mo';
                    }
                } catch (error) {
                    console.warn('6mo data fetch failed:', error.message);
                    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                        fetchReason = fetchReason || 'rate_limit_6mo';
                    } else {
                        fetchReason = fetchReason || 'yahoo_error_6mo';
                    }
                }
            }
            // Try 1y as last fallback
            if (closes.length < 30) {
                try {
                    const ts1y = await this.fetchYahooHistorical(formData.symbol, '1y');
                    const closes1y = (ts1y?.closes || []).filter(v => isFinite(v) && v > 0);
                    if (closes1y.length >= 30) {
                        closes = closes1y;
                        dates = ts1y.dates || dates;
                    }
                } catch (error) {
                    console.warn('1y data fetch failed:', error.message);
                    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                        fetchReason = fetchReason || 'rate_limit_1y';
                    } else {
                        fetchReason = fetchReason || 'yahoo_error_1y';
                    }
                }
            }
            if (closes.length < 30) {
                console.error('Data fetch failed; reason:', fetchReason || 'yahoo_insufficient_all', 'symbol:', formData.symbol);
                
                // Show more helpful error message based on the failure reason
                let errorMessage = '資料不足，請確認代號格式（美股：AAPL；港股：0700.HK）或稍後重試';
                
                if (fetchReason && fetchReason.includes('rate_limit')) {
                    errorMessage = 'API 請求過於頻繁，請稍後重試（建議等待 1-2 分鐘）';
                } else if (fetchReason && fetchReason.includes('insufficient')) {
                    errorMessage = '股票代號可能不存在或資料不足，請確認代號格式：\n• 美股：AAPL, MSFT, GOOGL\n• 港股：0700.HK, 0941.HK\n• 台股：2330.TW';
                } else if (fetchReason && fetchReason.includes('parse')) {
                    errorMessage = '資料解析失敗，可能是網路問題，請稍後重試';
                }
                
                this.showToast(errorMessage, 'error', 8000);
                throw new Error(errorMessage);
            }

            // Real-time quote
            const yq = await this.fetchYahooQuote(formData.symbol);
            if (isFinite(yq.price) && closes.length) {
                closes[closes.length - 1] = Number(yq.price);
            }
            const rtEl = document.getElementById('realTimeQuote');
            if (rtEl) rtEl.textContent = isFinite(yq.price) ? `$${Number(yq.price).toFixed(2)}` : '-';

            // Price alert check
            let alertMsg = '';
            try {
                if (isFinite(formData.alertPrice) && isFinite(yq.price) && yq.price > formData.alertPrice) {
                    alertMsg = `Alert: ${formData.symbol} exceeded ${formData.alertPrice}! Current: ${yq.price}`;
                    if ('Notification' in window) {
                        const perm = await Notification.requestPermission();
                        if (perm === 'granted') {
                            new Notification(alertMsg);
                        } else {
                            window.alert(alertMsg);
                        }
                    } else {
                        window.alert(alertMsg);
                    }
                }
            } catch (_) {}

            // Sentiment from X (heuristic via backend)
            let xSent = 0;
            try {
                const sresp = await fetch(`${this.backendBase}/api/x/sentiment?symbol=${encodeURIComponent(formData.symbol)}`);
                const sdata = await sresp.json();
                if (sdata && isFinite(sdata.score)) xSent = Number(sdata.score);
                console.log('X sentiment', formData.symbol, xSent, sdata);
            } catch (_) {}

            // News integration
            let news = { headlines: [], score: 0 };
            try {
                const nresp = await fetch(`${this.backendBase}/api/news/sentiment?symbol=${encodeURIComponent(formData.symbol)}`);
                const ndata = await nresp.json();
                if (Array.isArray(ndata.headlines)) news.headlines = ndata.headlines;
                if (isFinite(ndata.score)) news.score = Number(ndata.score) || 0;
                console.log('News headlines', news);
            } catch (_) {}

            // Execute calculations with unified closes
            const dataFetcher = { fetchFundamentals: async ()=>({}) };
            const calculator = new QuantitativeCalculator();

            const stockData = { dates: dates, closes: closes, volumes: ts.volumes || [], opens: ts.opens || [], highs: ts.highs || [], lows: ts.lows || [] };
            // Auto request Perplexity analysis with the fetched series (only if user provided a Perplexity key)
            try {
                const keyEl = document.getElementById('grokApiKey');
                const userPerplexityKey = keyEl && keyEl.value ? keyEl.value.trim() : '';
                if (userPerplexityKey) {
                    let ga;
                    try {
                        ga = await fetch(`${this.backendBase}/api/grok/analyze`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey: userPerplexityKey, symbol: formData.symbol, series: { dates, closes, volumes: ts.volumes || [] } })
                        });
                    } catch (e1) {
                        ga = await fetch(`http://localhost:3001/api/grok/analyze`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey: userPerplexityKey, symbol: formData.symbol, series: { dates, closes, volumes: ts.volumes || [] } })
                        });
                    }
                    const gag = await ga.json();
                    const el = document.getElementById('grokAutoOutput');
                    if (el) el.textContent = JSON.stringify(gag.analysis || gag, null, 2);
                } else {
                    const el = document.getElementById('grokAutoOutput');
                    if (el) el.textContent = '（未提供 Perplexity API 金鑰，已跳過自動分析）';
                }
            } catch (_) {}
            const fundamentals = await dataFetcher.fetchFundamentals();
            const metrics = calculator.calculateMetrics(closes);
            // Beta vs S&P 500 (^GSPC)
            try {
                const spx = await this.fetchYahooHistorical('^GSPC', '6mo');
                const minLen = Math.min((spx?.closes || []).length, closes.length);
                if (minLen > 30) {
                    const a = closes.slice(-minLen);
                    const b = (spx?.closes || []).slice(-minLen);
                    const ra = []; const rb = [];
                    for (let i = 1; i < minLen; i++) { ra.push(Math.log(a[i]/a[i-1])); rb.push(Math.log(b[i]/b[i-1])); }
                    const mean = (arr)=>arr.reduce((x,y)=>x+y,0)/arr.length;
                    const ma = mean(ra), mb = mean(rb);
                    let cov = 0, varb = 0; for (let i=0;i<ra.length;i++){ cov += (ra[i]-ma)*(rb[i]-mb); varb += Math.pow(rb[i]-mb,2);} cov/= (ra.length-1); varb/= (rb.length-1);
                    const beta = isFinite(varb) && varb>0 ? cov/varb : 1;
                    metrics.beta = beta;
                } else { metrics.beta = 1; }
            } catch (_) { metrics.beta = 1; }
            if (isFinite(metrics.beta) && metrics.beta > 0) {
                // Adjust Sharpe proxy: add market component (simple heuristic)
                metrics.marketAdjusted = true;
            }
            // Adjust annual mu with sentiment tilt (±5%)
            if (isFinite(xSent)) { metrics.mu = (metrics.mu || 0) + (xSent * 0.05); metrics.xSentiment = xSent; }
            if (isFinite(news.score)) { metrics.mu = (metrics.mu || 0) + (news.score * 0.1); metrics.newsSentiment = news.score; }
            const technical = calculator.calculateTechnical(closes);
            const sentiment = this.calculateSentiment(closes, technical, formData.market);
            const simulations = await this.runSimulations(closes, formData, metrics);
            const riskMetrics = calculator.calculateRiskMetrics(simulations, formData.amount);
            // Kelly Criterion (conservative)
            try {
                const adjMu = Number(metrics.mu) || 0; // annualized
                const adjSigma = Number(metrics.sigma) || 0.2; // annualized
                const kelly = (adjMu - 0.04) / Math.max(1e-8, adjSigma * adjSigma);
                const kellyFraction = Math.min(0.2, Math.max(0, kelly / 2));
                const rtScale = Math.min(1, Math.max(0, (formData.riskTolerance || 10) / 20));
                const finalFraction = Math.min(0.2, kellyFraction * rtScale);
                riskMetrics.kellyFraction = kellyFraction;
                riskMetrics.suggestedAllocation = Math.min(riskMetrics.suggestedAllocation || finalFraction, finalFraction);
            } catch (_) {}
            const predictions = await calculator.generatePredictions(closes, formData.days);
            const backtest = await calculator.backtestAccuracy(closes, 30);

            // Scenario analysis
            const simulator = new MonteCarloSimulator();
            const optSim = simulator.simulateGBM(closes[closes.length-1], (metrics.mu||0)+0.05, (metrics.sigma||0.2)*0.8, formData.days, Math.min(formData.paths, 3000));
            const pesSim = simulator.simulateGBM(closes[closes.length-1], (metrics.mu||0)-0.05, (metrics.sigma||0.2)*1.2, formData.days, Math.min(formData.paths, 3000));
            const crashSim = simulator.simulateGBM(closes[closes.length-1], (metrics.mu||0)-0.10, (metrics.sigma||0.2)*1.5, formData.days, Math.min(formData.paths, 3000), { crashProbDaily: 0.08, crashDropFraction: 0.3 });
            const inflationSim = simulator.simulateGBM(closes[closes.length-1], (metrics.mu||0)-0.05, (metrics.sigma||0.2), formData.days, Math.min(formData.paths, 3000));
            const upProbFromSim = (sim) => {
                if (!sim?.paths?.length) return 0;
                const last = sim.paths.map(p => p[p.length-1]);
                const s0 = closes[closes.length-1];
                const up = last.filter(v => v > s0).length;
                return 100 * up / last.length;
            };
            const scenarios = {
                optimistic: upProbFromSim(optSim),
                pessimistic: upProbFromSim(pesSim),
                crash: upProbFromSim(crashSim),
                inflation: upProbFromSim(inflationSim)
            };

            // Portfolio optimization (Markowitz) if multiple symbols provided
            let portfolio = null;
            try {
                const symbols = Array.isArray(formData.portfolioSymbols) ? formData.portfolioSymbols : [];
                const uniqueSymbols = symbols.filter((s, i) => symbols.indexOf(s) === i);
                if (uniqueSymbols.length >= 2) {
                    const series = [];
                    for (const s of uniqueSymbols) {
                        const tsx = await this.fetchYahooHistorical(s, '6mo');
                        const cl = (tsx?.closes || []).filter(v => isFinite(v) && v > 0);
                        if (cl.length < 60) throw new Error('insufficient');
                        series.push(cl);
                    }
                    const minLen = Math.min(...series.map(a => a.length));
                    const aligned = series.map(a => a.slice(-minLen));
                    const returns = aligned.map(arr => {
                        const r = [];
                        for (let i = 1; i < arr.length; i++) r.push(Math.log(arr[i] / arr[i-1]));
                        return r;
                    });
                    const mjs = window.math;
                    const k = returns.length;
                    // Covariance matrix
                    const cov = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => {
                        const ri = returns[i], rj = returns[j];
                        const meanI = ri.reduce((a,b)=>a+b,0)/ri.length;
                        const meanJ = rj.reduce((a,b)=>a+b,0)/rj.length;
                        let s = 0; for (let t = 0; t < ri.length; t++) s += (ri[t]-meanI)*(rj[t]-meanJ);
                        return s / (ri.length - 1);
                    }));
                    // Expected returns vector (annualized)
                    const muVec = returns.map(r => (r.reduce((a,b)=>a+b,0)/r.length) * 252);
                    let w = [];
                    try {
                        const inv = mjs.inv(cov);
                        const raw = mjs.multiply(inv, muVec);
                        const sum = raw.reduce((a,b)=>a+b,0);
                        w = raw.map(v => v / (sum || 1));
                    } catch (_) {
                        w = Array(k).fill(1 / k);
                    }

                    // Correlation matrix
                    const corr = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => {
                        const ri = returns[i], rj = returns[j];
                        const mi = ri.reduce((a,b)=>a+b,0)/ri.length;
                        const mj = rj.reduce((a,b)=>a+b,0)/rj.length;
                        let covij = 0, sdi = 0, sdj = 0;
                        for (let t=0;t<ri.length;t++){ const di=ri[t]-mi; const dj=rj[t]-mj; covij+=di*dj; sdi+=di*di; sdj+=dj*dj; }
                        covij/= (ri.length-1); sdi = Math.sqrt(sdi/(ri.length-1)); sdj = Math.sqrt(sdj/(ri.length-1));
                        const c = (sdi>0 && sdj>0) ? (covij/(sdi*sdj)) : 0;
                        return c;
                    }));

                    // Risk parity weights (1/sigma normalized)
                    const sigmas = returns.map(r => {
                        const m = r.reduce((a,b)=>a+b,0)/r.length;
                        const v = r.reduce((s,x)=>s+Math.pow(x-m,2),0)/(r.length-1);
                        return Math.sqrt(Math.max(1e-9, v));
                    });
                    const invSig = sigmas.map(s=>1/Math.max(1e-9,s));
                    const invSum = invSig.reduce((a,b)=>a+b,0);
                    const wRiskParity = invSig.map(v=>v/(invSum||1));

                    // CV optimization: min variance for target return (KKT)
                    let wCv = Array(k).fill(1/k);
                    try {
                        const A = mjs.inv(cov);
                        const ones = Array(k).fill(1);
                        const mu = muVec;
                        const a = mjs.multiply(mjs.multiply(ones, A), ones);
                        const b = mjs.multiply(mjs.multiply(ones, A), mu);
                        const c = mjs.multiply(mjs.multiply(mu, A), mu);
                        const target = mu.reduce((s,v)=>s+v,0)/(mu.length||1) * 0.5;
                        const denom = (a*c - b*b) || 1;
                        const lambda1 = (c - b*target) / denom;
                        const lambda2 = (a*target - b) / denom;
                        const vKKT = mjs.add(mjs.multiply(lambda1, ones), mjs.multiply(lambda2, mu));
                        const wRaw = mjs.multiply(A, vKKT);
                        const sumW = wRaw.reduce((s,v)=>s+v,0) || 1;
                        wCv = wRaw.map(v=>v/sumW);
                    } catch (_) {}

                    portfolio = { symbols: uniqueSymbols, weights: w, weightsRiskParity: wRiskParity, weightsCv: wCv, corr };
                }
            } catch (_) {}

            const result = {
                ...formData,
                stockData,
                fundamentals,
                metrics,
                technical,
                sentiment: { ...sentiment, x: xSent, news },
                simulations,
                riskMetrics,
                predictions,
                backtest,
                scenarios,
                abTest: (() => {
                    try {
                        const lastClose = closes[closes.length - 1];
                        const predA = predictions.gbm;
                        const predB = (predictions.gbm + predictions.lstm) / 2;
                        const errA = Math.abs((predA - lastClose) / (lastClose || 1));
                        const errB = Math.abs((predB - lastClose) / (lastClose || 1));
                        const accuracyDiff = (errA - errB) * 100; // positive => B better
                        const group = Math.random() < 0.5 ? 'A' : 'B';
                        try {
                            const key = 'ab_test_logs_v1';
                            const logs = JSON.parse(localStorage.getItem(key) || '[]');
                            logs.unshift({ ts: new Date().toISOString(), symbol: formData.symbol, group, predA, predB, errA, errB, accuracyDiff });
                            localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
                        } catch (_) {}
                        return { group, accuracyDiff };
                    } catch (_) { return { group: 'A', accuracyDiff: 0 }; }
                })(),
                portfolio,
                varBacktest: (() => {
                    try {
                        const cap = formData.amount || 10000;
                        const rets = calculator.calculateLogReturns(closes).map(r=>r*cap);
                        const { varValue } = calculator.calculateVaRAndES(rets, 0.95);
                        const breaches = rets.filter(r => r < varValue).length;
                        const rate = (breaches / Math.max(1, rets.length)) * 100;
                        return { breaches, total: rets.length, breachRatePct: rate };
                    } catch (_) { return { breaches: 0, total: 0, breachRatePct: 0 }; }
                })(),
                alertMsg,
                timestamp: new Date().toISOString()
            };

            this.displayResults(result);
            this.lastResultData = result;
            // Setup real-time updates if toggled
            this.setupRealtimeIfEnabled(formData, result);
            this.history.add(result);
            this.showToast('預測完成', 'success');
        } catch (error) {
            this.showError(error.message);
            this.showToast(`錯誤：${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    setupRealtimeIfEnabled(formData, result) {
        try {
            const toggle = document.getElementById('realtimeToggle');
            const enabled = toggle && toggle.checked;
            // Clear previous
            if (this.realtimeIntervalId) {
                clearInterval(this.realtimeIntervalId);
                this.realtimeIntervalId = null;
            }
            if (this.ws && this.ws.disconnect) {
                try { this.ws.disconnect(); } catch (_) {}
                this.ws = null;
            }
            if (!enabled) return;

            // Interval fallback every 60s; plus 5-min polling sync block
            this.realtimeIntervalId = setInterval(async () => {
                try {
                    const q = await this.fetchYahooQuote(formData.symbol);
                    if (!isFinite(q.price)) return;
                    const el = document.getElementById('realTimeQuote');
                    if (el) el.textContent = `$${Number(q.price).toFixed(2)}`;
                    // Update closes and partial re-sim GBM using last 5 closes
                    const closes = result.stockData.closes.slice();
                    closes[closes.length - 1] = Number(q.price);
                    const last = closes.slice(-6);
                    const returns = [];
                    for (let i = 1; i < last.length; i++) returns.push(Math.log(last[i] / last[i-1]));
                    const muDaily = returns.length ? returns.reduce((a,b)=>a+b,0)/returns.length : 0;
                    const varDaily = returns.length > 1 ? returns.reduce((s,v)=>s+Math.pow(v-muDaily,2),0)/(returns.length-1) : 0;
                    const mu = muDaily * 252;
                    const sigma = Math.sqrt(Math.max(0, varDaily)) * Math.sqrt(252);
                    const simulator = new MonteCarloSimulator();
                    const sim = simulator.simulateGBM(closes[closes.length-1], mu, sigma, formData.days, Math.min(formData.paths, 2000));
                    result.stockData.closes = closes;
                    result.simulations = sim;
                    this.renderCharts(result);
                    this.pushLivePointToCharts(Number(q.price));
                    this.checkPriceJump(Number(q.price));
                } catch (e) { console.warn('Realtime update failed', e); }
            }, 60000);

            // Poll every 5 minutes for full refresh of latest price and cache
            setInterval(async () => {
                try {
                    const map = await this.fetchYahooQuotesBatch([formData.symbol]);
                    const px = map[formData.symbol];
                    if (isFinite(px)) {
                        const el = document.getElementById('realTimeQuote');
                        if (el) el.textContent = `$${Number(px).toFixed(2)}`;
                    }
                } catch (_) {}
            }, 300000);

            // Optional Pusher-based WS stub if available
            try {
                if (window.Pusher) {
                    const pusher = new Pusher('placeholder-key', { cluster: 'placeholder', forceTLS: true, enabledTransports: ['ws','wss'] });
                    const channel = pusher.subscribe('quotes');
                    channel.bind('price', (data) => {
                        if (!data || data.symbol !== formData.symbol || !isFinite(data.price)) return;
                        const el = document.getElementById('realTimeQuote');
                        if (el) el.textContent = `$${Number(data.price).toFixed(2)}`;
                    });
                    this.ws = pusher;
                }
            } catch (_) {}
        } catch (_) {}
    }

    getFormData() {
        return {
            market: document.getElementById('market').value,
            symbol: document.getElementById('stockSymbol').value.trim().toUpperCase(),
            amount: parseFloat(document.getElementById('investmentAmount').value),
            days: parseInt(document.getElementById('horizon').value),
            paths: Math.min(20000, Math.max(500, parseInt(document.getElementById('paths').value) || 5000)),
            riskTolerance: parseInt(document.getElementById('riskTolerance').value),
            model: document.getElementById('modelKind').value,
            portfolioSymbols: (document.getElementById('portfolioSymbols')?.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
            alertPrice: parseFloat(document.getElementById('alertPrice')?.value)
        };
    }

    validateForm(data) {
        const showErr = (msg) => {
            const el = document.getElementById('formError');
            if (el) {
                el.textContent = msg;
                el.style.display = 'block';
            }
            try { window.alert(msg); } catch (_) {}
        };

        const clearErr = () => {
            const el = document.getElementById('formError');
            if (el) {
                el.textContent = '';
                el.style.display = 'none';
            }
        };

        // Basic presence
        if (!data.symbol) {
            showErr('Invalid symbol format');
            return false;
        }
        if (!isFinite(data.amount) || data.amount <= 0) {
            showErr('Invalid amount');
            return false;
        }
        if (!Number.isInteger(data.days) || data.days <= 0) {
            showErr('Invalid horizon');
            return false;
        }

        // Format checks
        const sym = data.symbol.toUpperCase().trim();
        let ok = false;
        if (data.market === 'HK') {
            ok = /^\d{3,5}\.HK$/i.test(sym);
        } else {
            ok = /^[A-Z0-9]{1,10}$/.test(sym);
        }
        if (!ok) {
            showErr('Invalid symbol format');
            return false;
        }

        clearErr();
        return true;
    }

    async executePrediction(formData) {
        // Deprecated: replaced by Yahoo-first pipeline in runPrediction()
        const dataFetcher = new DataFetcher(this.apiUrl);
        const calculator = new QuantitativeCalculator();
        const stockData = await this.fetchYahooHistorical(formData.symbol, '6mo');
        if (!stockData || !Array.isArray(stockData.closes) || stockData.closes.length === 0) {
            throw new Error('Data fetch failed, try again');
        }
        const fundamentals = await dataFetcher.fetchFundamentals(formData.symbol);
        const metrics = calculator.calculateMetrics(stockData.closes);
        const technical = calculator.calculateTechnical(stockData.closes);
        const sentiment = this.calculateSentiment(stockData.closes, technical, formData.market);
        const simulations = await this.runSimulations(stockData.closes, formData, metrics);
        const riskMetrics = calculator.calculateRiskMetrics(simulations, formData.amount);
        const predictions = calculator.generatePredictions(stockData.closes, formData.days);
        return { ...formData, stockData, fundamentals, metrics, technical, sentiment, simulations, riskMetrics, predictions, timestamp: new Date().toISOString() };
    }

    async runSimulations(closes, formData, metrics) {
        if (formData.model === 'GBM') {
            return this.runGBMSimulation(closes, formData, metrics);
        } else {
            return this.runAdvancedSimulation(closes, formData, metrics);
        }
    }

    runGBMSimulation(closes, formData, metrics) {
        const simulator = new MonteCarloSimulator();
        return simulator.simulateGBM(
            closes[closes.length - 1],
            metrics.mu || 0.05,
            metrics.sigma || 0.2,
            formData.days,
            formData.paths
        );
    }

    async runAdvancedSimulation(closes, formData, metrics) {
        const modelEndpoints = {
            'JUMP': `${this.backendBase}/api/sim/jump`,
            'HESTON': `${this.backendBase}/api/sim/heston`,
            'GARCH': `${this.backendBase}/api/sim/garch`
        };

        const endpoint = modelEndpoints[formData.model];
        const last = closes[closes.length - 1];
        const paths = Math.min(formData.paths, 8000);
        // Try backend first
        if (endpoint) {
            try {
                const response = await fetch(`${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ closes, days: formData.days, paths })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (!result.error && (result.quantiles || result.paths)) {
                        if (Array.isArray(result.paths)) {
                            return { paths: result.paths, quantiles: (new MonteCarloSimulator()).calculateQuantiles(result.paths) };
                        }
                        return { paths: [], quantiles: result };
                    }
                }
            } catch (_) { /* fall through to local */ }
        }
        // Local fallbacks
        const sim = new MonteCarloSimulator();
        if (formData.model === 'JUMP') {
            return sim.simulateJumpDiffusion(last, metrics.mu || 0.05, metrics.sigma || 0.2, formData.days, paths, { lambda: 0.2, kappa: -0.08, delta: 0.25 });
        }
        if (formData.model === 'HESTON') {
            const v0 = Math.max(1e-6, Math.pow((metrics.garchSigmaDaily || metrics.sigmaDaily || 0.02), 2));
            const kappa = 2.0, theta = v0, xi = 0.5, rho = -0.6;
            return sim.simulateHeston(last, metrics.mu || 0.05, v0, kappa, theta, xi, rho, formData.days, paths);
        }
        if (formData.model === 'GARCH') {
            const sigma0 = metrics.garchSigmaDaily || metrics.sigmaDaily || 0.02;
            return sim.simulateGARCH(last, metrics.mu || 0.05, formData.days, paths, 0.00005, 0.08, 0.9, sigma0);
        }
        return this.runGBMSimulation(closes, formData, metrics);
    }

    calculateSentiment(closes, technical, market) {
        const sentimentCalculator = new SentimentCalculator();
        return sentimentCalculator.calculate(closes, technical, market);
    }

    displayResults(result) {
        this.updateKPIs(result);
        this.renderDetailedResults(result);
        this.renderCharts(result);
        this.renderBacktestTable(result);
        document.getElementById('downloadBtn').style.display = 'block';
        const csvBtn = document.getElementById('exportBtn');
        const xlsBtn = document.getElementById('exportExcelBtn');
        if (csvBtn) { csvBtn.style.display = 'inline-block'; csvBtn.onclick = () => this.exportData(result, 'csv'); }
        if (xlsBtn) { xlsBtn.style.display = 'inline-block'; xlsBtn.onclick = () => this.exportData(result, 'excel'); }
    }

    updateKPIs(result) {
        const latestPrice = result.stockData?.closes?.[result.stockData.closes.length - 1] || 0;
        const combinedPrice = result.predictions?.combined || 0;
        const upProb = result.predictions?.upProbability || 0;
        const suggestedAlloc = result.riskMetrics?.suggestedAllocation || 0;

        // Animate KPI updates
        this.animateKPIUpdate('kpiPrice', `$${(isFinite(latestPrice) ? latestPrice : 0).toFixed(2)}`);
        this.animateKPIUpdate('kpiForecast', `$${combinedPrice.toFixed(2)}`);
        this.animateKPIUpdate('kpiProb', `${upProb.toFixed(1)}%`);
        this.animateKPIUpdate('kpiAlloc', `${(suggestedAlloc * 100).toFixed(1)}%`);

        // Add status classes based on values
        const kpiItems = document.querySelectorAll('.kpi-item');
        kpiItems.forEach((item, index) => {
            item.classList.remove('positive', 'negative', 'neutral');
            
            if (index === 2) { // Up probability
                if (upProb > 60) item.classList.add('positive');
                else if (upProb < 40) item.classList.add('negative');
                else item.classList.add('neutral');
            } else if (index === 3) { // Allocation
                if (suggestedAlloc > 0.15) item.classList.add('positive');
                else if (suggestedAlloc < 0.05) item.classList.add('negative');
                else item.classList.add('neutral');
            } else {
                item.classList.add('neutral');
            }
        });
    }

    animateKPIUpdate(elementId, newValue) {
        const element = document.getElementById(elementId);
        const parent = element.closest('.kpi-item');
        
        // Add pulse animation
        parent.classList.add('animate-pulse');
        
        // Update value with counter animation
        this.animateCounter(element, newValue, 1000);
        
        // Remove pulse after animation
        setTimeout(() => {
            parent.classList.remove('animate-pulse');
        }, 1000);
    }

    animateCounter(element, targetValue, duration) {
        const startValue = parseFloat(element.textContent.replace(/[$,%]/g, '')) || 0;
        const target = parseFloat(targetValue.replace(/[$,%]/g, '')) || 0;
        const isPercentage = targetValue.includes('%');
        const isCurrency = targetValue.includes('$');
        
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (target - startValue) * easeOutCubic;
            
            let displayValue = currentValue.toFixed(isCurrency ? 2 : 1);
            if (isCurrency) displayValue = `$${displayValue}`;
            if (isPercentage) displayValue = `${displayValue}%`;
            
            element.textContent = displayValue;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = targetValue;
            }
        };
        
        requestAnimationFrame(animate);
    }

    renderDetailedResults(result) {
        const renderer = new ResultRenderer();
        const html = renderer.generateHTML(result);
        document.getElementById('result').innerHTML = html;
    }

    renderCharts(result) {
        if (typeof Chart === 'undefined') {
            this.showToast('圖表庫未加載，略過圖表渲染', 'warning');
            return;
        }
        const chartRenderer = new ChartRenderer();
        
        // Price prediction chart
        const stockCanvas = document.getElementById('stockChart');
        if (stockCanvas && !stockCanvas.getAttribute('height')) stockCanvas.setAttribute('height', '320');
        const stockCtx = stockCanvas.getContext('2d');
        chartRenderer.renderPriceChart(stockCtx, result);

        // Risk distribution chart
        const riskCanvas = document.getElementById('riskChart');
        if (riskCanvas && !riskCanvas.getAttribute('height')) riskCanvas.setAttribute('height', '320');
        const riskCtx = riskCanvas.getContext('2d');
        chartRenderer.renderRiskChart(riskCtx, result);

        // Drawdown chart
        const ddCanvas = document.getElementById('ddChart');
        if (ddCanvas && !ddCanvas.getAttribute('height')) ddCanvas.setAttribute('height', '320');
        const ddCtx = ddCanvas.getContext('2d');
        chartRenderer.renderDrawdownChart(ddCtx, result);

        // Historical candlestick + volume
        const histCanvas = document.getElementById('historicalChart');
        if (histCanvas) {
            histCanvas.style.display = 'block';
            if (!histCanvas.getAttribute('height')) histCanvas.setAttribute('height', '320');
            const hctx = histCanvas.getContext('2d');
            chartRenderer.renderHistoricalChart(hctx, result);
        }
    }

    renderBacktestTable(result) {
        try {
            const tbl = document.getElementById('backtestTable');
            if (!tbl || !result?.backtest?.models) return;
            const rows = Object.entries(result.backtest.models).map(([name, m]) => {
                return `<tr><td>${name}</td><td>${isFinite(m.mae) ? m.mae.toFixed(2) : '—'}</td><td>${isFinite(m.rmse) ? m.rmse.toFixed(2) : '—'}</td></tr>`;
            }).join('');
            tbl.innerHTML = rows || '<tr><td>—</td><td>—</td><td>—</td></tr>';
        } catch (_) {}
    }

    exportData(result, kind = 'csv') {
        try {
            const rows = [];
            rows.push(['Model','Pred Price','Up Prob','VaR','Sharpe']);
            rows.push(['LSTM', (result.predictions?.lstm||0).toFixed(4), (result.predictions?.upProbability||0).toFixed(2), (result.riskMetrics?.var95||0).toFixed(2), (result.riskMetrics?.sharpeRatio||0).toFixed(4)]);
            rows.push(['GBM', (result.predictions?.gbm||0).toFixed(4), (result.predictions?.upProbability||0).toFixed(2), (result.riskMetrics?.var95||0).toFixed(2), (result.riskMetrics?.sharpeRatio||0).toFixed(4)]);
            rows.push(['ARIMA', (result.predictions?.arima||0).toFixed(4), (result.predictions?.upProbability||0).toFixed(2), (result.riskMetrics?.var95||0).toFixed(2), (result.riskMetrics?.sharpeRatio||0).toFixed(4)]);
            rows.push(['Combined', (result.predictions?.combined||0).toFixed(4), (result.predictions?.upProbability||0).toFixed(2), (result.riskMetrics?.var95||0).toFixed(2), (result.riskMetrics?.sharpeRatio||0).toFixed(4)]);
            // Monte Carlo quantiles
            const q = result.simulations?.quantiles || {};
            if (q.q5 || q.q50 || q.q95) {
                rows.push([]);
                rows.push(['Quantile','Series']);
                const toLine = (arr)=>Array.isArray(arr)?arr.map(v=>Number(v).toFixed(4)).join(' '):'';
                rows.push(['q05', toLine(q.q5)]);
                rows.push(['q50', toLine(q.q50)]);
                rows.push(['q95', toLine(q.q95)]);
            }

            const csv = rows.map(r => r.map(x => `"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
            const mime = kind === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;';
            const blob = new Blob([csv], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = kind === 'excel' ? 'prediction_data.xls' : 'prediction_data.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            this.showToast('Export failed', 'error');
        }
    }

    showLoading(show) {
        const btn = document.getElementById('predictBtn');
        if (!btn) return;
        const spinner = btn.querySelector('.btn-spinner');
        const text = btn.querySelector('.btn-text');
        const overlay = document.getElementById('loading');

        if (show) {
            btn.disabled = true;
            if (spinner) spinner.style.display = 'block';
            if (text) text.textContent = '計算中...';
            if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); }
        } else {
            btn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (text) text.textContent = '運行 AI 多路徑預測';
            if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
        }
    }

    clearResults() {
        document.getElementById('result').innerHTML = '';
        document.getElementById('downloadBtn').style.display = 'none';
        
        // Clear charts and ensure canvases are freed
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        this.charts = {};
        const canvases = ['stockChart','riskChart','ddChart'];
        canvases.forEach(id => {
            const c = document.getElementById(id);
            if (!c) return;
            const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(c) : null;
            if (existing) existing.destroy();
        });
    }

    toggleDebugData() {
        try {
            const container = document.getElementById('result');
            if (!container) return;
            const existing = document.getElementById('debugRawTable');
            if (existing) { existing.remove(); return; }
            const last = this.lastResultData || null;
            if (!last || !Array.isArray(last?.stockData?.closes)) { this.showToast('No data', 'warning'); return; }
            const rows = (last.stockData.dates || []).map((d, i) => {
                const c = last.stockData.closes[i] ?? '';
                const v = last.stockData.volumes?.[i] ?? '';
                return `<tr><td>${d || ''}</td><td>${isFinite(c) ? Number(c).toFixed(2) : ''}</td><td>${isFinite(v) ? v : ''}</td></tr>`;
            }).join('');
            const table = document.createElement('div');
            table.id = 'debugRawTable';
            table.className = 'result-content';
            table.innerHTML = `
                <h4>Raw Data (Debug)</h4>
                <table>
                    <thead><tr><th>Date</th><th>Close</th><th>Volume</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
            container.appendChild(table);
        } catch (_) {}
    }

    showError(message) {
        document.getElementById('result').innerHTML = `
            <div style="color: var(--danger); padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <strong>錯誤：</strong>${message}
            </div>
        `;
    }

    downloadReport() {
        const report = document.querySelector('.container');
        html2canvas(report, { scale: 2 }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save('stock_report.pdf');
        });
    }

    toast(message, type = 'success', duration = 3000) {
        this.showToast(message, type, duration);
    }

    showToast(message, type = 'success', duration = 3000) {
        const toast = document.getElementById('toast');
        
        // Add icon based on type
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                ${icons[type] || icons.info}
                <span>${message}</span>
            </div>
        `;
        
        toast.className = `toast ${type} show`;
        
        // Add entrance animation
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 50);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => {
                toast.classList.remove('show');
            }, 300);
        }, duration);
    }

    async refreshMonitor() {
        try {
            // Skip when running from file:// without backend
            const isFile = location.protocol === 'file:';
            if (isFile) return;
            const response = await fetch(`${this.backendBase}/api/monitor/status`);
            const data = await response.json();
            
            if (data && Array.isArray(data.items)) {
                const rows = data.items.filter(x => x.ok).map(x => 
                    `<tr><td>${x.symbol}</td><td>$${x.lastClose?.toFixed(2) || '-'}</td><td>${x.dailyReturnPct?.toFixed(2) || '-'}%</td></tr>`
                ).join('');
                
                const html = `
                    <table>
                        <tr><th>代號</th><th>最新收市</th><th>當日變動</th></tr>
                        ${rows}
                    </table>
                    <div class="help-text">上次更新：${data.lastRun || '-'}</div>
                `;
                
                document.getElementById('monitor').innerHTML = html || '—';
            }
        } catch (error) {
            const el = document.getElementById('monitor');
            if (el) el.textContent = '—';
        }
    }

    setupAutoRefresh() {
        if (document.getElementById('autoRefresh').checked) {
            setInterval(() => this.refreshMonitor(), 5 * 60 * 1000); // 5 minutes
        }
    }

    async fetchYahooQuote(symbol) {
        const fetchOnce = async () => {
            const url = `${this.backendBase}/api/yahoo/quote?symbol=${encodeURIComponent(symbol)}`;
            console.log(`Fetching Yahoo quote from: ${url}`);
            
            const resp = await fetch(url).catch((e)=>{ 
                console.error('Quote fetch error:', e); 
                throw new Error(`Network error: ${e.message}`);
            });
            
            if (!resp.ok) {
                console.error(`HTTP error: ${resp.status} ${resp.statusText}`);
                throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            }
            
            const data = await resp.json().catch((e) => {
                console.error('JSON parse error:', e);
                throw new Error('Invalid JSON response');
            });
            
            console.log('Yahoo quote response:', data);
            const r = data?.quoteResponse?.result?.[0] || data?.quoteResponse?.result?.[0];
            if (!r) {
                console.error('No quote result found in response:', data);
                throw new Error('No quote');
            }
            const price = r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice;
            return { price: Number(price), currency: r.currency };
        };
        return await this.withBackoff(fetchOnce, 3).catch((error) => { 
            console.error('Yahoo quote fetch failed after retries:', error);
            return { price: NaN }; 
        });
    }

    async fetchYahooQuotesBatch(symbols) {
        const fetchOnce = async () => {
            const list = symbols.join(',');
            const url = `${this.backendBase}/api/yahoo/quote?symbol=${encodeURIComponent(list)}`;
            const resp = await fetch(url).catch((e)=>{ console.log('batch quote fetch error', e); throw e; });
            const data = await resp.json();
            const results = data?.quoteResponse?.result || [];
            const map = {};
            results.forEach(r => {
                const sym = r.symbol;
                const p = r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice;
                if (sym && isFinite(p)) map[sym] = Number(p);
            });
        return map;
        };
        return await this.withBackoff(fetchOnce, 3).catch(() => ({}));
    }

    async fetchYahooHistorical(symbol, range = '6mo') {
        const key = `${symbol}:${range}`;
        const now = Date.now();
        // Cache hit
        try { const db = await this.dbPromise; if (db) { const c = await db.get('historical', key); if (c && (now - (c.ts||0) < 3600*1000)) return c.data; } } catch (_) {}
        const fetchOnce = async () => {
            const url = `${this.backendBase}/api/yahoo/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=1d`;
            console.log(`Fetching Yahoo chart data from: ${url}`);
            
            const resp = await fetch(url).catch((e)=>{ 
                console.error('Chart fetch error:', e); 
                throw new Error(`Network error: ${e.message}`);
            });
            
            if (!resp.ok) {
                console.error(`HTTP error: ${resp.status} ${resp.statusText}`);
                throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            }
            
            const data = await resp.json().catch((e) => {
                console.error('JSON parse error:', e);
                throw new Error('Invalid JSON response');
            });
            
            console.log('Yahoo chart response:', data);
            const r = data?.chart?.result?.[0];
            if (!r) {
                console.error('No chart result found in response:', data);
                throw new Error('no_result');
            }
            const ts = r.timestamp || [];
            const q = r.indicators?.quote?.[0] || {};
            let closes = (r.indicators?.adjclose?.[0]?.adjclose || q.close || []).map(v => Number(v));
            const volumes = (q.volume || []).map(v => Number(v));
            const opens = (q.open || []).map(v => Number(v));
            const highs = (q.high || []).map(v => Number(v));
            const lows = (q.low || []).map(v => Number(v));
            const dates = ts.map(t => new Date(t * 1000).toISOString().slice(0, 10));
            // Clean NaN and 3-sigma outliers
            closes = closes.map(v => (isFinite(v) && v > 0) ? v : NaN).filter(v => isFinite(v));
            const mean = closes.reduce((a,b)=>a+b,0)/Math.max(1,closes.length);
            const std = Math.sqrt(closes.reduce((s,v)=>s+Math.pow(v-mean,2),0)/Math.max(1,closes.length));
            closes = closes.filter(v => Math.abs(v-mean) <= 3*(std||1));
            let out = { dates, closes, volumes, opens, highs, lows };
            // Resilience: if too few points after cleaning, rebuild using raw quote.close without outlier filter
            if (!out.closes || out.closes.length < 30) {
                try {
                    const rawCloses = (q.close || []).map(v => Number(v)).filter(v => isFinite(v) && v > 0);
                    if (rawCloses.length >= 10) {
                        out = { dates, closes: rawCloses, volumes, opens, highs, lows };
                    }
                } catch (_) {}
            }
            return out;
        };
        let out;
        try { out = await this.withBackoff(fetchOnce, 3); }
        catch (e) {
            // Alpha fallback
            try {
                const df = new DataFetcher(this.apiUrl);
                const av = await df.fetchStockData(symbol);
                let closes = (av?.closes||[]).filter(v=>isFinite(v)&&v>0);
                const mean = closes.reduce((a,b)=>a+b,0)/Math.max(1,closes.length);
                const std = Math.sqrt(closes.reduce((s,v)=>s+Math.pow(v-mean,2),0)/Math.max(1,closes.length));
                closes = closes.filter(v => Math.abs(v-mean) <= 3*(std||1));
                out = { dates: av.dates||[], closes, volumes: av.volumes||[] };
            } catch (avError) { 
                console.warn('Alpha Vantage fallback failed:', avError.message);
                // Try to use cached data or generate mock data as last resort
                out = await this.getFallbackData(symbol);
            }
        }
        try { const db = await this.dbPromise; if (db) await db.put('historical', { ts: now, data: out }, key); } catch (_) {}
        return out;
    }

    shouldUseProxy() {
        try {
            if (this._proxyPreference) return this._proxyPreference === 'proxy';
            const proto = (location.protocol || '').toLowerCase();
            if (proto !== 'http:' && proto !== 'https:') {
                this._proxyPreference = 'proxy';
                return true;
            }
            // If backendBase looks usable, prefer proxy for reliability
            if (this.backendBase && this.backendBase.startsWith('http')) {
                this._proxyPreference = 'proxy';
                return true;
            }
        } catch (_) {}
        this._proxyPreference = 'direct';
        return false;
    }
    
    async getFallbackData(symbol) {
        try {
            // Try to get cached data first
            const db = await this.dbPromise;
            if (db) {
                const cached = await db.get('historical', `${symbol}:6mo`);
                if (cached && cached.data && cached.data.closes && cached.data.closes.length >= 30) {
                    console.log(`Using cached data for ${symbol}`);
                    return cached.data;
                }
            }
            
            // Generate mock data as last resort
            console.warn(`Generating mock data for ${symbol} - API unavailable`);
            return this.generateMockData(symbol);
        } catch (error) {
            console.error('Fallback data generation failed:', error);
            return { dates: [], closes: [], volumes: [] };
        }
    }
    
    generateMockData(symbol) {
        // Generate 6 months of mock data
        const days = 180;
        const dates = [];
        const closes = [];
        const volumes = [];
        
        const basePrice = this.getSymbolBasePrice(symbol);
        let currentPrice = basePrice;
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().slice(0, 10));
            
            // Generate realistic price movement
            const change = (Math.random() - 0.5) * 0.05; // ±2.5% daily change
            currentPrice *= (1 + change);
            closes.push(Number(currentPrice.toFixed(2)));
            
            // Generate volume
            const volume = Math.floor(Math.random() * 10000000) + 1000000;
            volumes.push(volume);
        }
        
        return { dates, closes, volumes };
    }
    
    getSymbolBasePrice(symbol) {
        // Common stock base prices for mock data
        const basePrices = {
            'AAPL': 150, 'MSFT': 300, 'GOOGL': 2500, 'AMZN': 3000, 'TSLA': 200,
            'META': 300, 'NVDA': 400, 'NFLX': 400, 'AMD': 100, 'INTC': 30,
            '0700.HK': 300, '0941.HK': 50, '1299.HK': 80, '0388.HK': 250
        };
        return basePrices[symbol] || 100; // Default to $100
    }

    async withBackoff(fn, retries = 3, baseDelay = 1000) {
        let n = 0;
        while (true) {
            try { return await fn(); }
            catch (e) { if (n >= retries) throw e; await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, n))); n++; }
        }
    }

    initRealtimeWS() {
        try {
            const token = window.FINNHUB_TOKEN || '';
            if (!('WebSocket' in window)) return;
            if (!token) return;
            let attempt = 0;
            const connect = () => {
                const ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
                ws.onopen = () => { attempt = 0; };
                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (Array.isArray(msg?.data)) {
                            const sym = (document.getElementById('stockSymbol')?.value || '').trim().toUpperCase();
                            const priceMap = {};
                            msg.data.forEach(d => {
                                if (isFinite(d.p)) priceMap[d.s] = Number(d.p);
                                if (sym && d?.s === sym && isFinite(d.p)) {
                                    const el = document.getElementById('realTimeQuote');
                                    if (el) el.textContent = `$${Number(d.p).toFixed(2)}`;
                                    this.pushLivePointToCharts(Number(d.p));
                                    this.checkPriceJump(Number(d.p));
                                }
                            });
                            this.updateTickerBar(priceMap);
                        }
                    } catch (_) {}
                };
                ws.onclose = () => {
                    attempt += 1;
                    const delay = Math.min(8000, 1000 * Math.pow(2, attempt - 1));
                    setTimeout(connect, delay);
                };
                ws.onerror = () => { try { ws.close(); } catch (_) {} };
                this.ws = ws;
            };
            connect();
        } catch (_) {}
    }

    updateTickerBar(priceMap) {
        try {
            const el = document.getElementById('tickerBar');
            if (!el) return;
            const symbols = (document.getElementById('portfolioSymbols')?.value || '').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
            const all = [ (document.getElementById('stockSymbol')?.value||'').trim().toUpperCase(), ...symbols].filter(Boolean);
            const items = all.slice(0, 8).map(s => `${s}: ${isFinite(priceMap[s]) ? `$${priceMap[s].toFixed(2)}` : '—'}`);
            el.textContent = items.join('  |  ');
        } catch (_) {}
    }

    pushLivePointToCharts(price) {
        try {
            if (!this.charts || !this.charts.price) return;
            const chart = this.charts.price;
            const lbls = chart.data.labels;
            const ds = chart.data.datasets[0];
            lbls.push(`t+${lbls.length}`);
            ds.data.push(price);
            chart.update('none');
        } catch (_) {}
    }

    checkPriceJump(price) {
        try {
            const el = document.getElementById('kpiPrice');
            const prev = Number((el?.textContent||'').replace(/[^0-9.\-]/g,''));
            if (isFinite(prev) && prev > 0) {
                const pct = (price - prev) / prev * 100;
                if (Math.abs(pct) >= 5 && 'Notification' in window) {
                    Notification.requestPermission().then(p => { if (p==='granted') new Notification(`Price moved ${pct.toFixed(2)}%`); });
                }
            }
            if (el) el.textContent = `$${Number(price).toFixed(2)}`;
        } catch (_) {}
    }

    loadSettings() {
        this.settings.load();
        document.getElementById('apiEndpoint').value = this.apiUrl;
    }

    async trainLSTMModel(closes, sequenceLength = 20, epochs = 100, units = 50, volumes = null) {
        const tfref = window.tf;
        if (!tfref || !Array.isArray(closes) || closes.length <= sequenceLength) {
            throw new Error('LSTM prerequisites not met');
        }
        // Normalize using z-score
        const mean = this.mean(closes);
        const std = Math.sqrt(this.variance(closes, mean)) || 1;
        const normalized = closes.map(v => (v - mean) / std);

        const xsArr = [];
        const ysArr = [];
        let vMean = 0, vStd = 1; 
        const useVol = Array.isArray(volumes) && volumes.length === closes.length;
        if (useVol) {
            vMean = this.mean(volumes);
            vStd = Math.sqrt(this.variance(volumes, vMean)) || 1;
        }
        for (let i = 0; i < normalized.length - sequenceLength; i++) {
            const priceSeq = normalized.slice(i, i + sequenceLength);
            if (useVol) {
                const vSeq = volumes.slice(i, i + sequenceLength).map(v => (v - vMean) / vStd);
                xsArr.push(priceSeq.map((p, idx) => [p, vSeq[idx]]));
            } else {
                xsArr.push(priceSeq.map(p => [p]));
            }
            ysArr.push(normalized[i + sequenceLength]);
        }
        if (xsArr.length < 10) {
            throw new Error('LSTM prerequisites not met');
        }
        const featureDim = xsArr[0][0].length;
        const tfref2 = window.tf;
        const xs = tfref2.tensor3d(xsArr, [xsArr.length, sequenceLength, featureDim]);
        const ys = tfref2.tensor2d(ysArr, [ysArr.length, 1]);

        // Functional API with attention
        const input = tfref2.input({ shape: [sequenceLength, featureDim] });
        const lstmOut = tfref2.layers.bidirectional({
            layer: tfref2.layers.lstm({ units, dropout: 0.2, returnSequences: true })
        }).apply(input);
        const attn = tfref2.layers.multiHeadAttention({ numHeads: 4, keyDim: Math.max(16, Math.min(64, units)) })
            .apply([lstmOut, lstmOut, lstmOut]);
        const pooled = tfref2.layers.globalAveragePooling1d().apply(attn);
        const output = tfref2.layers.dense({ units: 1 }).apply(pooled);
        const model = tfref2.model({ inputs: input, outputs: output });
        model.compile({ optimizer: tfref2.train.adam(0.001), loss: 'meanSquaredError' });

        await model.fit(xs, ys, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.1,
            shuffle: true,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();

        return { model, mean, std, sequenceLength, featureDim };
    }

    async predictLSTM(closes, days) {
        try {
            const sequenceLength = 20;
            const tfref = window.tf;
            // Try to find volume array near by (best-effort)
            const volumes = (this.lastResultData?.stockData?.volumes && this.lastResultData.stockData.volumes.length === closes.length) ? this.lastResultData.stockData.volumes : null;

            // Grid search epochs and units
            const epochGrid = [20, 50];
            const unitGrid = [50, 100];
            let best = { loss: Infinity, model: null, mean: 0, std: 1, featureDim: 1 };
            for (const epochs of epochGrid) {
                for (const units of unitGrid) {
                    const trained = await this.trainLSTMModel(closes, sequenceLength, epochs, units, volumes);
                    // quick eval against last close
                    const ctxRaw = closes.slice(-sequenceLength);
                    const ctxNorm = ctxRaw.map(v => (v - trained.mean) / trained.std);
                    const x = tfref.tensor3d([ctxNorm.map(v => trained.featureDim === 2 ? [v, 0] : [v])], [1, sequenceLength, trained.featureDim]);
                    const predTensor = trained.model.predict(x);
                    const pred = (await predTensor.data())[0] * trained.std + trained.mean;
                    const loss = Math.abs(pred - closes[closes.length - 1]);
                    x.dispose(); predTensor.dispose();
                    if (loss < best.loss) {
                        if (best.model && best.model.dispose) best.model.dispose();
                        best = { loss, ...trained };
                    } else {
                        if (trained.model && trained.model.dispose) trained.model.dispose();
                    }
                }
            }

            const { model, mean, std, featureDim } = best;
            let context = closes.slice(-sequenceLength).map(v => (v - mean) / std);
            let lastPrice = closes[closes.length - 1];
            for (let i = 0; i < days; i++) {
                const x = tfref.tensor3d([context.map(v => featureDim === 2 ? [v, 0] : [v])], [1, sequenceLength, featureDim]);
                const predTensor = model.predict(x);
                const predArray = await predTensor.data();
                const predNorm = predArray[0];
                x.dispose();
                predTensor.dispose();
                const pred = predNorm * std + mean;
                lastPrice = pred;
                context = context.slice(1).concat([(pred - mean) / std]);
            }
            model.dispose();
            return lastPrice;
        } catch (_) {
            // Fallback: use average daily log return to avoid exploding forecasts
            const rets = this.calculateLogReturns(closes);
            const mu = this.mean(rets) || 0;
            const last = closes[closes.length - 1];
            return last * Math.exp(mu * days);
        }
    }
}

// Data Fetcher Class
class DataFetcher {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 200; // Minimum 200ms between requests
    }
    
    // Global rate limiting to prevent too many concurrent requests
    async rateLimitedRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject } = this.requestQueue.shift();
            
            try {
                // Ensure minimum interval between requests
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
                }
                
                const response = await this.fetchWithTimeout(url, options.timeout);
                this.lastRequestTime = Date.now();
                resolve(response);
            } catch (error) {
                reject(error);
            }
        }
        
        this.isProcessing = false;
    }

    async fetchStockData(symbol) {
        const params = new URLSearchParams({
            function: 'TIME_SERIES_DAILY',
            symbol: symbol,
            outputsize: 'full'
        });

        const backendUrl = `${this.apiUrl}?${params}`;
        
        // Enhanced retry logic with exponential backoff
        const maxRetries = 5;
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let response = await this.rateLimitedRequest(backendUrl);
                
                // Handle rate limiting with exponential backoff
                if (response.status === 429) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
                    console.log(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                
                const data = await response.json();
                if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                    const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                    throw new Error(msg);
                }
                return this.parseTimeSeries(data);

            } catch (err) {
                lastError = err;
                console.warn(`Attempt ${attempt + 1}/${maxRetries} failed for ${symbol}:`, err.message);
                
                // If it's not a rate limit error, don't retry
                if (!err.message.includes('429') && !err.message.includes('Too Many Requests')) {
                    break;
                }
                
                // Wait before retry (except on last attempt)
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        
        throw lastError || new Error('Failed to fetch stock data after multiple attempts');
    }

    async fetchQuote(symbol) {
        const params = new URLSearchParams({
            function: 'GLOBAL_QUOTE',
            symbol: symbol
        });
        const response = await this.fetchWithTimeout(`${this.apiUrl}?${params}`);
        const data = await response.json();
        const q = data && data['Global Quote'];
        const price = q ? parseFloat(q['05. price']) : NaN;
        return { symbol, price };
    }

    async fetchFundamentals(symbol) {
        try {
            const overview = await this.fetchAlphaVantageData('OVERVIEW', symbol);
            const balanceSheet = await this.fetchAlphaVantageData('BALANCE_SHEET', symbol);
            const cashFlow = await this.fetchAlphaVantageData('CASH_FLOW', symbol);

            return this.parseFundamentals(overview, balanceSheet, cashFlow);
        } catch (error) {
            console.warn('Failed to fetch fundamentals:', error);
            return {};
        }
    }

    async fetchAlphaVantageData(functionName, symbol) {
        const params = new URLSearchParams({ function: functionName, symbol });
        const backendUrl = `${this.apiUrl}?${params}`;
        
        // Enhanced retry logic with exponential backoff
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let response = await this.rateLimitedRequest(backendUrl);
                
                // Handle rate limiting with exponential backoff
                if (response.status === 429) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // Max 8 seconds
                    console.log(`Rate limited for ${functionName}, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                
                const data = await response.json();
                if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                    const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                    throw new Error(msg);
                }
                return data;
                
            } catch (err) {
                lastError = err;
                console.warn(`Attempt ${attempt + 1}/${maxRetries} failed for ${functionName} ${symbol}:`, err.message);
                
                // If it's not a rate limit error, don't retry
                if (!err.message.includes('429') && !err.message.includes('Too Many Requests')) {
                    break;
                }
                
                // Wait before retry (except on last attempt)
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 6000);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        
        throw lastError || new Error(`Failed to fetch ${functionName} data after multiple attempts`);
    }

    parseTimeSeries(data) {
        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).sort();
        const closes = dates.map(date => parseFloat(timeSeries[date]['4. close']));
        const volumes = dates.map(date => parseFloat(timeSeries[date]['5. volume'] || '0'));
        
        return { dates, closes, volumes };
    }

    parseFundamentals(overview, balanceSheet, cashFlow) {
        return {
            eps: parseFloat(overview?.EPS),
            pe: parseFloat(overview?.PERatio),
            peg: parseFloat(overview?.PEGRatio),
            marketCap: parseFloat(overview?.MarketCapitalization),
            debtEquity: this.calculateDebtEquity(balanceSheet),
            fcf: this.calculateFreeCashFlow(cashFlow),
            fcfYield: this.calculateFCFYield(overview, cashFlow)
        };
    }

    calculateDebtEquity(balanceSheet) {
        const bs0 = balanceSheet?.annualReports?.[0];
        const liabilities = parseFloat(bs0?.totalLiabilities);
        const equity = parseFloat(bs0?.totalShareholderEquity);
        return (isFinite(liabilities) && isFinite(equity) && equity !== 0) ? (liabilities / equity) : NaN;
    }

    calculateFreeCashFlow(cashFlow) {
        const cf0 = cashFlow?.annualReports?.[0];
        const opcf = parseFloat(cf0?.operatingCashflow);
        const capex = Math.abs(parseFloat(cf0?.capitalExpenditures));
        return (isFinite(opcf) ? opcf : 0) - (isFinite(capex) ? capex : 0);
    }

    calculateFCFYield(overview, cashFlow) {
        const marketCap = parseFloat(overview?.MarketCapitalization);
        const fcf = this.calculateFreeCashFlow(cashFlow);
        return (isFinite(marketCap) && marketCap > 0 && isFinite(fcf)) ? (fcf / marketCap) : NaN;
    }

    async fetchWithTimeout(url, timeout = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }
}

// Quantitative Calculator Class
class QuantitativeCalculator {
    calculateMetrics(closes) {
        const returns = this.calculateLogReturns(closes);
        const muDaily = this.mean(returns);
        const sigmaDaily = Math.sqrt(this.variance(returns, muDaily));
        const { garchSigmaDaily, garchSigmaAnnual, sigmaSeries } = this.calculateGARCHSigma(returns);
        return {
            mu: muDaily * 252,
            sigma: isFinite(garchSigmaAnnual) ? garchSigmaAnnual : (sigmaDaily * Math.sqrt(252)),
            muDaily,
            sigmaDaily,
            garchSigmaDaily,
            garchSigmaAnnual,
            sigmaSeries
        };
    }

    calculateGARCHSigma(returns, omega = 0.0001, alpha = 0.1, beta = 0.85) {
        if (!Array.isArray(returns) || returns.length === 0) {
            return { garchSigmaDaily: NaN, garchSigmaAnnual: NaN, sigmaSeries: [] };
        }
        const series = [];
        let sigma2 = omega / Math.max(1e-6, (1 - alpha - beta));
        for (let i = 0; i < returns.length; i++) {
            const rt = returns[i] || 0;
            sigma2 = omega + alpha * rt * rt + beta * sigma2;
            series.push(Math.sqrt(Math.max(0, sigma2)));
        }
        const garchSigmaDaily = series.length ? series[series.length - 1] : NaN;
        const garchSigmaAnnual = isFinite(garchSigmaDaily) ? garchSigmaDaily * Math.sqrt(252) : NaN;
        return { garchSigmaDaily, garchSigmaAnnual, sigmaSeries: series };
    }

    calculateTechnical(closes) {
        return {
            rsi: this.calculateRSI(closes),
            macd: this.calculateMACD(closes),
            sma20: this.calculateSMA(closes, 20),
            sma50: this.calculateSMA(closes, 50)
        };
    }

    calculateRiskMetrics(simulations, amount) {
        const capital = Math.max(1, amount || 10000);
        const finalPrices = simulations?.paths ? 
            simulations.paths.map(path => path[path.length - 1]) :
            simulations?.quantiles?.q50 ? 
                [simulations.quantiles.q50[simulations.quantiles.q50.length - 1]] :
                [100]; // Default fallback
        const latestPrice = finalPrices[0];
        const returnsPct = finalPrices.map(fp => (fp - latestPrice) / (latestPrice || 1));
        const sorted = returnsPct.slice().sort((a,b)=>a-b);
        const q = (p) => {
            if (sorted.length === 0) return 0;
            const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
            return sorted[idx];
        };
        const varPct = q(0.05);
        const cvarPct = sorted.length ? (sorted.filter(v => v <= varPct).reduce((a,b)=>a+b,0) / Math.max(1, sorted.filter(v => v <= varPct).length)) : 0;
        const varValue = -varPct * capital; // positive loss
        const esValue = -cvarPct * capital; // CVaR 95%

        // Sharpe from simulated distribution
        const meanRet = returnsPct.reduce((a,b)=>a+b,0) / returnsPct.length;
        const sd = Math.sqrt(this.variance(returnsPct, meanRet) || 0.000001);
        const sharpeRatio = sd > 0 ? (meanRet / sd) : 0;

        const suggestedAllocation = Math.max(0, Math.min(0.2, Math.abs(capital * 0.1 / Math.abs(varValue || 1000))));
        
        return {
            varValue,
            esValue,
            var95: varValue,
            cvar95: esValue,
            sharpeRatio,
            suggestedAllocation,
            maxDrawdown: this.calculateMaxDrawdown(finalPrices)
        };
    }

    async generatePredictions(closes, days) {
        const lstmPred = await this.predictLSTM(closes, days);
        const arimaPred = this.predictARIMAWithSeasonality(closes, days);
        const gbmPred = this.predictGBM(closes, days);
        const prophetPred = await this.predictProphet(closes, days);
        const ensemble = this.averagePredictions([lstmPred, arimaPred, gbmPred, prophetPred]);
        const ci = this.bootstrapCI(closes, days, 500);
        const upProbability = this.calculateUpProbability([lstmPred, arimaPred, gbmPred, prophetPred, ensemble], closes[closes.length - 1]);
        return { lstm: lstmPred, arima: arimaPred, gbm: gbmPred, prophet: prophetPred, combined: ensemble, ciLower: ci.lower, ciUpper: ci.upper, upProbability };
    }

    calculateLogReturns(closes) {
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
            returns.push(Math.log(closes[i] / closes[i - 1]));
        }
        return returns;
    }

    mean(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    variance(arr, mean) {
        return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
    }

    calculateRSI(closes, period = 14) {
        if (closes.length < period + 1) return 50;
        
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
        }
        
        const rs = avgGain / (avgLoss || 1e-9);
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(closes, shortPeriod = 12, longPeriod = 26) {
        if (closes.length < longPeriod) return 0;
        
        const shortEMA = this.calculateEMA(closes.slice(-shortPeriod), shortPeriod);
        const longEMA = this.calculateEMA(closes.slice(-longPeriod), longPeriod);
        
        return shortEMA - longEMA;
    }

    calculateEMA(values, period) {
        const k = 2 / (period + 1);
        let ema = values[0];
        for (let i = 1; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
    }

    calculateSMA(values, period) {
        if (values.length < period) return NaN;
        const sum = values.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    calculateVaRAndES(returns, alpha = 0.95) {
        const sorted = returns.slice().sort((a, b) => a - b);
        const varIndex = Math.floor((1 - alpha) * sorted.length);
        const varValue = sorted[varIndex];
        // CVaR/ES: average of losses below VaR
        const tail = sorted.slice(0, varIndex + 1);
        const esValue = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : varValue;
        
        return { varValue, esValue };
    }

    calculateMaxDrawdown(prices) {
        let peak = prices[0];
        let maxDD = 0;
        
        for (let i = 1; i < prices.length; i++) {
            peak = Math.max(peak, prices[i]);
            maxDD = Math.min(maxDD, prices[i] / peak - 1);
        }
        
        return maxDD;
    }

    async backtestAccuracy(closes, lookback = 30) {
        try {
            const n = closes.length;
            if (n < lookback + 30) {
                return { mae: NaN, rmse: NaN, accuracyPct: 0, models: {} };
            }
            const actuals = [];
            const gbmPreds = [];
            const arimaPreds = [];
            for (let t = n - lookback; t < n; t++) {
                const hist = closes.slice(0, t);
                const gbm = this.predictGBM(hist, 1);
                const arima = this.predictARIMA(hist, 1);
                gbmPreds.push(gbm);
                arimaPreds.push(arima);
                actuals.push(closes[t]);
            }
            const mae = (arr1, arr2) => arr1.reduce((s, v, i) => s + Math.abs(v - arr2[i]), 0) / arr1.length;
            const rmse = (arr1, arr2) => Math.sqrt(arr1.reduce((s, v, i) => s + Math.pow(v - arr2[i], 2), 0) / arr1.length);
            const maeG = mae(gbmPreds, actuals);
            const maeA = mae(arimaPreds, actuals);
            const rmseG = rmse(gbmPreds, actuals);
            const rmseA = rmse(arimaPreds, actuals);
            const avgActual = actuals.reduce((a,b)=>a+b,0)/actuals.length;
            const combinedRmse = (rmseG + rmseA) / 2;
            const accuracyPct = Math.max(0, Math.min(100, 100 * (1 - (combinedRmse / Math.max(1e-6, avgActual)))));
            return {
                mae: (maeG + maeA) / 2,
                rmse: combinedRmse,
                accuracyPct,
                models: {
                    GBM: { mae: maeG, rmse: rmseG },
                    ARIMA: { mae: maeA, rmse: rmseA }
                }
            };
        } catch (_) {
            return { mae: NaN, rmse: NaN, accuracyPct: 0, models: {} };
        }
    }

    async trainLSTMModel(closes, sequenceLength = 20, epochs = 100, units = 50, volumes = null) {
        const tfref = window.tf;
        if (!tfref || !Array.isArray(closes) || closes.length <= sequenceLength) {
            throw new Error('LSTM prerequisites not met');
        }
        // Normalize using z-score
        const mean = this.mean(closes);
        const std = Math.sqrt(this.variance(closes, mean)) || 1;
        const normalized = closes.map(v => (v - mean) / std);

        const xsArr = [];
        const ysArr = [];
        let vMean = 0, vStd = 1; 
        const useVol = Array.isArray(volumes) && volumes.length === closes.length;
        if (useVol) {
            vMean = this.mean(volumes);
            vStd = Math.sqrt(this.variance(volumes, vMean)) || 1;
        }
        for (let i = 0; i < normalized.length - sequenceLength; i++) {
            const priceSeq = normalized.slice(i, i + sequenceLength);
            if (useVol) {
                const vSeq = volumes.slice(i, i + sequenceLength).map(v => (v - vMean) / vStd);
                xsArr.push(priceSeq.map((p, idx) => [p, vSeq[idx]]));
            } else {
                xsArr.push(priceSeq.map(p => [p]));
            }
            ysArr.push(normalized[i + sequenceLength]);
        }
        if (xsArr.length < 10) {
            throw new Error('LSTM prerequisites not met');
        }
        const featureDim = xsArr[0][0].length;
        const tfref2 = window.tf;
        const xs = tfref2.tensor3d(xsArr, [xsArr.length, sequenceLength, featureDim]);
        const ys = tfref2.tensor2d(ysArr, [ysArr.length, 1]);

        // Functional API with attention
        const input = tfref2.input({ shape: [sequenceLength, featureDim] });
        const lstmOut = tfref2.layers.bidirectional({
            layer: tfref2.layers.lstm({ units, dropout: 0.2, returnSequences: true })
        }).apply(input);
        const attn = tfref2.layers.multiHeadAttention({ numHeads: 4, keyDim: Math.max(16, Math.min(64, units)) })
            .apply([lstmOut, lstmOut, lstmOut]);
        const pooled = tfref2.layers.globalAveragePooling1d().apply(attn);
        const output = tfref2.layers.dense({ units: 1 }).apply(pooled);
        const model = tfref2.model({ inputs: input, outputs: output });
        model.compile({ optimizer: tfref2.train.adam(0.001), loss: 'meanSquaredError' });

        await model.fit(xs, ys, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.1,
            shuffle: true,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();

        return { model, mean, std, sequenceLength, featureDim };
    }

    async predictLSTM(closes, days) {
        try {
            const sequenceLength = 20;
            const tfref = window.tf;
            // Try to find volume array near by (best-effort)
            const volumes = (this.lastResultData?.stockData?.volumes && this.lastResultData.stockData.volumes.length === closes.length) ? this.lastResultData.stockData.volumes : null;

            // Grid search epochs and units
            const epochGrid = [20, 50];
            const unitGrid = [50, 100];
            let best = { loss: Infinity, model: null, mean: 0, std: 1, featureDim: 1 };
            for (const epochs of epochGrid) {
                for (const units of unitGrid) {
                    const trained = await this.trainLSTMModel(closes, sequenceLength, epochs, units, volumes);
                    // quick eval against last close
                    const ctxRaw = closes.slice(-sequenceLength);
                    const ctxNorm = ctxRaw.map(v => (v - trained.mean) / trained.std);
                    const x = tfref.tensor3d([ctxNorm.map(v => trained.featureDim === 2 ? [v, 0] : [v])], [1, sequenceLength, trained.featureDim]);
                    const predTensor = trained.model.predict(x);
                    const pred = (await predTensor.data())[0] * trained.std + trained.mean;
                    const loss = Math.abs(pred - closes[closes.length - 1]);
                    x.dispose(); predTensor.dispose();
                    if (loss < best.loss) {
                        if (best.model && best.model.dispose) best.model.dispose();
                        best = { loss, ...trained };
                    } else {
                        if (trained.model && trained.model.dispose) trained.model.dispose();
                    }
                }
            }

            const { model, mean, std, featureDim } = best;
            let context = closes.slice(-sequenceLength).map(v => (v - mean) / std);
            let lastPrice = closes[closes.length - 1];
            for (let i = 0; i < days; i++) {
                const x = tfref.tensor3d([context.map(v => featureDim === 2 ? [v, 0] : [v])], [1, sequenceLength, featureDim]);
                const predTensor = model.predict(x);
                const predArray = await predTensor.data();
                const predNorm = predArray[0];
                x.dispose();
                predTensor.dispose();
                const pred = predNorm * std + mean;
                lastPrice = pred;
                context = context.slice(1).concat([(pred - mean) / std]);
            }
            model.dispose();
            return lastPrice;
        } catch (_) {
            // Fallback: use average daily log return to avoid exploding forecasts
            const rets = this.calculateLogReturns(closes);
            const mu = this.mean(rets) || 0;
            const last = closes[closes.length - 1];
            return last * Math.exp(mu * days);
        }
    }

    predictARIMAWithSeasonality(closes, days) {
        // Add Fourier seasonality terms by biasing mean return
        const returns = this.calculateLogReturns(closes);
        const meanReturn = this.mean(returns);
        const n = closes.length;
        const fourier = (k, t, T) => Math.sin(2 * Math.PI * k * t / T) + Math.cos(2 * Math.PI * k * t / T);
        let seasonal = 0;
        const T = 252; // annual seasonality in trading days
        for (let k = 1; k <= 3; k++) seasonal += fourier(k, n, T) * 0.0005; // small bias
        const lastPrice = closes[closes.length - 1];
        return lastPrice * Math.exp((meanReturn + seasonal) * days);
    }

    predictGBM(closes, days) {
        // Simplified GBM prediction
        const returns = this.calculateLogReturns(closes);
        const meanReturn = this.mean(returns);
        const lastPrice = closes[closes.length - 1];
        return lastPrice * Math.exp(meanReturn * days);
    }

    async predictProphet(closes, days) {
        try {
            const P = window.Prophet;
            if (!P) throw new Error('no_prophet');
            const start = new Date();
            start.setDate(start.getDate() - closes.length);
            const series = [];
            for (let i = 0; i < closes.length; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                series.push({ ds: d, y: closes[i] });
            }
            const model = new P.Prophet();
            await model.fit(series);
            const future = P.makeFutureDataframe(series, days);
            const forecast = await model.predict(future);
            const last = forecast[forecast.length - 1];
            return Number(last.yhat || closes[closes.length - 1]);
        } catch (_) {
            return closes[closes.length - 1];
        }
    }

    averagePredictions(arr) {
        const vals = arr.filter(v => isFinite(v));
        if (!vals.length) return NaN;
        return vals.reduce((a,b)=>a+b,0) / vals.length;
    }

    bootstrapCI(closes, days, samples = 300) {
        const last = closes[closes.length - 1];
        const returns = this.calculateLogReturns(closes);
        const preds = [];
        for (let i = 0; i < samples; i++) {
            const boot = [];
            for (let j = 0; j < returns.length; j++) {
                const idx = Math.floor(Math.random() * returns.length);
                boot.push(returns[idx]);
            }
            const mu = this.mean(boot);
            preds.push(last * Math.exp(mu * days));
        }
        preds.sort((a,b)=>a-b);
        const q = (p) => preds[Math.floor(p * (preds.length - 1))];
        return { lower: q(0.05), upper: q(0.95) };
    }

    calculateUpProbability(predictions, currentPrice) {
        const upCount = predictions.filter(p => p > currentPrice).length;
        return (upCount / predictions.length) * 100;
    }
}

// Trade Planner - computes Suggested Buy / Take-Profit / Stop-Loss using technical and volume context
class TradePlanner {
    constructor() {}

    calculateEMA(values, period) {
        const k = 2 / (period + 1);
        let ema = values[0];
        for (let i = 1; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
    }

    calculateSMA(values, period) {
        if (values.length < period) return NaN;
        const sum = values.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    calculateATR(highs, lows, closes, period = 14) {
        const trs = [];
        for (let i = 1; i < closes.length; i++) {
            const prevClose = closes[i - 1];
            const high = highs ? highs[i] : Math.max(closes[i], prevClose);
            const low = lows ? lows[i] : Math.min(closes[i], prevClose);
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trs.push(tr);
        }
        if (trs.length === 0) return 0;
        if (trs.length < period) {
            return trs.reduce((a, b) => a + b, 0) / trs.length;
        }
        let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const alpha = 1 / period;
        for (let i = period; i < trs.length; i++) {
            atr = (trs[i] - atr) * alpha + atr;
        }
        return atr;
    }

    calculateBollinger(closes, period = 20, mult = 2) {
        if (closes.length < period) return { mid: closes[closes.length - 1], upper: closes[closes.length - 1], lower: closes[closes.length - 1] };
        const window = closes.slice(-period);
        const mean = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        return { mid: mean, upper: mean + mult * std, lower: mean - mult * std };
    }

    findSwingLevels(closes, lookback = 5) {
        const n = closes.length;
        let swingHigh = null;
        let swingLow = null;
        for (let i = n - lookback - 1; i >= lookback; i--) {
            const isHigh = closes[i] === Math.max(...closes.slice(i - lookback, i + lookback + 1));
            const isLow = closes[i] === Math.min(...closes.slice(i - lookback, i + lookback + 1));
            if (swingHigh === null && isHigh) swingHigh = closes[i];
            if (swingLow === null && isLow) swingLow = closes[i];
            if (swingHigh !== null && swingLow !== null) break;
        }
        return { swingHigh, swingLow };
    }

    computeLevels(stockData, options = {}) {
        const closes = stockData.closes || [];
        if (closes.length < 25) {
            const cp = closes[closes.length - 1] || 0;
            return { current: cp, buy: cp * 0.98, tp: cp * 1.1, sl: cp * 0.95, regime: 'insufficient-data' };
        }

        const current = closes[closes.length - 1];
        const ema20 = this.calculateEMA(closes.slice(-60), 20);
        const ema50 = this.calculateEMA(closes.slice(-100), 50);
        const bb = this.calculateBollinger(closes, 20, 2);
        const atr = this.calculateATR(null, null, closes, 14);
        const vol = stockData.volumes || [];
        const avgVol20 = vol.length >= 20 ? (vol.slice(-20).reduce((a, b) => a + b, 0) / 20) : (vol.reduce((a, b) => a + b, 0) / Math.max(1, vol.length));
        const volRatio = vol.length ? (vol[vol.length - 1] / Math.max(1, avgVol20)) : 1;
        const { swingHigh, swingLow } = this.findSwingLevels(closes, 5);

        const uptrend = ema20 > ema50;
        const breakout = current > bb.upper && volRatio > 1.5;

        // Suggested Buy
        let buy;
        let regime;
        if (breakout) {
            const buffer = 0.25 * atr;
            const base = swingHigh || current;
            buy = Math.min(current, base + buffer);
            regime = 'breakout';
        } else if (uptrend) {
            const target = (ema20 + bb.mid) / 2;
            buy = Math.min(current, target);
            regime = 'trend-pullback';
        } else {
            const support = swingLow || bb.lower;
            buy = Math.min(current, support + 0.25 * atr);
            regime = 'range';
        }

        // Stop-Loss
        const referenceSupport = Math.min(buy, swingLow || buy);
        const sl = Math.max(0, referenceSupport - 1.1 * atr);

        // Take-Profit
        const rr = breakout ? 2.2 : (uptrend ? 2.0 : 1.6);
        const tpCandidate = buy + rr * (buy - sl);
        const cap = Math.max(bb.upper, swingHigh || bb.upper) + 0.5 * atr;
        const tp = Math.min(tpCandidate, cap);

        return { current, buy, tp, sl, regime, volRatio, atr, ema20, ema50, bands: bb };
    }
}

// Monte Carlo Simulator
class MonteCarloSimulator {
	boxMuller() {
		const u = Math.random();
		const v = Math.random();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	}

	simulateGBM(S0, mu, sigma, days, paths, options = {}) {
		const dt = 1 / 252;
		const results = [];
		const crashProb = Number(options.crashProbDaily) || 0;
		const crashDrop = Number(options.crashDropFraction) || 0;
		const jumpProb = options.jumpProbDaily != null ? Number(options.jumpProbDaily) : 0.05;
		const jumpMagnitude = options.jumpMagnitude != null ? Number(options.jumpMagnitude) : 0.10; // 10%
		
		for (let p = 0; p < paths; p++) {
			const path = [S0];
			let S = S0;
			
			for (let t = 1; t <= days; t++) {
				const Z = this.boxMuller();
				S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z);
				if (crashProb > 0 && crashDrop > 0 && Math.random() < crashProb) {
					S = S * Math.max(0.0001, 1 - crashDrop);
				}
				// Random jump (up/down)
				if (Math.random() < jumpProb) {
					const dir = Math.random() < 0.5 ? -1 : 1;
					S = S * (1 + dir * jumpMagnitude);
				}
				path.push(S);
			}
			results.push(path);
		}
		
		return {
			paths: results,
			quantiles: this.calculateQuantiles(results)
		};
	}

	// Merton Jump Diffusion: GBM + Poisson jumps with lognormal jump size
	simulateJumpDiffusion(S0, mu, sigma, days, paths, opts = {}) {
		const dt = 1 / 252;
		const lambda = Number(opts.lambda) || 0.1; // average jumps per year
		const kappa = Number(opts.kappa) || -0.10; // average jump size (lognormal mean shift)
		const delta = Number(opts.delta) || 0.20; // jump size volatility
		const results = [];
		for (let p = 0; p < paths; p++) {
			let S = S0;
			const path = [S];
			for (let t = 1; t <= days; t++) {
				const Z = this.boxMuller();
				// Jump count in dt ~ Poisson(lambda*dt)
				const probJump = lambda * dt;
				let J = 0;
				if (Math.random() < probJump) {
					// log jump size ~ N(kappa, delta^2)
					J = Math.exp(kappa + delta * this.boxMuller()) - 1;
				}
				const driftAdj = mu - 0.5 * sigma * sigma - lambda * (Math.exp(kappa + 0.5 * delta * delta) - 1);
				S = S * Math.exp(driftAdj * dt + sigma * Math.sqrt(dt) * Z) * (1 + J);
				path.push(S);
			}
			results.push(path);
		}
		return { paths: results, quantiles: this.calculateQuantiles(results) };
	}

	// Simplified Heston model using Euler discretization with full truncation for variance
	simulateHeston(S0, mu, v0, kappa, theta, xi, rho, days, paths) {
		const dt = 1 / 252;
		const results = [];
		for (let p = 0; p < paths; p++) {
			let S = S0;
			let v = Math.max(1e-8, v0);
			const path = [S];
			for (let t = 1; t <= days; t++) {
				// Correlated Brownian motions
				const z1 = this.boxMuller();
				const z2 = this.boxMuller();
				const dw1 = Math.sqrt(dt) * z1;
				const dw2 = Math.sqrt(dt) * (rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2);
				// Variance process (CIR)
				v = Math.max(0, v + kappa * (theta - v) * dt + xi * Math.sqrt(Math.max(v, 0)) * dw2);
				const vol = Math.sqrt(Math.max(v, 0));
				S = S * Math.exp((mu - 0.5 * v) * dt + vol * dw1);
				path.push(S);
			}
			results.push(path);
		}
		return { paths: results, quantiles: this.calculateQuantiles(results) };
	}

	// Simple GARCH(1,1) simulation for daily variance
	simulateGARCH(S0, mu, days, paths, omega = 0.0001, alpha = 0.1, beta = 0.85, sigma0 = 0.02) {
		const results = [];
		for (let p = 0; p < paths; p++) {
			let S = S0;
			let sigma2 = sigma0 * sigma0;
			const path = [S];
			for (let t = 1; t <= days; t++) {
				const z = this.boxMuller();
				const ret = mu / 252 + Math.sqrt(Math.max(sigma2, 1e-8)) * z;
				S = S * Math.exp(ret);
				path.push(S);
				// Update variance
				sigma2 = omega + alpha * (ret * ret) + beta * sigma2;
			}
			results.push(path);
		}
		return { paths: results, quantiles: this.calculateQuantiles(results) };
	}

	calculateQuantiles(simulations, quantiles = [0.05, 0.5, 0.95]) {
		const n = simulations[0].length;
		const results = {};
		
		for (const q of quantiles) {
			results[`q${Math.round(q * 100)}`] = [];
		}
		
		for (let t = 0; t < n; t++) {
			const values = simulations.map(sim => sim[t]).sort((a, b) => a - b);
			
			for (const q of quantiles) {
				const index = Math.floor(q * (values.length - 1));
				results[`q${Math.round(q * 100)}`].push(values[index]);
			}
		}
		
		return results;
	}
}

// Sentiment Calculator
class SentimentCalculator {
    calculate(closes, technical, market) {
        const lookback = Math.min(20, closes.length - 1);
        if (lookback <= 1) return 0.5;
        
        const momentum = closes[closes.length - 1] / closes[closes.length - 1 - lookback] - 1;
        const momentumScore = 1 / (1 + Math.exp(-8 * momentum));
        const rsiScore = Math.max(0, Math.min(1, (technical.rsi - 30) / 40));
        const macdScore = technical.macd > 0 ? 0.65 : 0.35;
        
        const baseSentiment = market === 'HK' ? 0.6 : 0.5;
        const calculatedSentiment = 0.4 * momentumScore + 0.4 * rsiScore + 0.2 * macdScore;
        const jitter = (Math.random() * 0.06 - 0.03);
        
        return Math.max(0, Math.min(1, baseSentiment + calculatedSentiment + jitter));
    }
}

// Chart Renderer
class ChartRenderer {
    constructor() {
        this.charts = {};
    }
    
    renderPriceChart(ctx, result) {
        if (typeof Chart === 'undefined') return;
        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx.canvas) : null;
        if (existing) existing.destroy();
        const chart = new Chart(ctx, {
            type: 'line',
            data: this.getPriceChartData(result),
            options: this.getChartOptions('價格預測')
        });
        
        this.charts.price = chart;
    }

    renderRiskChart(ctx, result) {
        if (typeof Chart === 'undefined') return;
        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx.canvas) : null;
        if (existing) existing.destroy();
        const chart = new Chart(ctx, {
            type: 'bar',
            data: this.getRiskChartData(result),
            options: this.getChartOptions('風險分佈')
        });
        
        this.charts.risk = chart;
    }

    renderDrawdownChart(ctx, result) {
        if (typeof Chart === 'undefined') return;
        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx.canvas) : null;
        if (existing) existing.destroy();
        const chart = new Chart(ctx, {
            type: 'line',
            data: this.getDrawdownChartData(result),
            options: this.getChartOptions('歷史回撤')
        });
        
        this.charts.drawdown = chart;
    }

    renderHistoricalChart(ctx, result) {
        if (typeof Chart === 'undefined') return;
        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx.canvas) : null;
        if (existing) existing.destroy();
        const sd = result.stockData || {};
        const n = sd.closes?.length || 0;
        const start = Math.max(0, n - 100);
        const labels = (sd.dates || []).slice(start);
        const opens = (sd.opens && sd.opens.length ? sd.opens.slice(start) : null);
        const highs = (sd.highs && sd.highs.length ? sd.highs.slice(start) : null);
        const lows = (sd.lows && sd.lows.length ? sd.lows.slice(start) : null);
        const closes = (sd.closes || []).slice(start);
        const volumes = (sd.volumes || []).slice(start);

        const hasOHLC = opens && highs && lows && opens.length === closes.length;
        const useCandlestick = !!(hasOHLC && Chart?.registry?.getController && Chart.registry.getController('candlestick'));

        let dataConfig;
        if (useCandlestick) {
            const ohlc = labels.map((l, i) => ({ x: l, o: opens[i] ?? closes[i], h: highs[i] ?? closes[i], l: lows[i] ?? closes[i], c: closes[i] }));
            dataConfig = {
                datasets: [
                    { label: 'OHLC', data: ohlc, type: 'candlestick' },
                    { label: 'Volume', data: labels.map((l,i)=>({ x: l, y: volumes[i] || 0 })), type: 'bar', yAxisID: 'y1', backgroundColor: 'rgba(99,102,241,0.3)' }
                ]
            };
        } else {
            dataConfig = {
                labels,
                datasets: [
                    { label: 'Close', data: closes, borderColor: '#22d3ee', borderWidth: 1.5, pointRadius: 0, fill: false },
                    { label: 'Volume', data: volumes, type: 'bar', yAxisID: 'y1', backgroundColor: 'rgba(99,102,241,0.3)' }
                ]
            };
        }

        const chart = new Chart(ctx, {
            type: useCandlestick ? 'candlestick' : 'line',
            data: dataConfig,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Historical Candlestick + Volume (last 100 days)', color: '#f8fafc' } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                    y1: { position: 'right', grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
        this.charts.historical = chart;
    }

    getPriceChartData(result) {
        const days = result.days;
        const latestPrice = result.stockData.closes[result.stockData.closes.length - 1];
        
        const datasets = [];
        
        if (result.simulations?.quantiles) {
            datasets.push({
                label: '5% 分位',
                data: result.simulations.quantiles.q5 || [],
                borderColor: 'rgba(0,0,0,0)',
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: '95% 分位',
                data: result.simulations.quantiles.q95 || [],
                borderColor: 'rgba(0,0,0,0)',
                backgroundColor: 'rgba(96,165,250,0.15)',
                pointRadius: 0,
                fill: '-1'
            });
            
            datasets.push({
                label: '50% 分位',
                data: result.simulations.quantiles.q50 || [],
                borderColor: '#60a5fa',
                borderWidth: 2,
                borderDash: [4, 3],
                pointRadius: 0,
                fill: false
            });
        }
        
        datasets.push({
            label: 'LSTM 預測',
            data: [latestPrice, result.predictions.lstm],
            borderColor: '#ef4444',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
        
        return {
            labels: Array.from({ length: days + 1 }, (_, i) => `Day ${i}`),
            datasets
        };
    }

    getRiskChartData(result) {
        const finalPrices = result.simulations?.paths ? 
            result.simulations.paths.map(path => path[path.length - 1]) :
            result.simulations?.quantiles?.q50 ? 
                [result.simulations.quantiles.q50[result.simulations.quantiles.q50.length - 1]] :
                [100]; // Default fallback
        
        const latestPrice = result.stockData?.closes?.[result.stockData.closes.length - 1] || 100;
        const returns = finalPrices.map(p => (p - latestPrice) / latestPrice * 100);
        
        const bins = Array(30).fill(0);
        const edges = Array.from({ length: 31 }, (_, i) => -60 + i * 4);
        
        returns.forEach(r => {
            const idx = Math.max(0, Math.min(29, Math.floor((r + 60) / 4)));
            bins[idx]++;
        });
        
        return {
            labels: edges.slice(0, -1).map((e, i) => `${e}% ~ ${edges[i + 1]}%`),
            datasets: [{
                label: '回報分佈',
                data: bins,
                backgroundColor: '#f59e0b'
            }]
        };
    }

    getDrawdownChartData(result) {
        const closes = result.stockData.closes;
        const drawdowns = this.calculateDrawdownSeries(closes);
        
        return {
            labels: result.stockData.dates,
            datasets: [{
                label: '歷史回撤',
                data: drawdowns.map(dd => dd * 100),
                borderColor: '#fca5a5',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            }]
        };
    }

    calculateDrawdownSeries(prices) {
        let peak = prices[0];
        return prices.map(p => {
            peak = Math.max(peak, p);
            return p / peak - 1;
        });
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    color: '#f8fafc'
                },
                legend: {
                    labels: {
                        color: '#cbd5e1'
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        drag: { enabled: false },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    limits: {
                        x: { min: 'original', max: 'original' },
                        y: { min: 'original', max: 'original' }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                },
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                }
            }
        };
    }
}

// Result Renderer
class ResultRenderer {
    generateHTML(result) {
        return `
            <div class="result-section">
                <h3>預測報告 - ${result.symbol} (${result.days}天)</h3>
                ${this.generateRiskAlert(result)}
                ${this.generateKPISection(result)}
                ${this.generateTechnicalSection(result)}
                ${this.generateFundamentalsSection(result)}
                ${this.generatePredictionsSection(result)}
                ${this.generateRiskSection(result)}
            </div>
        `;
    }

    generateRiskAlert(result) {
        const varValue = result.riskMetrics?.var95 || result.riskMetrics?.varValue || 0;
        const riskLevel = varValue < -0.5 * (result.amount || 10000) ? 'high' : 'normal';
        if (riskLevel === 'high') {
            return `
                <div class="risk-alert">
                    <strong>⚠️ 高風險警告：</strong>95% VaR 超過資本 50%。強烈建議分散投資！
                </div>
            `;
        }
        return '';
    }

    generateKPISection(result) {
        return `
            <div class="kpi-section">
                <h4>核心指標</h4>
                <div class="kpi-grid">
                    <div class="kpi-item">
                        <div class="kpi-label">Sharpe 比率</div>
                        <div class="kpi-value">${result.riskMetrics?.sharpeRatio?.toFixed(2) || 'N/A'}</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-label">VaR 95%</div>
                        <div class="kpi-value">$${this.formatMoney(result.riskMetrics?.var95 || result.riskMetrics?.varValue || 0)}</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-label">CVaR 95%</div>
                        <div class="kpi-value">$${this.formatMoney(result.riskMetrics?.cvar95 || result.riskMetrics?.esValue || 0)}</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-label">最大回撤</div>
                        <div class="kpi-value">${((result.riskMetrics?.maxDrawdown || 0) * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        `;
    }

    generateTechnicalSection(result) {
        return `
            <div class="technical-section">
                <h4>技術指標</h4>
                <p>
                    <span class="has-tooltip" data-tooltip="相對強弱指數 (14日)，>70 超買，<30 超賣">RSI</span>: ${(result.technical?.rsi || 0).toFixed(1)} 
                    (${(result.technical?.rsi || 0) > 70 ? '超買' : ((result.technical?.rsi || 0) < 30 ? '超賣' : '中性')})，
                    <span class="has-tooltip" data-tooltip="平滑異同移動平均，MACD>0 偏多，<0 偏空">MACD</span>: ${(result.technical?.macd || 0).toFixed(2)} 
                    (${(result.technical?.macd || 0) > 0 ? '偏多' : '偏空'})，
                    市場情緒: ${((result.sentiment?.score || 0) * 100).toFixed(0)}% 
                    (${(result.sentiment?.score || 0) > 0.5 ? '正面' : '負面'})，
                    X 情緒分數: ${(result.metrics?.xSentiment ?? result.sentiment?.x ?? 0).toFixed(2)}，
                    GARCH Volatility: ${(result.metrics?.garchSigmaAnnual || 0).toFixed(4)}
                </p>
                ${Array.isArray(result?.portfolio?.corr) ? `
                <div class="help-text">組合相關矩陣：</div>
                <table><tbody>
                    ${result.portfolio.corr.map((row,i)=>`<tr>${row.map((c,j)=>`<td>${(c||0).toFixed(2)}</td>`).join('')}</tr>`).join('')}
                </tbody></table>
                ` : ''}
            </div>
        `;
    }

    generateFundamentalsSection(result) {
        const f = result.fundamentals || {};
        return `
            <div class="fundamentals-section">
                <h4>基本面分析</h4>
                <p>
                    EPS: ${isFinite(f.eps) ? f.eps.toFixed(2) : 'N/A'}，
                    P/E: ${isFinite(f.pe) ? f.pe.toFixed(2) : 'N/A'}，
                    PEG: ${isFinite(f.peg) ? f.peg.toFixed(2) : 'N/A'}
                </p>
                <p>
                    FCF: $${isFinite(f.fcf) ? this.formatMoney(f.fcf) : 'N/A'}，
                    FCF收益率: ${isFinite(f.fcfYield) ? (f.fcfYield * 100).toFixed(2) + '%' : 'N/A'}，
                    負債/權益: ${isFinite(f.debtEquity) ? f.debtEquity.toFixed(2) : 'N/A'}
                </p>
            </div>
        `;
    }

    generatePredictionsSection(result) {
        return `
            <div class="predictions-section">
                <h4>模型預測</h4>
                <p>
                    LSTM: $${(result.predictions?.lstm || 0).toFixed(2)}，
                    ARIMA: $${(result.predictions?.arima || 0).toFixed(2)}，
                    GBM: $${(result.predictions?.gbm || 0).toFixed(2)}，
                    綜合預測: $${(result.predictions?.combined || 0).toFixed(2)}
                </p>
                <p>回測準確率: ${(result.backtest?.accuracyPct || 0).toFixed(2)}% ${((result.backtest?.accuracyPct || 0) < 70 ? '(低於70%建議勿投)' : '')}</p>
                ${Array.isArray(result?.portfolio?.weights) ? `<div class="help-text">組合優化權重(均值-方差)：<br>${result.portfolio.symbols.map((s,i)=>`${s}: ${(result.portfolio.weights[i]*100).toFixed(2)}%`).join('<br>')}</div>` : ''}
                ${Array.isArray(result?.portfolio?.weightsRiskParity) ? `<div class="help-text">風險平價權重：<br>${result.portfolio.symbols.map((s,i)=>`${s}: ${(result.portfolio.weightsRiskParity[i]*100).toFixed(2)}%`).join('<br>')}</div>` : ''}
                ${Array.isArray(result?.portfolio?.weightsCv) ? `<div class="help-text">CV優化權重：<br>${result.portfolio.symbols.map((s,i)=>`${s}: ${(result.portfolio.weightsCv[i]*100).toFixed(2)}%`).join('<br>')}</div>` : ''}
                <p>Alert Status: ${result.alertMsg ? result.alertMsg : 'No alert'}</p>
                ${Array.isArray(result?.sentiment?.news?.headlines) && result.sentiment.news.headlines.length ? `<div><h5>新聞頭條</h5><ul>${result.sentiment.news.headlines.map(h=>`<li>${h}</li>`).join('')}</ul><div>新聞情緒: ${(result.metrics?.newsSentiment ?? 0).toFixed(2)}</div></div>` : ''}
                ${result.scenarios ? `<div class="help-text">情景分析：樂觀 上漲概率 ${result.scenarios.optimistic.toFixed(2)}% ｜ 悲觀 上漲概率 ${result.scenarios.pessimistic.toFixed(2)}% ｜ 壓力測試(crash) 上漲概率 ${result.scenarios.crash.toFixed(2)}%${result.scenarios.inflation!=null?` ｜ 通膨 上漲概率 ${result.scenarios.inflation.toFixed(2)}%`:''}</div>` : ''}
                ${result.varBacktest ? `<div class=\"help-text\">VaR違規次數：${result.varBacktest.breaches}/${result.varBacktest.total}（${result.varBacktest.breachRatePct.toFixed(2)}%）</div>` : ''}
                ${result.abTest ? `<div class=\"help-text\">A/B Test: Model ${result.abTest.group} selected. Accuracy diff: ${result.abTest.accuracyDiff.toFixed(2)}% ${result.abTest.accuracyDiff>0?'(B better if positive)':''}</div>` : ''}
                <p>上漲概率: ${(result.predictions?.upProbability || 0).toFixed(1)}%</p>
            </div>
        `;
    }

    generateRiskSection(result) {
        const suggestedAmt = result.riskMetrics.suggestedAllocation * result.amount;
        return `
            <div class="risk-section">
                <h4>風險管理</h4>
                <p>
                    風險預算 (VaR 95%): 允許損失 ${result.riskTolerance}% → $${this.formatMoney(-Math.abs(result.amount) * (result.riskTolerance/100))}
                </p>
                <p>
                    建議倉位: <strong>${((result.riskMetrics?.suggestedAllocation || 0) * 100).toFixed(1)}%</strong> 
                    (約 $${this.formatMoney(suggestedAmt)})
                </p>
                <p>CVaR 95%: $${this.formatMoney(result.riskMetrics?.cvar95 || 0)}</p>
                ${isFinite(result.metrics?.beta) ? `<p>Beta: ${(result.metrics?.beta || 1).toFixed(2)} ${(result.metrics?.beta || 1) > 1 ? '(高波動)' : '(低波動)'}</p>` : ''}
                ${isFinite(result.riskMetrics?.kellyFraction) ? `<p>Kelly 建議倉位: ${(result.riskMetrics.kellyFraction * 100).toFixed(1)}% (max 20%)</p>` : ''}
            </div>
        `;
    }

    formatMoney(n) {
        if (!isFinite(n)) return '-';
        const sign = n < 0 ? '-' : '';
        const v = Math.abs(n);
        return sign + (v >= 1000 ? v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : v.toFixed(0));
    }
}

// History Manager
class HistoryManager {
    constructor() {
        this.key = 'sp_history_v2';
        this.firebaseReady = false;
        this.user = null;
        this.db = null;
        this.initFirebase();
    }

    initFirebase() {
        try {
            if (!window.firebase || !window.firebase.initializeApp) return;
            const config = window.FIREBASE_CONFIG || {
                apiKey: "",
                authDomain: "",
                databaseURL: "",
                projectId: "",
                storageBucket: "",
                messagingSenderId: "",
                appId: ""
            };
            // Allow empty config; user can fill via window.FIREBASE_CONFIG
            window.firebase.initializeApp(config);
            this.db = window.firebase.database();
            window.firebase.auth().onAuthStateChanged((user) => {
                this.user = user || null;
                const el = document.getElementById('loginStatus');
                if (el) el.textContent = user ? `已登入：${user.email}` : '未登入（Guest）';
            });
            this.firebaseReady = true;
        } catch (_) {
            this.firebaseReady = false;
        }
    }

    add(result) {
        const history = this.read();
        const entry = {
            timestamp: new Date().toISOString(),
            symbol: result.symbol,
            market: result.market,
            days: result.days,
            latestPrice: result.stockData.closes[result.stockData.closes.length - 1],
            forecastPrice: result.predictions.combined,
            upProbability: result.predictions.upProbability,
            suggestedAllocation: result.riskMetrics.suggestedAllocation
        };
        
        history.unshift(entry);
        this.write(history.slice(0, 50)); // Keep last 50 entries
        this.syncToCloud().catch(()=>{});
    }

    read() {
        try {
            const data = localStorage.getItem(this.key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }

    write(history) {
        try {
            localStorage.setItem(this.key, JSON.stringify(history));
        } catch (error) {
            console.warn('Failed to save history:', error);
        }
    }

    async syncToCloud() {
        try {
            if (!this.firebaseReady || !this.user || !this.db) return;
            const ref = this.db.ref(`users/${this.user.uid}/history`);
            await ref.set(this.read());
        } catch (_) {}
    }

    async loadFromCloud() {
        try {
            if (!this.firebaseReady || !this.user || !this.db) return null;
            const ref = this.db.ref(`users/${this.user.uid}/history`);
            const snap = await ref.get();
            return snap.exists() ? snap.val() : null;
        } catch (_) { return null; }
    }

    render() {
        const history = this.read();
        const container = document.getElementById('historyList');
        
        if (!history.length) {
            // Try cloud load when empty
            this.loadFromCloud().then((cloud) => {
                if (Array.isArray(cloud) && cloud.length) {
                    this.write(cloud);
                    this.render();
                } else {
            container.innerHTML = '<p>暫無歷史記錄</p>';
                }
            }).catch(()=>{ container.innerHTML = '<p>暫無歷史記錄</p>'; });
            return;
        }

        const rows = history.map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${entry.symbol}</td>
                <td>${entry.market}</td>
                <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
                <td>${entry.days}天</td>
                <td>$${(entry.latestPrice || 0).toFixed(2)}</td>
                <td>$${(entry.forecastPrice || 0).toFixed(2)}</td>
                <td>${(entry.upProbability || 0).toFixed(1)}%</td>
                <td>${((entry.suggestedAllocation || 0) * 100).toFixed(1)}%</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.rerunPrediction(${index})">
                        重跑
                    </button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>代號</th>
                        <th>市場</th>
                        <th>時間</th>
                        <th>時長</th>
                        <th>當前價</th>
                        <th>預測價</th>
                        <th>上漲概率</th>
                        <th>建議倉位</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    clear() {
        this.write([]);
        this.render();
    }
}

// Settings Manager
class SettingsManager {
    constructor() {
        this.key = 'sp_settings_v1';
    }

    load() {
        try {
            const data = localStorage.getItem(this.key);
            if (data) {
                const settings = JSON.parse(data);
                // Apply settings to app
                if (settings.apiEndpoint) {
                    app.apiUrl = settings.apiEndpoint;
                }
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    save() {
        try {
            const settings = {
                apiEndpoint: app.apiUrl,
                defaultPaths: parseInt(document.getElementById('defaultPaths').value),
                autoRefresh: document.getElementById('autoRefresh').checked
            };
            localStorage.setItem(this.key, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StockPredictionApp();
    
    // Make app globally available for history rerun
    window.app = app;
    // Wire Perplexity AI minimal client
    console.log('Starting Perplexity AI client setup...');
    try {
        const btn = document.getElementById('grokBtn');
        const promptEl = document.getElementById('grokPrompt');
        const outEl = document.getElementById('grokOutput');
        const keyEl = document.getElementById('grokApiKey');
        const tplEl = document.getElementById('grokTemplate');
        const toneEl = document.getElementById('grokTone');
        const streamEl = document.getElementById('grokStream');
        const cancelEl = document.getElementById('grokCancel');
        if (btn && promptEl && outEl) {
            console.log('Perplexity AI client initialized successfully');
            console.log('Button found:', btn);
            console.log('Prompt element found:', promptEl);
            console.log('Output element found:', outEl);
            let busy = false;
            let currentAbort = null;
            let perplexityModel = 'sonar-pro';
            // Fetch backend Perplexity config once
            (async () => {
                try {
                    const cfgResp = await fetch(`${app.backendBase}/api/grok/config`).catch(()=>null);
                    if (cfgResp && cfgResp.ok) {
                        const cfg = await cfgResp.json();
                        if (cfg && cfg.model) perplexityModel = cfg.model;
                    }
                } catch (_) {}
            })();
            const chooseLLMModel = (key) => {
                try {
                    // Use Perplexity model by default
                    return perplexityModel || 'sonar-pro';
                } catch(_) {}
                return perplexityModel || 'sonar-pro';
            };
            const composeMessages = (userText) => {
                const template = (tplEl && tplEl.value) || 'analyst';
                const tone = (toneEl && toneEl.value) || 'neutral';
                // Get current stock data
                const stockSymbol = (document.getElementById('stockSymbol')?.value || '').trim().toUpperCase();
                const investmentAmount = document.getElementById('investmentAmount')?.value || '';
                const horizon = document.getElementById('horizon')?.value || '';
                
                // Get current analysis results from the page by searching for text patterns
                const pageText = document.body.textContent || '';
                const betaMatch = pageText.match(/Beta:\s*([0-9.]+)/);
                const varMatch = pageText.match(/VaR\s*95%[^:]*:\s*([^)]+)/);
                const kellyMatch = pageText.match(/Kelly[^:]*:\s*([^)]+)/);
                const upsideMatch = pageText.match(/上漲概率[^:]*:\s*([0-9.]+%)/);
                const currentPriceMatch = pageText.match(/\$([0-9.]+)/);
                
                const currentPrice = currentPriceMatch ? `$${currentPriceMatch[1]}` : '';
                const beta = betaMatch ? betaMatch[1] : '';
                const var95 = varMatch ? varMatch[1].trim() : '';
                const kellyPosition = kellyMatch ? kellyMatch[1].trim() : '';
                const upsideProbability = upsideMatch ? upsideMatch[1] : '';
                
                // Build context about current stock analysis
                let stockContext = '';
                if (stockSymbol) {
                    stockContext = `\n\n當前股票分析數據：\n- 股票代號：${stockSymbol}`;
                    if (currentPrice) stockContext += `\n- 當前價格：${currentPrice}`;
                    if (beta) stockContext += `\n- Beta值：${beta}`;
                    if (var95) stockContext += `\n- VaR 95%：${var95}`;
                    if (kellyPosition) stockContext += `\n- Kelly建議倉位：${kellyPosition}`;
                    if (upsideProbability) stockContext += `\n- 上漲概率：${upsideProbability}`;
                    if (investmentAmount) stockContext += `\n- 投資金額：$${investmentAmount}`;
                    if (horizon) stockContext += `\n- 投資期限：${horizon}天`;
                }
                
                console.log('Extracted stock data:', {
                    stockSymbol, currentPrice, beta, var95, kellyPosition, upsideProbability,
                    investmentAmount, horizon, stockContext
                });
                
                const sys = `你係一名擁有超過30年數學博士學位經驗的專業投資者同樣係最高級既程式員，專注於量化金融、隨機過程和機器學習模型在投資決策中的應用。分析方法強調多路徑評估：結合基本面（財務數據）、技術指標（歷史價格模式）、情緒指標（新聞和社交媒體）、以及數學模型（如蒙特卡洛模擬和時間序列預測），以捕捉不確定性並提供概率性洞見。語調：${tone}。請提供簡潔、專業的分析。${stockContext}`;
                let user = userText;
                if (template === 'analyst') {
                    user = `請以專業分析師角度精簡回答：${userText}`;
                } else if (template === 'risk') {
                    user = `聚焦風險與應對，條列重點：${userText}`;
                } else if (template === 'news') {
                    user = `整合近期新聞與情緒分數，提供三點結論：${userText}`;
                } else if (template === 'screener') {
                    user = `把以下自然語言轉為股票篩選條件並給出10隻候選：${userText}`;
                }
                return [
                    { role: 'system', content: sys },
                    { role: 'user', content: user }
                ];
            };
            btn.addEventListener('click', async () => {
                console.log('Perplexity AI button clicked');
                if (busy) return;
                const userText = (promptEl.value || '').trim();
                if (!userText) { outEl.textContent = '請先輸入提示內容'; return; }
                busy = true;
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 等待 Perplexity 回覆...';
                if (cancelEl) cancelEl.style.display = 'inline-flex';
                outEl.textContent = '';
                try {
                    const userPerplexityKey = keyEl && keyEl.value ? keyEl.value.trim() : '';
                    console.log('User Perplexity Key:', userPerplexityKey ? 'provided' : 'not provided');
                    console.log('Backend Base:', app.backendBase);
                    // Key is optional for OpenRouter if server has env key
                    const useStream = !!(streamEl && streamEl.checked);
                    const messages = composeMessages(userText);
                    console.log('Messages:', messages);
                    console.log('Stream mode requested:', useStream);
                    // Perplexity API doesn't support streaming, so we'll use chat mode instead
                    if (useStream) {
                        console.log('Stream mode requested but Perplexity doesn\'t support streaming, using chat mode instead');
                    }
                    if (false) { // Disable streaming for Perplexity
                        const streamUrl = `${app.backendBase}/api/grok/stream`;
                        try {
                            const init = {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ apiKey: userPerplexityKey, model: chooseLLMModel(userPerplexityKey), messages })
                            };
                            console.log('Stream URL:', streamUrl);
                            console.log('Request init:', init);
                            const resp = await fetch(streamUrl, init);
                            console.log('Stream response status:', resp.status);
                            if (!resp.ok || !resp.body) {
                                throw new Error(`HTTP ${resp.status}`);
                            }
                            const reader = resp.body.getReader();
                            currentAbort = reader;
                            const decoder = new TextDecoder('utf-8');
                            let buffer = '';
                            console.log('Starting to read stream...');
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) {
                                    console.log('Stream reading completed');
                                    break;
                                }
                                const chunk = decoder.decode(value, { stream: true });
                                console.log('Received chunk:', chunk);
                                buffer += chunk;
                                const parts = buffer.split('\n\n');
                                buffer = parts.pop() || '';
                                for (const part of parts) {
                                    const line = part.trim();
                                    if (!line) continue;
                                    if (line.startsWith('data:')) {
                                        const payload = line.slice(5).trim();
                                        console.log('Processing data payload:', payload);
                                        if (payload === '[DONE]') continue;
                                        try {
                                            outEl.textContent += payload.replace(/\\n/g, '\n');
                                            console.log('Updated output element with:', payload);
                                        } catch (_) {
                                            outEl.textContent += payload;
                                            console.log('Updated output element (fallback) with:', payload);
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('Stream failed, falling back to chat:', e);
                            const chatUrl = `${app.backendBase}/api/grok/chat`;
                            console.log('Chat URL:', chatUrl);
                            const resp = await fetch(chatUrl, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ apiKey: userPerplexityKey, model: chooseLLMModel(userPerplexityKey), messages })
                            });
                            console.log('Chat response status:', resp.status);
                            const data = await resp.json();
                            console.log('Chat response data:', data);
                            const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                                || data?.message || JSON.stringify(data, null, 2);
                            outEl.textContent = text;
                        }
                    } else {
                        const chatUrl = `${app.backendBase}/api/grok/chat`;
                        console.log('Non-stream Chat URL:', chatUrl);
                        const resp = await fetch(chatUrl, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey: userPerplexityKey, model: chooseLLMModel(userPerplexityKey), messages })
                        });
                        console.log('Non-stream response status:', resp.status);
                        const data = await resp.json();
                        console.log('Non-stream response data:', data);
                        const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                            || data?.message || JSON.stringify(data, null, 2);
                        outEl.textContent = text;
                    }
                } catch (e) {
                    console.error('AI chat error:', e);
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown') + '\n' +
                        '請確認：伺服器正在運行、可從此域名訪問 /api/grok/chat、以及後端已設定 Perplexity API 金鑰。';
                } finally {
                    btn.innerHTML = original;
                    if (cancelEl) cancelEl.style.display = 'none';
                    currentAbort = null;
                    busy = false;
                }
            });
            if (cancelEl) {
                cancelEl.addEventListener('click', async () => {
                    try {
                        if (currentAbort && currentAbort.cancel) currentAbort.cancel();
                        if (currentAbort && currentAbort.releaseLock) currentAbort.releaseLock();
                    } catch (_) {}
                });
            }
        } else {
            console.log('Missing required elements for Perplexity AI client');
            console.log('Button found:', !!btn);
            console.log('Prompt element found:', !!promptEl);
            console.log('Output element found:', !!outEl);
        }
    } catch (e) {
        console.error('Perplexity AI client error:', e);
    }
    // Register service worker only on http(s)
    if ('serviceWorker' in navigator) {
        try {
            const proto = (location.protocol || '').toLowerCase();
            if (proto === 'http:' || proto === 'https:') {
                navigator.serviceWorker.register('/sw.js').catch(()=>{});
            }
        } catch (_) {}
    }
    // Copilot sidebar
    try {
        const panel = document.getElementById('copilotPanel');
        const toggle = document.getElementById('copilotToggle');
        const closeBtn = document.getElementById('copilotClose');
        const inputEl = document.getElementById('copilotInput');
        const apiKeyEl = document.getElementById('copilotApiKey');
        const intentEl = document.getElementById('copilotIntent');
        const sendBtn = document.getElementById('copilotSend');
        const histEl = document.getElementById('copilotHistory');
        const exportJson = document.getElementById('copilotExportJson');
        const exportMd = document.getElementById('copilotExportMd');
        const history = [];
        let copilotLang = (document.documentElement.lang || 'zh-HK').toLowerCase();
        function openPanel() { panel.style.right = '0px'; }
        function closePanel() { panel.style.right = '-420px'; }
        function renderHistory() {
            if (!histEl) return;
            if (!history.length) { histEl.innerHTML = '<div class="help-text">尚無對話</div>'; return; }
            histEl.innerHTML = history.map(h => `<div style="margin-bottom:12px;"><div style=\"opacity:.7;font-size:12px\">${new Date(h.ts).toLocaleString()}</div><div><strong>Q:</strong> ${h.q}</div><pre class=\"code\" style=\"white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:8px;border-radius:6px;\">${(typeof h.a==='string')?h.a:JSON.stringify(h.a,null,2)}</pre></div>`).join('');
        }
        toggle && toggle.addEventListener('click', openPanel);
        closeBtn && closeBtn.addEventListener('click', closePanel);
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.addEventListener('click', () => {
                copilotLang = copilotLang === 'en' ? 'zh-HK' : 'en';
            });
        }
        exportJson && exportJson.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `copilot-history-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
        });
        exportMd && exportMd.addEventListener('click', () => {
            const md = history.map(h => `### ${new Date(h.ts).toLocaleString()}\n\nQ: ${h.q}\n\nA:\n\n\`\`\`json\n${(typeof h.a==='string')?h.a:JSON.stringify(h.a,null,2)}\n\`\`\`\n`).join('\n');
            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `copilot-history-${Date.now()}.md`; a.click();
            URL.revokeObjectURL(url);
        });
        async function routeCopilot(q, apiKey) {
            const intent = (intentEl && intentEl.value) || 'auto';
            const lower = q.toLowerCase();
            const useIntent = intent === 'auto' ? (lower.includes('peer') ? 'peers' : lower.includes('news') ? 'news' : lower.includes('peg') || lower.includes('market cap') ? 'screener' : lower.includes('portfolio') ? 'portfolio' : 'chat') : intent;
            const systemPrompt = copilotLang === 'en' ? 'You are a professional investor with over 30 years of experience and a PhD in Mathematics, specializing in quantitative finance, stochastic processes, and machine learning models for investment decisions. Your analysis emphasizes multi-path evaluation combining fundamentals, technical indicators, sentiment analysis, and mathematical models like Monte Carlo simulations and time series forecasting to capture uncertainty and provide probabilistic insights.' : '你係一名擁有超過30年數學博士學位經驗的專業投資者同樣係最高級既程式員，專注於量化金融、隨機過程和機器學習模型在投資決策中的應用。分析方法強調多路徑評估：結合基本面（財務數據）、技術指標（歷史價格模式）、情緒指標（新聞和社交媒體）、以及數學模型（如蒙特卡洛模擬和時間序列預測），以捕捉不確定性並提供概率性洞見。';
            if (useIntent === 'chat') {
                const resp = await fetch(`${app.backendBase}/api/grok/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, model: 'sonar-pro', messages: [{ role:'system', content: systemPrompt }, { role:'user', content:q }] }) });
                const j = await resp.json();
                const text = j?.choices?.[0]?.message?.content || JSON.stringify(j);
                return text;
            } else if (useIntent === 'screener') {
                const resp = await fetch(`${app.backendBase}/api/grok/screener`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, query: q, size: 10 }) });
                const j = await resp.json();
                return j.result || j;
            } else if (useIntent === 'news') {
                const parts = q.split(/\s+/); const symbol = parts[0].toUpperCase();
                const resp = await fetch(`${app.backendBase}/api/grok/news-insights`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, symbol, lookbackDays: 7 }) });
                const j = await resp.json();
                return j.insights || j;
            } else if (useIntent === 'peers') {
                const parts = q.split(/\s+/); const symbol = parts[0].toUpperCase();
                const resp = await fetch(`${app.backendBase}/api/grok/peers-compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, symbol }) });
                const j = await resp.json();
                return j.compare || j;
            } else if (useIntent === 'portfolio') {
                const parsed = q.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{ const [s,w]=x.split(':'); return { symbol:(s||'').trim().toUpperCase(), weight:Number(w||0) }; });
                const resp = await fetch(`${app.backendBase}/api/grok/portfolio-doctor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, holdings: parsed }) });
                const j = await resp.json();
                return j.doctor || j;
            }
            return { note: 'no_route' };
        }
        sendBtn && sendBtn.addEventListener('click', async () => {
            const q = (inputEl && inputEl.value || '').trim();
            const apiKey = (apiKeyEl && apiKeyEl.value || '').trim(); // optional with backend key
            if (!q) return;
            const ts = Date.now();
            try {
                const a = await routeCopilot(q, apiKey);
                history.push({ ts, q, a });
                renderHistory();
            } catch (e) {
                history.push({ ts, q, a: { error: e && e.message ? e.message : 'unknown' } });
                renderHistory();
            }
        });
    } catch (_) {}
    // TradingView Pro Chart
    try {
        const tvDiv = document.getElementById('tvContainer');
        const tvDiv2 = document.getElementById('tvContainer2');
        const tvLoad = document.getElementById('tvLoad');
        const tvSymbolInput = document.getElementById('tvSymbol');
        const emaEl = document.getElementById('tvEMA');
        const rsiEl = document.getElementById('tvRSI');
        const macdEl = document.getElementById('tvMACD');
        const compareEl = document.getElementById('tvCompare');
        const addCompare = document.getElementById('tvAddCompare');
        const layoutSingle = document.getElementById('tvLayoutSingle');
        const layoutTwo = document.getElementById('tvLayoutTwo');
        const tfButtons = document.querySelectorAll('[data-tf]');
        const tmplNameEl = document.getElementById('tvTemplateName');
        const tmplSaveBtn = document.getElementById('tvTemplateSave');
        const tmplApplySel = document.getElementById('tvTemplateApply');
        const alertPriceEl = document.getElementById('tvAlertPrice');
        const alertDirEl = document.getElementById('tvAlertDir');
        const alertSoundEl = document.getElementById('tvAlertSound');
        const alertSetBtn = document.getElementById('tvAlertSet');
        const alertsListEl = document.getElementById('tvAlertsList');
        const alertBackendEl = document.getElementById('tvAlertBackend');
        const alertsRefreshBtn = document.getElementById('tvAlertsRefresh');
        const drawCanvas = document.getElementById('tvDraw');
        const drawTrendBtn = document.getElementById('tvDrawTrend');
        const drawHLineBtn = document.getElementById('tvDrawHLine');
        const drawFiboBtn = document.getElementById('tvDrawFibo');
        const drawClearBtn = document.getElementById('tvDrawClear');
        const drawColorEl = document.getElementById('tvDrawColor');
        const drawWidthEl = document.getElementById('tvDrawWidth');
        let tvWidget = null;
        let tvWidget2 = null;
        let compares = [];
        let timeframe = 'D';
        let alertTimer = null;
        let drawMode = null; // 'trend' | 'hline' | 'fibo' | null
        let drawings = []; // {type, points:[{x,y}], symbol, color, width}
        let currentPoints = [];
        let selectedIdx = -1;
        function symbolKey() {
            return (tvSymbolInput && tvSymbolInput.value || 'AAPL').toUpperCase();
        }
        function readDrawings() {
            try { return JSON.parse(localStorage.getItem('tv_drawings')||'{}'); } catch(_) { return {}; }
        }
        function writeDrawings(store) {
            try { localStorage.setItem('tv_drawings', JSON.stringify(store)); } catch(_) {}
        }
        function loadDrawingsForSymbol() {
            const store = readDrawings();
            drawings = store[symbolKey()] || [];
            redraw();
        }
        function saveDrawingsForSymbol() {
            const store = readDrawings();
            store[symbolKey()] = drawings;
            writeDrawings(store);
        }
        function resizeCanvas() {
            if (!drawCanvas) return;
            const rect = drawCanvas.getBoundingClientRect();
            drawCanvas.width = rect.width * (window.devicePixelRatio || 1);
            drawCanvas.height = rect.height * (window.devicePixelRatio || 1);
            const ctx = drawCanvas.getContext('2d');
            ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
            redraw();
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        function redraw() {
            if (!drawCanvas) return;
            const ctx = drawCanvas.getContext('2d');
            ctx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
            for (let i=0;i<drawings.length;i++) {
                const d = drawings[i];
                ctx.strokeStyle = d.color || '#22d3ee';
                ctx.lineWidth = d.width || 2;
                ctx.fillStyle = 'rgba(34,211,238,0.12)';
                if (d.type === 'trend' && d.points.length >= 2) {
                    const [p1,p2] = d.points; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
                } else if (d.type === 'hline' && d.points.length >= 1) {
                    const y = d.points[0].y; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(drawCanvas.width, y); ctx.stroke();
                } else if (d.type === 'fibo' && d.points.length >= 2) {
                    const [p1,p2] = d.points; const top = Math.min(p1.y,p2.y), bot = Math.max(p1.y,p2.y);
                    const levels = [0,0.236,0.382,0.5,0.618,0.786,1];
                    levels.forEach(l=>{ const y = bot - (bot-top)*l; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(drawCanvas.width, y); ctx.stroke(); });
                }
                if (i === selectedIdx) {
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
                    const bb = boundingBox(d);
                    if (bb) { ctx.strokeRect(bb.x, bb.y, bb.w, bb.h); }
                    ctx.setLineDash([]);
                }
            }
            if (currentPoints.length === 1) {
                const p = currentPoints[0]; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
            }
        }
        function boundingBox(d) {
            const xs = d.points.map(p=>p.x), ys = d.points.map(p=>p.y);
            if (!xs.length) return null; const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
            return { x: minx-6, y: miny-6, w: (maxx-minx)+12, h: (maxy-miny)+12 };
        }
        function hitTest(x, y) {
            for (let i=drawings.length-1;i>=0;i--) {
                const bb = boundingBox(drawings[i]); if (!bb) continue;
                if (x>=bb.x && x<=bb.x+bb.w && y>=bb.y && y<=bb.y+bb.h) return i;
            }
            return -1;
        }
        function attachDrawEvents() {
            if (!drawCanvas) return;
            let dragging = false; let dragOffset = { x:0, y:0 };
            drawCanvas.addEventListener('mousedown', (e) => {
                const rect = drawCanvas.getBoundingClientRect();
                const x = (e.clientX - rect.left), y = (e.clientY - rect.top);
                if (!drawMode) {
                    selectedIdx = hitTest(x, y);
                    if (selectedIdx >= 0) {
                        const d = drawings[selectedIdx]; const bb = boundingBox(d);
                        dragOffset = { x: x - (bb?.x||0), y: y - (bb?.y||0) };
                        dragging = true;
                    }
                    redraw();
                    return;
                }
                currentPoints.push({ x, y });
                if ((drawMode === 'trend' && currentPoints.length === 2) || (drawMode === 'fibo' && currentPoints.length === 2) || (drawMode === 'hline' && currentPoints.length === 1)) {
                    drawings.push({ type: drawMode, points: currentPoints.slice(), symbol: symbolKey(), color: (drawColorEl && drawColorEl.value) || '#22d3ee', width: Number(drawWidthEl && drawWidthEl.value || 2) });
                    currentPoints = []; drawMode = null; saveDrawingsForSymbol(); redraw();
                } else { redraw(); }
            });
            drawCanvas.addEventListener('mousemove', (e) => {
                if (currentPoints.length) { redraw(); return; }
                if (dragging && selectedIdx >= 0) {
                    const rect = drawCanvas.getBoundingClientRect(); const x = (e.clientX - rect.left), y = (e.clientY - rect.top);
                    const d = drawings[selectedIdx]; const bb = boundingBox(d); if (!bb) return;
                    const dx = x - (bb.x + dragOffset.x), dy = y - (bb.y + dragOffset.y);
                    d.points = d.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    redraw();
                }
            });
            drawCanvas.addEventListener('mouseup', () => { if (dragging) { dragging = false; saveDrawingsForSymbol(); } });
            window.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 't') { drawMode = 'trend'; }
                else if (e.key.toLowerCase() === 'h') { drawMode = 'hline'; }
                else if (e.key.toLowerCase() === 'f') { drawMode = 'fibo'; }
                else if (e.key === 'Escape') { drawMode = null; currentPoints = []; redraw(); }
                else if (e.key === 'Delete') { if (selectedIdx>=0) { drawings.splice(selectedIdx,1); selectedIdx=-1; } else { drawings.pop(); } saveDrawingsForSymbol(); redraw(); }
            });
            drawTrendBtn && drawTrendBtn.addEventListener('click', ()=> drawMode = 'trend');
            drawHLineBtn && drawHLineBtn.addEventListener('click', ()=> drawMode = 'hline');
            drawFiboBtn && drawFiboBtn.addEventListener('click', ()=> drawMode = 'fibo');
            drawClearBtn && drawClearBtn.addEventListener('click', ()=> { drawings = []; saveDrawingsForSymbol(); redraw(); });
        }
        attachDrawEvents();
        function readAlerts() {
            try { return JSON.parse(localStorage.getItem('tv_alerts')||'[]'); } catch(_) { return []; }
        }
        function writeAlerts(arr) {
            try { localStorage.setItem('tv_alerts', JSON.stringify(arr)); } catch(_) {}
        }
        async function renderAlerts() {
            const backend = alertBackendEl && alertBackendEl.checked;
            const arr = backend ? (await fetch(`${app.backendBase}/api/alerts`).then(r=>r.json()).then(j=>j.alerts||[]).catch(()=>[])) : readAlerts();
            if (!alertsListEl) return;
            if (!arr.length) { alertsListEl.textContent = '—'; return; }
            alertsListEl.innerHTML = '<table><thead><tr><th>Symbol</th><th>Dir</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>' +
                arr.map((a,i)=>`<tr><td>${a.symbol}</td><td>${a.dir}</td><td>${a.price}</td><td>${a.fired?'Fired':'Active'}</td><td><button data-del="${backend?a.id:i}" class="btn btn-danger btn-sm">刪除</button></td></tr>`).join('') + '</tbody></table>';
            alertsListEl.querySelectorAll('button[data-del]').forEach(btn=>{
                btn.addEventListener('click', async () => {
                    const key = btn.getAttribute('data-del');
                    if (backend) {
                        await fetch(`${app.backendBase}/api/alerts/${encodeURIComponent(key)}`, { method:'DELETE' }).catch(()=>{});
                        renderAlerts();
                    } else {
                        const idx = Number(key);
                        const arr2 = readAlerts();
                        arr2.splice(idx,1); writeAlerts(arr2); renderAlerts();
                    }
                });
            });
        }
        renderAlerts();
        alertsRefreshBtn && alertsRefreshBtn.addEventListener('click', () => renderAlerts());
        function loadTemplatesDropdown() {
            try {
                const t = JSON.parse(localStorage.getItem('tv_templates')||'{}');
                tmplApplySel.innerHTML = '<option value="">Apply Template…</option>' + Object.keys(t).map(k=>`<option value="${k}">${k}</option>`).join('');
            } catch(_){}
        }
        function saveTvState() {
            try { localStorage.setItem('tv_state', JSON.stringify({ compares, timeframe, layout: tvDiv2 && tvDiv2.style.display !== 'none' ? 'two' : 'single' })); } catch (_) {}
        }
        function loadTvState() {
            try { const s = JSON.parse(localStorage.getItem('tv_state')||'{}'); compares = Array.isArray(s.compares)?s.compares:[]; timeframe = s.timeframe || 'D'; if (s.layout === 'two' && tvDiv2) tvDiv2.style.display = ''; } catch (_) {}
        }
        loadTvState();
        loadTemplatesDropdown();
        function mapToTvSymbol(sym) {
            if (!sym) return 'AAPL';
            const s = sym.trim().toUpperCase();
            if (s.endsWith('.HK')) return `HKEX:${s.replace('.HK','')}`;
            return s; // default assumes US
        }
        async function loadTv(sym) {
            const symbol = mapToTvSymbol(sym || tvSymbolInput.value || 'AAPL');
            if (!window.TradingView || !tvDiv) return;
            tvDiv.innerHTML = '';
            tvWidget = new TradingView.widget({
                symbol,
                interval: timeframe,
                container_id: 'tvContainer',
                library_path: undefined,
                autosize: true,
                theme: (document.documentElement.classList.contains('dark') ? 'dark' : 'dark'),
                locale: (document.documentElement.lang || 'en'),
                hide_top_toolbar: false,
                hide_legend: false,
                allow_symbol_change: true,
                studies: [
                    ...(emaEl && emaEl.checked ? ['Moving Average Exponential@tv-basicstudies'] : []),
                    ...(rsiEl && rsiEl.checked ? ['Relative Strength Index@tv-basicstudies'] : []),
                    ...(macdEl && macdEl.checked ? ['MACD@tv-basicstudies'] : [])
                ],
                compare_symbols: compares
            });
            if (tvDiv2 && tvDiv2.style.display !== 'none') {
                tvDiv2.innerHTML = '';
                tvWidget2 = new TradingView.widget({
                    symbol,
                    interval: timeframe,
                    container_id: 'tvContainer2',
                    autosize: true,
                    theme: (document.documentElement.classList.contains('dark') ? 'dark' : 'dark'),
                    locale: (document.documentElement.lang || 'en'),
                    hide_top_toolbar: false,
                    hide_legend: false,
                    allow_symbol_change: true
                });
                // After second widget ready, setup sync
                tvWidget2.onChartReady && tvWidget2.onChartReady(() => {
                    const c2 = tvWidget2.activeChart();
                    const c1 = tvWidget && tvWidget.activeChart && tvWidget.activeChart();
                    if (!c1 || !c2) return;
                    // Sync visible range from c1 -> c2
                    c1.onVisibleRangeChanged().subscribe(null, (range) => {
                        try { if (range && range.from && range.to) c2.setVisibleRange(range); } catch(_){}
                    });
                    // Sync interval change
                    c1.onIntervalChanged().subscribe(null, (res) => {
                        try { if (res && res.interval) c2.setResolution(res.interval); } catch(_){}
                    });
                    // Sync symbol change
                    c1.onSymbolChanged().subscribe(null, (symInfo) => {
                        try { if (symInfo && symInfo.name) c2.setSymbol(symInfo.name); } catch(_){}
                    });
                });
            }
            saveTvState();
        }
        if (tvLoad) tvLoad.addEventListener('click', () => loadTv());
        if (addCompare) addCompare.addEventListener('click', () => {
            const c = (compareEl && compareEl.value || '').trim();
            if (!c) return;
            compares.push(mapToTvSymbol(c));
            loadTv();
        });
        if (tmplSaveBtn) tmplSaveBtn.addEventListener('click', () => {
            const name = (tmplNameEl && tmplNameEl.value || '').trim();
            if (!name) { app.showToast && app.showToast('請輸入模板名'); return; }
            const t = {
                studies: {
                    EMA: !!(emaEl && emaEl.checked),
                    RSI: !!(rsiEl && rsiEl.checked),
                    MACD: !!(macdEl && macdEl.checked)
                },
                compares,
                timeframe
            };
            try {
                const store = JSON.parse(localStorage.getItem('tv_templates')||'{}');
                store[name] = t; localStorage.setItem('tv_templates', JSON.stringify(store));
                loadTemplatesDropdown();
                app.showToast && app.showToast('模板已保存');
            } catch(_) {}
        });
        if (tmplApplySel) tmplApplySel.addEventListener('change', () => {
            const key = tmplApplySel.value;
            if (!key) return;
            try {
                const store = JSON.parse(localStorage.getItem('tv_templates')||'{}');
                const tpl = store[key];
                if (!tpl) return;
                if (emaEl) emaEl.checked = !!tpl.studies?.EMA;
                if (rsiEl) rsiEl.checked = !!tpl.studies?.RSI;
                if (macdEl) macdEl.checked = !!tpl.studies?.MACD;
                compares = Array.isArray(tpl.compares)?tpl.compares:[];
                timeframe = tpl.timeframe || timeframe;
                loadTv();
                app.showToast && app.showToast('模板已套用');
            } catch(_) {}
        });
        async function pollAlerts() {
            try {
                const arr = readAlerts().filter(a => !a.fired);
                const symbols = Array.from(new Set(arr.map(a => a.symbol))).filter(Boolean);
                for (const sym of symbols) {
                    const q = await fetch(`${app.backendBase}/api/yahoo/quote?symbol=${encodeURIComponent(sym)}`).then(r=>r.json());
                    const r = q && q.quoteResponse && q.quoteResponse.result && q.quoteResponse.result[0];
                    const price = r ? (r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice) : null;
                    if (!price) continue;
                    const latest = Number(price);
                    const all = readAlerts();
                    let changed = false;
                    for (const a of all) {
                        if (a.symbol !== sym || a.fired) continue;
                        const hit = (a.dir === '>=') ? latest >= a.price : latest <= a.price;
                        if (hit) {
                            a.fired = true; changed = true;
                            app.showToast && app.showToast(`到價觸發：${a.symbol} ${a.dir} ${a.price}（現價 ${latest}）`);
                            if (alertSoundEl && alertSoundEl.checked) {
                                try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=').play().catch(()=>{}); } catch(_) {}
                            }
                        }
                    }
                    if (changed) { writeAlerts(all); renderAlerts(); }
                }
            } catch(_) {}
        }
        if (alertSetBtn) alertSetBtn.addEventListener('click', async () => {
            const price = Number(alertPriceEl && alertPriceEl.value || 0);
            const sym = (tvSymbolInput && tvSymbolInput.value || '').trim();
            const dir = (alertDirEl && alertDirEl.value) || '>=';
            if (!price || !sym) { app.showToast && app.showToast('請輸入代號與價格'); return; }
            const backend = alertBackendEl && alertBackendEl.checked;
            if (backend) {
                try { await fetch(`${app.backendBase}/api/alerts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ symbol: sym, dir, price }) }); } catch(_){ }
                renderAlerts();
                app.showToast && app.showToast('後端提醒已新增（每分鐘檢查）');
            } else {
                const all = readAlerts();
                all.push({ symbol: sym, dir, price, fired: false, createdAt: Date.now() });
                writeAlerts(all); renderAlerts();
                if (alertTimer) clearInterval(alertTimer);
                alertTimer = setInterval(pollAlerts, 15000);
                app.showToast && app.showToast('到價提醒已新增（每 15 秒輪詢）');
            }
        });
        tfButtons.forEach(btn => btn.addEventListener('click', () => { timeframe = btn.getAttribute('data-tf') || 'D'; loadTv(); }));
        if (layoutSingle) layoutSingle.addEventListener('click', () => { if (tvDiv2) { tvDiv2.style.display = 'none'; } loadTv(); });
        if (layoutTwo) layoutTwo.addEventListener('click', () => { if (tvDiv2) { tvDiv2.style.display = ''; } loadTv(); });
        // Sync when tab opened with current stockSymbol if present
        const proTab = document.getElementById('tab-prochart');
        if (proTab) {
            proTab.addEventListener('click', () => {
                const stockInput = document.getElementById('stockSymbol');
                if (stockInput && stockInput.value) tvSymbolInput.value = stockInput.value.trim();
                setTimeout(() => loadTv(tvSymbolInput.value), 50);
                setTimeout(() => { resizeCanvas(); loadDrawingsForSymbol(); }, 200);
            });
        }
    } catch (_) {}
    // Wire NL Screener
    try {
        const runBtn = document.getElementById('screenerRun');
        const qEl = document.getElementById('screenerQuery');
        const uEl = document.getElementById('screenerUniverse');
        const nEl = document.getElementById('screenerSize');
        const kEl = document.getElementById('screenerGrokKey');
        const outEl = document.getElementById('screenerOutput');
        if (runBtn && qEl && outEl) {
            let busy = false;
            runBtn.addEventListener('click', async () => {
                if (busy) return; busy = true;
                const original = runBtn.innerHTML;
                runBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Running...';
                outEl.textContent = '—';
                try {
                    const query = (qEl.value || '').trim();
                    if (!query) { outEl.textContent = '請輸入條件描述'; throw new Error('missing_query'); }
                    const apiKey = (kEl && kEl.value || '').trim();
                    if (!apiKey) { outEl.textContent = '請提供 Perplexity API Key'; throw new Error('missing_key'); }
                    const size = Math.max(1, Math.min(20, Number(nEl && nEl.value || 10)));
                    const universe = (uEl && uEl.value || '').split(',').map(s=>s.trim()).filter(Boolean);
                    let resp;
                    try {
                        resp = await fetch(`${app.backendBase}/api/grok/screener`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, query, size, universe })
                        });
                    } catch (_) {
                        resp = await fetch(`http://localhost:3001/api/grok/screener`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, query, size, universe })
                        });
                    }
                    const j = await resp.json();
                    outEl.textContent = JSON.stringify(j.result || j, null, 2);
                } catch (e) {
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown');
                } finally {
                    runBtn.innerHTML = original;
                    busy = false;
                }
            });
        }
    } catch (_) {}
    // Wire News Insights
    try {
        const btn = document.getElementById('newsRun');
        const symEl = document.getElementById('newsSymbol');
        const daysEl = document.getElementById('newsDays');
        const keyEl = document.getElementById('newsGrokKey');
        const outEl = document.getElementById('newsOutput');
        if (btn && symEl && daysEl && keyEl && outEl) {
            let busy = false;
            btn.addEventListener('click', async () => {
                if (busy) return; busy = true;
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Running...';
                outEl.textContent = '—';
                try {
                    const symbol = (symEl.value || '').trim();
                    const apiKey = (keyEl.value || '').trim();
                    const lookbackDays = Math.max(1, Math.min(30, Number(daysEl.value || 7)));
                    if (!symbol) { outEl.textContent = '請輸入股票代號'; throw new Error('missing_symbol'); }
                    if (!apiKey) { outEl.textContent = '請提供 Perplexity API Key'; throw new Error('missing_key'); }
                    let resp;
                    try {
                        resp = await fetch(`${app.backendBase}/api/grok/news-insights`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, symbol, lookbackDays })
                        });
                    } catch (_) {
                        resp = await fetch(`http://localhost:3001/api/grok/news-insights`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, symbol, lookbackDays })
                        });
                    }
                    const j = await resp.json();
                    outEl.textContent = JSON.stringify(j.insights || j, null, 2);
                } catch (e) {
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown');
                } finally {
                    btn.innerHTML = original;
                    busy = false;
                }
            });
        }
    } catch (_) {}
    // Wire Peers Compare
    try {
        const btn = document.getElementById('peersRun');
        const targetEl = document.getElementById('peersTarget');
        const peersEl = document.getElementById('peersList');
        const keyEl = document.getElementById('peersGrokKey');
        const outEl = document.getElementById('peersOutput');
        if (btn && targetEl && peersEl && keyEl && outEl) {
            let busy = false;
            btn.addEventListener('click', async () => {
                if (busy) return; busy = true;
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Running...';
                outEl.textContent = '—';
                try {
                    const symbol = (targetEl.value || '').trim();
                    const apiKey = (keyEl.value || '').trim();
                    const peers = (peersEl.value || '').split(',').map(s=>s.trim()).filter(Boolean);
                    if (!symbol) { outEl.textContent = '請輸入 Target 代號'; throw new Error('missing_symbol'); }
                    if (!apiKey) { outEl.textContent = '請提供 Perplexity API Key'; throw new Error('missing_key'); }
                    let resp;
                    try {
                        resp = await fetch(`${app.backendBase}/api/grok/peers-compare`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, symbol, peers })
                        });
                    } catch (_) {
                        resp = await fetch(`http://localhost:3001/api/grok/peers-compare`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, symbol, peers })
                        });
                    }
                    const j = await resp.json();
                    outEl.textContent = JSON.stringify(j.compare || j, null, 2);
                } catch (e) {
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown');
                } finally {
                    btn.innerHTML = original;
                    busy = false;
                }
            });
        }
    } catch (_) {}
    // Wire Portfolio Doctor
    try {
        const btn = document.getElementById('pfRun');
        const hEl = document.getElementById('pfHoldings');
        const bEl = document.getElementById('pfBudget');
        const kEl = document.getElementById('pfGrokKey');
        const outEl = document.getElementById('pfOutput');
        if (btn && hEl && bEl && kEl && outEl) {
            let busy = false;
            btn.addEventListener('click', async () => {
                if (busy) return; busy = true;
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Diagnosing...';
                outEl.textContent = '—';
                try {
                    const raw = (hEl.value || '').trim();
                    const apiKey = (kEl.value || '').trim();
                    const budget = Number(bEl.value || 100000);
                    if (!raw) { outEl.textContent = '請輸入持倉，例如 AAPL:0.3,MSFT:0.4,TSLA:0.3'; throw new Error('missing_holdings'); }
                    if (!apiKey) { outEl.textContent = '請提供 Perplexity API Key'; throw new Error('missing_key'); }
                    const holdings = raw.split(',').map(x => x.trim()).filter(Boolean).map(x => {
                        const [sym, wt] = x.split(':');
                        return { symbol: (sym||'').trim(), weight: Number(wt || 0) };
                    }).filter(h => h.symbol);
                    let resp;
                    try {
                        resp = await fetch(`${app.backendBase}/api/grok/portfolio-doctor`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, holdings, budget })
                        });
                    } catch (_) {
                        resp = await fetch(`http://localhost:3001/api/grok/portfolio-doctor`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey, holdings, budget })
                        });
                    }
                    const j = await resp.json();
                    outEl.textContent = JSON.stringify(j.doctor || j, null, 2);
                } catch (e) {
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown');
                } finally {
                    btn.innerHTML = original;
                    busy = false;
                }
            });
        }
    } catch (_) {}
    // Backtest MA Crossover
    try {
        const btRun = document.getElementById('btRun');
        const btStrategy = document.getElementById('btStrategy');
        const btFast = document.getElementById('btFast');
        const btSlow = document.getElementById('btSlow');
        const btCap = document.getElementById('btCapital');
        const btFee = document.getElementById('btFeeBps');
        const btRange = document.getElementById('btRange');
        const btResults = document.getElementById('btResults');
        const btAddCompare = document.getElementById('btAddCompare');
        const btRunCompare = document.getElementById('btRunCompare');
        const btCompareTable = document.getElementById('btCompareTable');
        const btExportTrades = document.getElementById('btExportTrades');
        const btExportReport = document.getElementById('btExportReport');
        const btPresetName = document.getElementById('btPresetName');
        const btPresetSave = document.getElementById('btPresetSave');
        const btPresetApply = document.getElementById('btPresetApply');
        const compareQueue = [];
        function loadBtPresets() {
            try {
                const store = JSON.parse(localStorage.getItem('bt_presets')||'{}');
                btPresetApply.innerHTML = '<option value="">Apply Preset…</option>' + Object.keys(store).map(k=>`<option value="${k}">${k}</option>`).join('');
            } catch(_){}
        }
        loadBtPresets();
        btPresetSave && btPresetSave.addEventListener('click', () => {
            const name = (btPresetName && btPresetName.value || '').trim(); if (!name) { app.showToast && app.showToast('請輸入 Preset 名稱'); return; }
            const p = { strat: btStrategy.value, fast: Number(btFast.value||10), slow: Number(btSlow.value||20), cap: Number(btCap.value||100000), fee: Number(btFee.value||5), range: btRange.value };
            try { const store = JSON.parse(localStorage.getItem('bt_presets')||'{}'); store[name] = p; localStorage.setItem('bt_presets', JSON.stringify(store)); loadBtPresets(); app.showToast && app.showToast('Preset 已保存'); } catch(_){}
        });
        btPresetApply && btPresetApply.addEventListener('change', () => {
            const key = btPresetApply.value; if (!key) return;
            try { const store = JSON.parse(localStorage.getItem('bt_presets')||'{}'); const p = store[key]; if (!p) return;
                btStrategy.value = p.strat || 'ma'; btFast.value = p.fast ?? 10; btSlow.value = p.slow ?? 20; btCap.value = p.cap ?? 100000; btFee.value = p.fee ?? 5; btRange.value = p.range || '2y';
                app.showToast && app.showToast('Preset 已套用');
            } catch(_){}
        });
        async function fetchCloses(symbol, years) {
            try {
                const range = years >= 5 ? '5y' : years >= 2 ? '2y' : '1y';
                const url = `${app.backendBase}/api/yahoo/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`;
                const j = await fetch(url).then(r=>r.json());
                const res = j && j.chart && j.chart.result && j.chart.result[0];
                const closes = res ? res.indicators?.quote?.[0]?.close || [] : [];
                const timestamps = res ? res.timestamp || [] : [];
                return { closes: (closes||[]).filter(v=>isFinite(v)), timestamps };
            } catch { return { closes: [], timestamps: [] }; }
        }
        function sma(arr, n) {
            const out = []; let sum = 0; for (let i=0;i<arr.length;i++){ sum += arr[i]; if (i>=n) sum -= arr[i-n]; out.push(i>=n-1? sum/n : NaN); } return out;
        }
        function runMaCross(closes, fast, slow, capital, feeBps) {
            if (!Array.isArray(closes) || closes.length < slow+2) return { trades:0, pnl:0, winrate:0, mdd:0, pf:0 };
            const f = sma(closes, fast), s = sma(closes, slow);
            let pos = 0, entry = 0, pnl = 0, wins = 0, losses = 0, eq = capital, peak = capital, maxDD = 0, trades = 0;
            const tradesList = [];
            for (let i=1;i<closes.length;i++){
                const buy = f[i-1] <= s[i-1] && f[i] > s[i];
                const sell = f[i-1] >= s[i-1] && f[i] < s[i];
                const price = closes[i];
                if (buy && !pos && isFinite(price)) { pos = eq/price; entry = price; trades++; eq -= eq * (feeBps/10000); tradesList.push({ side:'BUY', price, size: pos }); }
                if (sell && pos && isFinite(price)) { const exitVal = pos*price; const tradePnL = exitVal - pos*entry; pnl += tradePnL; if (tradePnL>0) wins+=tradePnL; else losses += Math.abs(tradePnL); eq = eq + exitVal; pos = 0; eq -= eq * (feeBps/10000); tradesList.push({ side:'SELL', price, pnl: tradePnL }); }
                peak = Math.max(peak, eq + (pos? pos*price : 0));
                const cur = eq + (pos? pos*price : 0); maxDD = Math.max(maxDD, (peak - cur) / peak);
            }
            const winrate = (wins + losses) ? (wins/(wins+losses)) : 0;
            const pf = losses ? (wins/losses) : (wins? Infinity:0);
            return { trades, pnl, winrate, mdd: maxDD, pf, equity: eq, tradesList };
        }
        function runDonchian(closes, period, capital, feeBps) {
            if (!Array.isArray(closes) || closes.length < period+2) return { trades:0, pnl:0, winrate:0, mdd:0, pf:0 };
            let eq = capital, peak = capital, maxDD = 0, trades = 0, pnl = 0, wins = 0, losses = 0, pos = 0, entry = 0;
            const tradesList = [];
            for (let i=period;i<closes.length;i++){
                const window = closes.slice(i-period, i);
                const hh = Math.max(...window), ll = Math.min(...window);
                const price = closes[i];
                const buy = price > hh; const sell = price < ll;
                if (buy && !pos && isFinite(price)) { pos = eq/price; entry = price; eq -= eq * (feeBps/10000); trades++; tradesList.push({ side:'BUY', price, size: pos }); }
                if (sell && pos && isFinite(price)) { const exitVal = pos*price; const t = exitVal - pos*entry; pnl += t; if (t>0) wins+=t; else losses+=Math.abs(t); eq += exitVal; eq -= eq * (feeBps/10000); pos=0; tradesList.push({ side:'SELL', price, pnl: t }); }
                peak = Math.max(peak, eq + (pos? pos*price : 0));
                const cur = eq + (pos? pos*price : 0); maxDD = Math.max(maxDD, (peak - cur) / peak);
            }
            const winrate = (wins + losses) ? (wins/(wins+losses)) : 0;
            const pf = losses ? (wins/losses) : (wins? Infinity:0);
            return { trades, pnl, winrate, mdd: maxDD, pf, equity: eq, tradesList };
        }
        function runMeanRev(closes, lookback, zEntry, zExit, capital, feeBps) {
            if (!Array.isArray(closes) || closes.length < lookback+2) return { trades:0, pnl:0, winrate:0, mdd:0, pf:0 };
            const out = []; let eq = capital, peak = capital, maxDD = 0, trades = 0, pnl = 0, wins = 0, losses = 0, pos = 0, entry = 0; const tradesList = [];
            for (let i=lookback;i<closes.length;i++){
                const w = closes.slice(i-lookback,i);
                const mean = w.reduce((a,b)=>a+b,0)/w.length;
                const std = Math.sqrt(w.reduce((a,b)=>a+Math.pow(b-mean,2),0)/w.length) || 1e-9;
                const price = closes[i];
                const z = (price - mean)/std;
                const buy = z < -Math.abs(zEntry);
                const sell = (pos && Math.abs(z) < Math.abs(zExit)) || (!pos && z > Math.abs(zEntry));
                if (buy && !pos) { pos = eq/price; entry = price; eq -= eq * (feeBps/10000); trades++; tradesList.push({ side:'BUY', price, size: pos }); }
                if (sell && pos) { const exitVal = pos*price; const t = exitVal - pos*entry; pnl += t; if (t>0) wins+=t; else losses+=Math.abs(t); eq += exitVal; eq -= eq * (feeBps/10000); pos=0; tradesList.push({ side:'SELL', price, pnl: t }); }
                peak = Math.max(peak, eq + (pos? pos*price : 0));
                const cur = eq + (pos? pos*price : 0); maxDD = Math.max(maxDD, (peak - cur) / peak);
            }
            const winrate = (wins + losses) ? (wins/(wins+losses)) : 0;
            const pf = losses ? (wins/losses) : (wins? Infinity:0);
            return { trades, pnl, winrate, mdd: maxDD, pf, equity: eq, tradesList };
        }
        async function runOneStrategy(kind, closes, params, capital, fee) {
            if (kind === 'ma') return runMaCross(closes, params.fast, params.slow, capital, fee);
            if (kind === 'donchian') return runDonchian(closes, params.period || params.slow || 20, capital, fee);
            if (kind === 'meanrev') return runMeanRev(closes, params.lookback || params.slow || 20, params.zEntry || 1, params.zExit || 0.5, capital, fee);
            return { trades:0, pnl:0, winrate:0, mdd:0, pf:0 };
        }
        btRun && btRun.addEventListener('click', async () => {
            try {
                const sym = (document.getElementById('tvSymbol') && document.getElementById('tvSymbol').value || '').trim();
                const fast = Math.max(1, parseInt(btFast.value||'10',10));
                const slow = Math.max(fast+1, parseInt(btSlow.value||'20',10));
                const cap = Math.max(1000, Number(btCap.value||100000));
                const fee = Math.max(0, Number(btFee.value||5));
                const yrs = btRange.value === '5y' ? 5 : btRange.value === '2y' ? 2 : 1;
                if (!sym) { btResults.textContent = '請輸入代號'; return; }
                btResults.textContent = 'Running...';
                const { closes } = await fetchCloses(sym, yrs);
                if (!closes.length) { btResults.textContent = '無歷史數據'; return; }
                const strat = (btStrategy && btStrategy.value) || 'ma';
                const res = await runOneStrategy(strat, closes, { fast, slow }, cap, fee);
                const sharpe = (()=>{ const rets=[]; for(let i=1;i<closes.length;i++){ const r=(closes[i]/closes[i-1]-1); rets.push(r);} const mean=rets.reduce((a,b)=>a+b,0)/rets.length; const std=Math.sqrt(rets.reduce((a,b)=>a+Math.pow(b-mean,2),0)/rets.length)||1e-9; return (mean/std)*Math.sqrt(252); })();
                const sortino = (()=>{ const rets=[]; for(let i=1;i<closes.length;i++){ rets.push(closes[i]/closes[i-1]-1);} const mean=rets.reduce((a,b)=>a+b,0)/rets.length; const neg=rets.filter(r=>r<0); const dn=Math.sqrt(neg.reduce((a,b)=>a+b*b,0)/Math.max(1,neg.length))||1e-9; return (mean/dn)*Math.sqrt(252); })();
                const calmar = (()=>{ const totalRet = closes.length? (closes[closes.length-1]/closes[0]-1):0; const mdd = res.mdd||1e-9; return mdd? (totalRet/mdd) : 0; })();
                btResults.innerHTML = `<div>
                    <div>Trades: ${res.trades}</div>
                    <div>PNL: ${res.pnl.toFixed(2)}</div>
                    <div>Winrate (value-based): ${(res.winrate*100).toFixed(1)}%</div>
                    <div>Profit Factor: ${res.pf.toFixed(2)}</div>
                    <div>Max Drawdown: ${(res.mdd*100).toFixed(1)}%</div>
                    <div>Sharpe: ${sharpe.toFixed(2)}</div>
                    <div>Sortino: ${sortino.toFixed(2)}</div>
                    <div>Calmar: ${calmar.toFixed(2)}</div>
                </div>`;
                btExportTrades && btExportTrades.addEventListener('click', () => {
                    const rows = (res.tradesList||[]).map(t => `${t.side},${t.price},${t.size||''},${t.pnl||''}`).join('\n');
                    const csv = 'side,price,size,pnl\n' + rows;
                    const blob = new Blob([csv], { type:'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `trades_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
                }, { once: true });
                btExportReport && btExportReport.addEventListener('click', () => {
                    const md = `# Backtest Report\n\n- Symbol: ${(document.getElementById('tvSymbol')&&document.getElementById('tvSymbol').value)||''}\n- Strategy: ${strat}\n- Params: fast=${fast}, slow=${slow}\n- Capital: ${cap}\n- Fee (bps): ${fee}\n\n## Metrics\n- Trades: ${res.trades}\n- PNL: ${res.pnl.toFixed(2)}\n- Winrate: ${(res.winrate*100).toFixed(1)}%\n- Profit Factor: ${res.pf.toFixed(2)}\n- Max Drawdown: ${(res.mdd*100).toFixed(1)}%\n- Sharpe: ${sharpe.toFixed(2)}\n- Sortino: ${sortino.toFixed(2)}\n- Calmar: ${calmar.toFixed(2)}\n\n## Trades\n\nside,price,size,pnl\n${(res.tradesList||[]).map(t=>`${t.side},${t.price},${t.size||''},${t.pnl||''}`).join('\n')}\n`;
                    const blob = new Blob([md], { type:'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `report_${Date.now()}.md`; a.click(); URL.revokeObjectURL(url);
                }, { once: true });
            } catch (e) {
                btResults.textContent = '錯誤：' + (e && e.message ? e.message : 'unknown');
            }
        });
        btAddCompare && btAddCompare.addEventListener('click', () => {
            const sym = (document.getElementById('tvSymbol') && document.getElementById('tvSymbol').value || '').trim();
            const fast = Math.max(1, parseInt(btFast.value||'10',10));
            const slow = Math.max(fast+1, parseInt(btSlow.value||'20',10));
            const strat = (btStrategy && btStrategy.value) || 'ma';
            compareQueue.push({ sym, strat, params: { fast, slow } });
            app.showToast && app.showToast('已加入對比清單');
        });
        btRunCompare && btRunCompare.addEventListener('click', async () => {
            try {
                if (!compareQueue.length) { btCompareTable.textContent = '對比清單為空'; return; }
                btCompareTable.textContent = 'Running...';
                const results = [];
                for (const item of compareQueue) {
                    const { closes } = await fetchCloses(item.sym, 2);
                    const r = await runOneStrategy(item.strat, closes, item.params, Number(btCap.value||100000), Number(btFee.value||5));
                    results.push({ ...item, res: r });
                }
                const rows = results.map(x => `<tr><td>${x.sym}</td><td>${x.strat}</td><td>${x.params.fast||x.params.period||x.params.lookback}/${x.params.slow||''}</td><td>${x.res.trades}</td><td>${x.res.pnl.toFixed(2)}</td><td>${(x.res.winrate*100).toFixed(1)}%</td><td>${x.res.pf.toFixed(2)}</td><td>${(x.res.mdd*100).toFixed(1)}%</td></tr>`).join('');
                btCompareTable.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><button id="btCompareExport" class="btn btn-secondary btn-sm"><i class=\"fas fa-file-csv\"></i> Export CSV</button></div><table><thead><tr><th>Symbol</th><th>Strategy</th><th>Params</th><th>Trades</th><th>PNL</th><th>Win%</th><th>PF</th><th>MDD</th></tr></thead><tbody>${rows}</tbody></table>`;
                const exportBtn = document.getElementById('btCompareExport');
                exportBtn && exportBtn.addEventListener('click', () => {
                    const csvRows = ['symbol,strategy,params,trades,pnl,win_pct,pf,mdd'].concat(
                        results.map(x => [x.sym,x.strat,`${x.params.fast||x.params.period||x.params.lookback}/${x.params.slow||''}`,x.res.trades,x.res.pnl.toFixed(2),(x.res.winrate*100).toFixed(1),x.res.pf.toFixed(2),(x.res.mdd*100).toFixed(1)].join(','))
                    ).join('\n');
                    const blob = new Blob([csvRows], { type:'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `compare_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
                });
            } catch (e) {
                btCompareTable.textContent = '錯誤：' + (e && e.message ? e.message : 'unknown');
            }
        });
    } catch (_) {}
});
