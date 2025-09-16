// Stock Prediction App - Modern JavaScript Architecture (Frontend-Only Version)
class StockPredictionApp {
    constructor() {
        // Deprecated Alpha Vantage proxy; keep for fallback only
        this.apiUrl = '/api/alphavantage';
        this.backendBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
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
        // Live ticker initial
        this.updateTickerBar({});
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
        container.innerHTML = '<p>載入中…</p>';

        try {
            // Use backend aggregated insights if available
            const defaultSymbols = ['NVDA','PLTR','MSFT','GOOGL','9988.HK','0700.HK','AVGO','AMD','IONQ','LLY','ABBV'];
            const qs = encodeURIComponent(defaultSymbols.join(','));
            const resp = await fetch(`/api/market/insights?symbols=${qs}`);
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
                container.innerHTML = this.buildMarketDashboardTemplate(seriesMap);
                return;
            }
        } catch (e) {
            // Proceed to client-side aggregation fallback
        }

        // Fallback: build from Yahoo Finance only (no mock)
        try {
            const symbols = ['NVDA','PLTR','MSFT','GOOGL','9988.HK','0700.HK','AVGO','AMD','IONQ','LLY','ABBV'];
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
            container.innerHTML = this.buildMarketDashboardTemplate(series);
            return;
        } catch (_) {
            container.innerHTML = this.buildMarketDashboardTemplate();
        }
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

    buildMarketDashboardTemplate(liveSeries) {
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
        return `
            <div class="result-section">
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
        if (!this.validateForm(formData)) return;

        this.showLoading(true);
        this.clearResults();
        this.showToast('正在同步 Yahoo 真實數據...', 'info');

        try {
            // Fetch Yahoo historical closes first
            let fetchReason = '';
            let ts = await this.fetchYahooHistorical(formData.symbol, '3mo');
            if (!ts || !Array.isArray(ts.closes)) {
                fetchReason = 'yahoo_parse_3mo';
                ts = { dates: [], closes: [], volumes: [] };
            }
            let closes = (ts.closes || []).filter(v => isFinite(v) && v > 0);
            let dates = ts.dates || [];
            if (closes.length < 100) {
                const ts6 = await this.fetchYahooHistorical(formData.symbol, '6mo');
                const closes6 = (ts6?.closes || []).filter(v => isFinite(v) && v > 0);
                if (closes6.length >= 30) {
                    closes = closes6;
                    dates = ts6.dates || dates;
                } else {
                    fetchReason = fetchReason || 'yahoo_insufficient_3_6mo';
                }
            }
            // Skip Alpha Vantage fallback; rely on Yahoo only
            if (closes.length < 30) {
                console.error('Data fetch failed; reason:', fetchReason, 'symbol:', formData.symbol);
                throw new Error('Data fetch failed, try again');
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
            // Auto request Grok analysis with the fetched series
            try {
                const ga = await fetch(`${this.backendBase}/api/grok/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: formData.symbol, series: { dates, closes, volumes: ts.volumes || [] } })
                });
                const gag = await ga.json();
                const el = document.getElementById('grokAutoOutput');
                if (el) el.textContent = JSON.stringify(gag.analysis || gag, null, 2);
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
            apiKey: document.getElementById('apiKey').value.trim(),
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
        const fundamentals = await dataFetcher.fetchFundamentals(formData.symbol, formData.apiKey);
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
            'JUMP': '/api/sim/jump',
            'HESTON': '/api/sim/heston',
            'GARCH': '/api/sim/garch'
        };

        const endpoint = modelEndpoints[formData.model];
        if (!endpoint) {
            throw new Error('Invalid model selected');
        }

        try {
            const response = await fetch(`${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    closes: closes,
                    days: formData.days,
                    paths: Math.min(formData.paths, 8000)
                })
            });

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }

            return {
                paths: [],
                quantiles: result,
                model: result.model,
                parameters: result.parameters
            };
        } catch (error) {
            console.warn('Advanced simulation failed, falling back to GBM:', error);
            return this.runGBMSimulation(closes, formData, metrics);
        }
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
            const response = await fetch('/api/monitor/status');
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
            const url = `/api/yahoo/quote?symbol=${encodeURIComponent(symbol)}`;
            const resp = await fetch(url);
            const data = await resp.json();
            const r = data?.quoteResponse?.result?.[0] || data?.quoteResponse?.result?.[0];
            if (!r) throw new Error('No quote');
            const price = r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice;
            return { price: Number(price), currency: r.currency };
        };
        return await this.withBackoff(fetchOnce, 3).catch(() => ({ price: NaN }));
    }

    async fetchYahooQuotesBatch(symbols) {
        const fetchOnce = async () => {
            const list = symbols.join(',');
            const url = `/api/yahoo/quote?symbol=${encodeURIComponent(list)}`;
            const resp = await fetch(url);
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
            const url = `/api/yahoo/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=1d`;
            const resp = await fetch(url);
            const data = await resp.json();
            const r = data?.chart?.result?.[0];
            if (!r) throw new Error('no_result');
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
            const out = { dates, closes, volumes, opens, highs, lows };
            return out;
        };
        let out;
        try { out = await this.withBackoff(fetchOnce, 3); }
        catch (e) {
            // Alpha fallback
            try {
                const df = new DataFetcher(this.apiUrl);
                const apiKey = (document.getElementById('apiKey')?.value || '').trim();
                const av = await df.fetchStockData(symbol, apiKey);
                let closes = (av?.closes||[]).filter(v=>isFinite(v)&&v>0);
                const mean = closes.reduce((a,b)=>a+b,0)/Math.max(1,closes.length);
                const std = Math.sqrt(closes.reduce((s,v)=>s+Math.pow(v-mean,2),0)/Math.max(1,closes.length));
                closes = closes.filter(v => Math.abs(v-mean) <= 3*(std||1));
                out = { dates: av.dates||[], closes, volumes: av.volumes||[] };
            } catch (_) { out = { dates: [], closes: [], volumes: [] }; }
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
    }

    async fetchStockData(symbol, apiKey) {
        const params = new URLSearchParams({
            function: 'TIME_SERIES_DAILY',
            symbol: symbol,
            outputsize: 'full'
        });

        if (apiKey) params.set('apikey', apiKey);

        const backendUrl = `${this.apiUrl}?${params}`;
        try {
            let response = await this.fetchWithTimeout(backendUrl);
            if (response.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
                response = await this.fetchWithTimeout(backendUrl);
            }
            const data = await response.json();
            if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                throw new Error(msg);
            }
            return this.parseTimeSeries(data);
        } catch (err) {
            const isNetworkish = err && (err.name === 'AbortError' || (typeof err.message === 'string' && err.message.includes('Failed to fetch')) || err instanceof TypeError);
            const canDirect = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0;
            if (!isNetworkish || !canDirect) throw err;
            // Direct Alpha Vantage fallback
            const directUrl = `https://www.alphavantage.co/query?${params}`;
            let response = await this.fetchWithTimeout(directUrl);
            if (response.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
                response = await this.fetchWithTimeout(directUrl);
            }
            const data = await response.json();
            if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                throw new Error(msg);
            }
            return this.parseTimeSeries(data);
        }
    }

    async fetchQuote(symbol, apiKey) {
        const params = new URLSearchParams({
            function: 'GLOBAL_QUOTE',
            symbol: symbol
        });
        if (apiKey) params.set('apikey', apiKey);
        const response = await this.fetchWithTimeout(`${this.apiUrl}?${params}`);
        const data = await response.json();
        const q = data && data['Global Quote'];
        const price = q ? parseFloat(q['05. price']) : NaN;
        return { symbol, price };
    }

    async fetchFundamentals(symbol, apiKey) {
        try {
            const overview = await this.fetchAlphaVantageData('OVERVIEW', symbol, apiKey);
            const balanceSheet = await this.fetchAlphaVantageData('BALANCE_SHEET', symbol, apiKey);
            const cashFlow = await this.fetchAlphaVantageData('CASH_FLOW', symbol, apiKey);

            return this.parseFundamentals(overview, balanceSheet, cashFlow);
        } catch (error) {
            console.warn('Failed to fetch fundamentals:', error);
            return {};
        }
    }

    async fetchAlphaVantageData(functionName, symbol, apiKey) {
        const params = new URLSearchParams({ function: functionName, symbol });
        if (apiKey) params.set('apikey', apiKey);
        const backendUrl = `${this.apiUrl}?${params}`;
        try {
            let response = await this.fetchWithTimeout(backendUrl);
            if (response.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
                response = await this.fetchWithTimeout(backendUrl);
            }
            const data = await response.json();
            if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                throw new Error(msg);
            }
            return data;
        } catch (err) {
            const isNetworkish = err && (err.name === 'AbortError' || (typeof err.message === 'string' && err.message.includes('Failed to fetch')) || err instanceof TypeError);
            const canDirect = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0;
            if (!isNetworkish || !canDirect) throw err;
            const directUrl = `https://www.alphavantage.co/query?${params}`;
            let response = await this.fetchWithTimeout(directUrl);
            if (response.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
                response = await this.fetchWithTimeout(directUrl);
            }
            const data = await response.json();
            if (!response.ok || data['Error Message'] || data['Information'] || data.error) {
                const msg = data.error || data['Error Message'] || data['Information'] || `HTTP ${response.status}`;
                throw new Error(msg);
            }
            return data;
        }
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
    // Wire Grok AI minimal client
    try {
        const btn = document.getElementById('grokBtn');
        const promptEl = document.getElementById('grokPrompt');
        const outEl = document.getElementById('grokOutput');
        if (btn && promptEl && outEl) {
            let busy = false;
            btn.addEventListener('click', async () => {
                if (busy) return;
                const userText = (promptEl.value || '').trim();
                if (!userText) { outEl.textContent = '請先輸入提示內容'; return; }
                busy = true;
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 等待 Grok 回覆...';
                outEl.textContent = '';
                try {
                    const resp = await fetch('/api/grok/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'grok-2-latest',
                            messages: [
                                { role: 'system', content: 'You are a helpful financial analysis assistant.' },
                                { role: 'user', content: userText }
                            ]
                        })
                    });
                    const data = await resp.json();
                    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                        || data?.message
                        || JSON.stringify(data, null, 2);
                    outEl.textContent = text;
                } catch (e) {
                    outEl.textContent = '發生錯誤：' + (e && e.message ? e.message : 'unknown');
                } finally {
                    btn.innerHTML = original;
                    busy = false;
                }
            });
        }
    } catch (_) {}
    // Register service worker only on http(s)
    if ('serviceWorker' in navigator) {
        try {
            const proto = (location.protocol || '').toLowerCase();
            if (proto === 'http:' || proto === 'https:') {
                navigator.serviceWorker.register('/sw.js').catch(()=>{});
            }
        } catch (_) {}
    }
});
