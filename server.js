const express = require('express');
const cors = require('cors');
const https = require('https');
const dotenv = require('dotenv');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { MultiUserSystem, authenticateToken, requirePermission, createRateLimit } = require('./multi_user_system');
const SecurityMiddleware = require('./security_middleware');
// Try to load SupabaseUserManager first, then fallback to PostgreSQL, then SQLite UserManager
let UserManager = null;
try {
  // Try Supabase UserManager first
  UserManager = require('./auth/supabaseUserManager');
  console.log('✅ Using Supabase UserManager');
} catch (supabaseError) {
  console.warn('Supabase UserManager not available, trying PostgreSQL:', supabaseError.message);
  try {
    // Try PostgreSQL UserManager second
    UserManager = require('./auth/postgresUserManager');
    console.log('✅ Using PostgreSQL UserManager');
  } catch (pgError) {
    console.warn('PostgreSQL UserManager not available, trying SQLite:', pgError.message);
    try {
      UserManager = require('./auth/userManager');
      console.log('✅ Using SQLite UserManager');
    } catch (sqliteError) {
      console.warn('UserManager not available:', sqliteError.message);
      console.warn('Multi-user features will be disabled. Using legacy authentication.');
    }
  }
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const FMP_KEY = process.env.FMP_API_KEY || '';
const POLYGON_KEY = process.env.POLYGON_API_KEY || '';
// Deprecated xAI config removed in favor of OpenRouter-only
const XAI_API_KEY = '';
const XAI_API_BASE = '';
const XAI_MODEL = '';
const XAI_FALLBACK_API_BASE = '';
const XAI_FALLBACK_MODEL = '';
// Perplexity API (LLM provider)
const PERPLEXITY_API_KEY = (process.env.PERPLEXITY_API_KEY || '').trim();
const PERPLEXITY_MODEL = (process.env.PERPLEXITY_MODEL || 'sonar-pro').trim();
const AUTH_USER = (process.env.AUTH_USER || 'admin').toString();
const AUTH_PASS = (process.env.AUTH_PASS || process.env.AUTH_PASSWORD || '').toString();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || (12 * 60 * 60 * 1000));

// Initialize User Manager (if available)
let userManager = null;
if (UserManager) {
  try {
    userManager = new UserManager();
    
    // If using PostgreSQL or Supabase, create tables if they don't exist
    if (userManager.constructor.name === 'PostgresUserManager' || userManager.constructor.name === 'SupabaseUserManager') {
      userManager.createTables().catch(error => {
        console.warn('Failed to create database tables:', error.message);
      });
    }
  } catch (error) {
    console.warn('Failed to initialize UserManager:', error.message);
    userManager = null;
  }
}

// Minimal in-memory session store (fallback)
const sessions = new Map(); // token -> { user, exp }
function parseCookies(req) {
  const header = req.headers['cookie'] || '';
  const out = {};
  header.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}
async function getSession(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['sp_session'];
    if (!token) return null;

    // Try database session first (if userManager is available)
    if (userManager) {
      try {
        const dbSession = await userManager.getSession(token);
        if (dbSession) {
          return { 
            token, 
            user: { 
              id: dbSession.user_id,
              username: dbSession.username, 
              email: dbSession.email,
              full_name: dbSession.full_name,
              role: dbSession.role 
            } 
          };
        }
      } catch (dbError) {
        console.warn('Database session check failed, falling back to memory:', dbError.message);
      }
    }

    // Fallback to memory sessions
    const rec = sessions.get(token);
    if (!rec) return null;
    if (Date.now() > rec.exp) { sessions.delete(token); return null; }
    return { token, user: rec.user };
  } catch { return null; }
}
async function authRequired(req, res, next) {
  try {
    const sess = await getSession(req);
    if (sess) {
      req.user = sess.user;
      return next();
    }
    // redirect to login preserving destination
    const dest = encodeURIComponent(req.originalUrl || '/predictor');
    return res.redirect(`/login?next=${dest}`);
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Grok ops helpers: rate limit, coalescing, telemetry, safety
const RL_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RL_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
const rateMap = new Map(); // key -> { windowStart, count }
const grokPending = new Map(); // key -> Promise
const metrics = { routes: {}, startedAt: new Date().toISOString() };
// Prompt templates in-memory admin
let promptTemplates = {
  versions: {
    v1: { 
      analyst: '你係一名擁有超過30年數學博士學位經驗的專業投資者同樣係最高級既程式員，專注於量化金融、隨機過程和機器學習模型在投資決策中的應用。分析方法強調多路徑評估：結合基本面（財務數據）、技術指標（歷史價格模式）、情緒指標（新聞和社交媒體）、以及數學模型（如蒙特卡洛模擬和時間序列預測），以捕捉不確定性並提供概率性洞見。', 
      risk: '聚焦風險與應對，運用量化模型評估不確定性。', 
      news: '整合新聞與情緒分析，提供概率性洞見。', 
      screener: '運用量化篩選條件，基於數學模型提供候選股票。' 
    }
  },
  active: 'v1',
  ab: { v1: 100 }
};

function recordMetric(route, ms, ok) {
  const r = metrics.routes[route] || (metrics.routes[route] = { requests: 0, errors: 0, avgMs: 0 });
  r.requests += 1;
  if (!ok) r.errors += 1;
  // incremental average
  r.avgMs = r.avgMs + (ms - r.avgMs) / r.requests;
}

function rateLimitOk(ip, route) {
  const key = `${ip || 'unknown'}|${route}`;
  const now = Date.now();
  let rec = rateMap.get(key);
  if (!rec || (now - rec.windowStart) > RL_WINDOW_MS) {
    rec = { windowStart: now, count: 0 };
  }
  rec.count += 1;
  rateMap.set(key, rec);
  return rec.count <= RL_MAX;
}

function containsUnsafe(text) {
  if (!text) return false;
  const t = (text + '').toLowerCase();
  const banned = ['jailbreak','ignore previous','disregard previous','system prompt','prompt injection'];
  return banned.some(w => t.includes(w));
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(m => {
    if (m && typeof m.content === 'string' && containsUnsafe(m.content)) {
      return { ...m, content: 'User content removed due to safety policy.' };
    }
    return m;
  });
}

// Provider selection (Perplexity API)
function chooseProvider(req, providedKey) {
  return {
    name: 'perplexity',
    apiKey: PERPLEXITY_API_KEY,
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    defaultModel: PERPLEXITY_MODEL
  };
}

app.get('/api/metrics', (req, res) => {
  res.json(metrics);
});

// Templates admin endpoints
app.get('/api/grok/templates', (req, res) => {
  res.json(promptTemplates);
});

app.put('/api/grok/templates', (req, res) => {
  try {
    const body = req.body || {};
    if (body && typeof body === 'object') {
      if (body.versions) promptTemplates.versions = body.versions;
      if (body.active) promptTemplates.active = body.active;
      if (body.ab) promptTemplates.ab = body.ab;
      return res.json({ ok: true, templates: promptTemplates });
    }
    return res.status(400).json({ error: 'invalid_body' });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'templates_error' });
  }
});

// Simple in-memory cache and coalescing
const cache = new Map(); // key -> { ts, status, body }
const pending = new Map(); // key -> Promise
// Lightweight caches for Yahoo to mitigate 429
const yahooQuoteCache = new Map(); // symbol -> { ts, body }
const yahooChartCache = new Map(); // key(symbol|range|interval) -> { ts, body }

function fetchAlphaJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (r) => {
        let stream = r;
        
        // Handle gzip/deflate compression
        if (r.headers['content-encoding'] === 'gzip') {
          stream = r.pipe(zlib.createGunzip());
        } else if (r.headers['content-encoding'] === 'deflate') {
          stream = r.pipe(zlib.createInflate());
        } else if (r.headers['content-encoding'] === 'br') {
          stream = r.pipe(zlib.createBrotliDecompress());
        }
        
        let data = '';
        stream.on('data', (chunk) => (data += chunk));
        stream.on('end', () => resolve({ status: r.statusCode || 200, body: data }));
        stream.on('error', (e) => reject(e));
      })
      .on('error', (e) => reject(e));
  });
}

function fetchJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      port: u.port || 443,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://finance.yahoo.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...extraHeaders,
      },
    };
    
    const req2 = https.request(options, (r) => {
      let stream = r;
      
      // Handle gzip/deflate compression
      if (r.headers['content-encoding'] === 'gzip') {
        stream = r.pipe(zlib.createGunzip());
      } else if (r.headers['content-encoding'] === 'deflate') {
        stream = r.pipe(zlib.createInflate());
      } else if (r.headers['content-encoding'] === 'br') {
        stream = r.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      stream.on('data', (chunk) => (data += chunk));
      stream.on('end', () => resolve({ status: r.statusCode || 200, body: data }));
      stream.on('error', (e) => reject(e));
    });
    
    req2.on('error', (e) => reject(e));
    req2.setTimeout(10000, () => {
      req2.destroy();
      reject(new Error('Request timeout'));
    });
    req2.end();
  });
}

// Global API integration functions
const normalizeSymbol = (s) => {
  if (!s) return s;
  const map = { 'TSMC': 'TSM' };
  if (map[s]) return map[s];
  return s;
};

const fetchQuoteFinnhub = async (symbolRaw) => {
  const symbol = normalizeSymbol(symbolRaw);
  if (!FINNHUB_KEY) return NaN;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
  try {
    const { body } = await fetchJson(url);
    const j = JSON.parse(body);
    const price = j && j.c ? parseFloat(j.c) : undefined;
    return isFinite(price) ? Number(price) : NaN;
  } catch (e) {
    console.error(`Failed to fetch Finnhub quote for ${symbol}:`, e);
    return NaN;
  }
};

const fetchQuoteFMP = async (symbolRaw) => {
  const symbol = normalizeSymbol(symbolRaw);
  if (!FMP_KEY) return NaN;
  const url = `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`;
  try {
    const { body } = await fetchJson(url);
    const j = JSON.parse(body);
    const price = j && j[0] && j[0].price ? parseFloat(j[0].price) : undefined;
    return isFinite(price) ? Number(price) : NaN;
  } catch (e) {
    console.error(`Failed to fetch FMP quote for ${symbol}:`, e);
    return NaN;
  }
};

const fetchQuotePolygon = async (symbolRaw) => {
  const symbol = normalizeSymbol(symbolRaw);
  if (!POLYGON_KEY) return NaN;
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apikey=${POLYGON_KEY}`;
  try {
    const { body } = await fetchJson(url);
    const j = JSON.parse(body);
    const price = j && j.results && j.results[0] && j.results[0].c ? parseFloat(j.results[0].c) : undefined;
    return isFinite(price) ? Number(price) : NaN;
  } catch (e) {
    console.error(`Failed to fetch Polygon quote for ${symbol}:`, e);
    return NaN;
  }
};

const fetchQuoteYahoo = async (symbolRaw) => {
  const symbol = normalizeSymbol(symbolRaw);
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_KEY}`;
  try {
    const { body } = await fetchJson(url);
    const j = JSON.parse(body);
    const r = j && j['Global Quote'];
    const price = r ? parseFloat(r['05. price']) : undefined;
    return isFinite(price) ? Number(price) : NaN;
  } catch (e) {
    console.error(`Failed to fetch or parse quote for ${symbol}:`, e);
    return NaN;
  }
};

// Enhanced quote fetching with fallback chain
const fetchQuoteWithFallback = async (symbolRaw) => {
  const symbol = normalizeSymbol(symbolRaw);
  
  // Try Finnhub first (most reliable for real-time)
  if (FINNHUB_KEY) {
    const finnhubPrice = await fetchQuoteFinnhub(symbol);
    if (isFinite(finnhubPrice)) {
      console.log(`✓ Finnhub quote for ${symbol}: $${finnhubPrice}`);
      return finnhubPrice;
    }
  }
  
  // Try FMP as second option
  if (FMP_KEY) {
    const fmpPrice = await fetchQuoteFMP(symbol);
    if (isFinite(fmpPrice)) {
      console.log(`✓ FMP quote for ${symbol}: $${fmpPrice}`);
      return fmpPrice;
    }
  }
  
  // Try Polygon as third option
  if (POLYGON_KEY) {
    const polygonPrice = await fetchQuotePolygon(symbol);
    if (isFinite(polygonPrice)) {
      console.log(`✓ Polygon quote for ${symbol}: $${polygonPrice}`);
      return polygonPrice;
    }
  }
  
  // Fallback to Alpha Vantage
  const alphaPrice = await fetchQuoteYahoo(symbol);
  if (isFinite(alphaPrice)) {
    console.log(`✓ Alpha Vantage quote for ${symbol}: $${alphaPrice}`);
    return alphaPrice;
  }
  
  console.error(`✗ All quote sources failed for ${symbol}`);
  return NaN;
};

const CORS_PROXIES = [
  'https://cors.isomorphic-git.org/',
  'https://r.jina.ai/'
];

async function tryFetchWithFallback(url) {
  const urlsToTry = [
    url, // Direct first
    ...CORS_PROXIES.map(proxy => `${proxy}${url}`)
  ];

  let lastError = null;

  for (const attemptUrl of urlsToTry) {
    try {
      // Add retry for specific statuses
      const res = await fetchJson(attemptUrl);
      if (res.status === 429 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1500));
        const retryRes = await fetchJson(attemptUrl);
        if (retryRes.status === 200) return retryRes;
      }
      if (res.status === 200) {
        return res;
      }
      lastError = new Error(`Status ${res.status} from ${attemptUrl}`);
    } catch (e) {
      console.error(`Error fetching ${attemptUrl}:`, e);
      lastError = e;
    }
  }

  return { status: 599, body: JSON.stringify({ error: 'network_error_all_proxies', detail: lastError ? lastError.message : 'Unknown error' }) };
}

// Alpha Vantage proxy (TIME_SERIES_* and others) with caching and rate-limit handling
app.get('/api/alphavantage', async (req, res) => {
  try {
    const search = new URLSearchParams(req.query);
    const userKey = (search.get('apikey') || '').trim();
    if (!userKey) {
      if (!ALPHA_KEY) {
        return res.status(400).json({ error: 'No API key provided and ALPHA_VANTAGE_KEY not set on server.' });
      }
      search.set('apikey', ALPHA_KEY);
    }
    const url = `https://www.alphavantage.co/query?${search.toString()}`;

    const now = Date.now();
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const negativeTtlMs = 30 * 1000; // 30 seconds for rate/err

    const cached = cache.get(url);
    if (cached && now - cached.ts < (cached.status === 200 ? ttlMs : negativeTtlMs)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(cached.status).send(cached.body);
    }

    if (pending.has(url)) {
      const result = await pending.get(url);
      res.setHeader('Content-Type', 'application/json');
      return res.status(result.status).send(result.body);
    }

    const p = fetchAlphaJson(url)
      .then(({ status, body }) => {
        let outStatus = status;
        try {
          const obj = JSON.parse(body);
          if (obj && (obj.Information || obj.Note)) {
            outStatus = 429; // rate limit or info
          } else if (obj && obj['Error Message']) {
            outStatus = 400;
          }
        } catch (_) {
          // non-JSON body; leave status
        }
        const record = { ts: Date.now(), status: outStatus, body };
        cache.set(url, record);
        return record;
      })
      .catch(err => {
        console.error(`Failed to fetch from Alpha Vantage URL: ${url}`, err);
        pending.delete(url);
        // Return an error structure that the caller can handle
        return { ts: Date.now(), status: 502, body: JSON.stringify({ error: 'upstream_fetch_failed', details: err.message }) };
      })
      .finally(() => pending.delete(url));
    pending.set(url, p);
    const result = await p;
    res.setHeader('Content-Type', 'application/json');
    return res.status(result.status).send(result.body);
  } catch (e) {
    console.error('Error in /api/alphavantage:', e);
    return res.status(500).json({ error: (e && e.message) || 'Proxy error' });
  }
});

// Batch market insights: unified OHLCV (Alpha) + live price (Enhanced APIs)
app.get('/api/market/insights', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols || '').toString();
    const symbols = symbolsParam
      ? symbolsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : ['NVDA','PLTR','MSFT','GOOGL','9988.HK','0700.HK','AVGO','AMD','IONQ','LLY','ABBV'];

    const fetchChartYahoo = async (symbolRaw) => {
      const symbol = normalizeSymbol(symbolRaw);
      const u1 = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_KEY}&outputsize=compact`;
      try {
        let { status, body } = await tryFetchWithFallback(u1);
        if (status !== 200 || !body) {
          return { ok: false, error: `Failed to fetch chart data for ${symbol}` };
        }
        let j;
        try { j = JSON.parse(body); } catch { return { ok: false, error: 'Invalid JSON in chart response' }; }
        const r = j && j['Time Series (Daily)'];
        if (!r) return { ok: false, error: 'Unexpected chart data structure' };
        const dates = Object.keys(r).sort();
        const closes = dates.map(d => parseFloat(r[d]['4. close']));
        const volumes = dates.map(d => parseFloat(r[d]['5. volume']));
        return { ok: true, dates, closes, volumes };
      } catch (e) {
        console.error(`Exception in fetchChartYahoo for ${symbol}:`, e);
        return { ok: false, error: e.message };
      }
    };

    const series = {};
    const charts = await Promise.all(symbols.map((s) => fetchChartYahoo(s)));
    const quotes = await Promise.all(symbols.map((s) => fetchQuoteWithFallback(s)));
    symbols.forEach((sym, idx) => {
      const ch = charts[idx];
      if (!ch || !ch.ok) {
        console.error(`Could not fetch chart data for ${sym}. Reason:`, ch.error || 'Unknown error');
        return;
      }
      const closes = ch.closes.slice();
      const lp = quotes[idx];
      if (isFinite(lp) && closes.length) {
        closes[closes.length - 1] = lp;
      } else if (!isFinite(lp)) {
          console.warn(`Could not fetch real-time quote for ${sym}. Historical data will be used.`);
      }
      series[sym] = { dates: ch.dates, closes, volumes: ch.volumes };
    });

    return res.json({ symbols, series, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Error in /api/market/insights:', e);
    return res.status(500).json({ error: e.message || 'insights_error' });
  }
});

// Simple monitor endpoint (placeholder)
// Simple monitor job: refresh small watchlist every 5 minutes
const monitorState = { lastRun: null, items: [] };
const WATCHLIST = ['AAPL', 'MSFT', 'TSLA'];

async function refreshWatchlist() {
  const promises = WATCHLIST.map((sym) => {
    const p = new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact', apikey: ALPHA_KEY });
    const url = `https://www.alphavantage.co/query?${p.toString()}`;
    return fetchAlphaJson(url).then(({ status, body }) => {
      try {
        const j = JSON.parse(body);
        const ts = j && j['Time Series (Daily)'];
        if (!ts) return { symbol: sym, ok: false };
        const dates = Object.keys(ts).sort();
        const last = dates[dates.length - 1];
        const prev = dates[dates.length - 2];
        const lastClose = parseFloat(ts[last]['4. close']);
        const prevClose = prev ? parseFloat(ts[prev]['4. close']) : lastClose;
        const dailyReturnPct = prevClose ? ((lastClose / prevClose - 1) * 100) : 0;
        return { symbol: sym, ok: true, lastClose, dailyReturnPct };
      } catch (e) {
        console.error(`Error processing watchlist item ${sym}:`, e);
        return { symbol: sym, ok: false };
      }
    }).catch((err) => {
        console.error(`Error fetching watchlist item ${sym}:`, err);
        return ({ symbol: sym, ok: false })
    });
  });

  monitorState.items = await Promise.all(promises);
  monitorState.lastRun = new Date().toISOString();
}

setInterval(refreshWatchlist, 5 * 60 * 1000);
refreshWatchlist().catch(() => {});

app.get('/api/monitor/status', (req, res) => {
  res.json(monitorState);
});

// Yahoo Finance proxy (quote and chart) to avoid CORS issues on client
app.get('/api/yahoo/quote', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const now = Date.now();
    const ttlMs = 60 * 1000; // 60s cache for quotes
    const cached = yahooQuoteCache.get(symbol);
    if (cached && (now - cached.ts) < ttlMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }
    
    // Try multiple Yahoo Finance endpoints with better error handling
    const endpoints = [
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`
    ];
    
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const { status, body } = await tryFetchWithFallback(endpoint);
        if (status === 200 && body) {
          yahooQuoteCache.set(symbol, { ts: now, body });
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).send(body);
        }
        lastError = `Status ${status}`;
      } catch (e) {
        console.error(`Error fetching Yahoo quote for ${symbol} from ${endpoint}:`, e);
        lastError = e.message;
        continue;
      }
    }
    
    // If all endpoints fail, return a mock response to prevent frontend errors
    const mockResponse = {
      quoteResponse: {
        result: [{
          symbol: symbol,
          shortName: symbol,
          regularMarketPrice: 100.00,
          regularMarketChangePercent: 0.0,
          marketCap: 1000000000,
          currency: 'USD'
        }],
        error: null
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(mockResponse));
  } catch (e) {
    console.error(`Error in /api/yahoo/quote for ${req.query.symbol}:`, e);
    return res.status(500).json({ error: e.message || 'yahoo_quote_error' });
  }
});

app.get('/api/yahoo/chart', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    const range = (req.query.range || '6mo').toString();
    const interval = (req.query.interval || '1d').toString();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const key = `${symbol}|${range}|${interval}`;
    const now = Date.now();
    const ttlMs = 5 * 60 * 1000; // 5 min cache for charts
    const cached = yahooChartCache.get(key);
    if (cached && (now - cached.ts) < ttlMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }
    
    // Try multiple Yahoo Finance chart endpoints
    const endpoints = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includeAdjustedClose=true`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includeAdjustedClose=true`
    ];
    
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const { status, body } = await tryFetchWithFallback(endpoint);
        if (status === 200 && body) {
          yahooChartCache.set(key, { ts: now, body });
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).send(body);
        }
        lastError = `Status ${status}`;
      } catch (e) {
        console.error(`Error fetching Yahoo chart for ${symbol} from ${endpoint}:`, e);
        lastError = e.message;
        continue;
      }
    }
    
    // If all endpoints fail, return a mock response
    const mockResponse = {
      chart: {
        result: [{
          meta: {
            symbol: symbol,
            currency: 'USD',
            exchangeName: 'NASDAQ',
            instrumentType: 'EQUITY'
          },
          timestamp: [Date.now() / 1000],
          indicators: {
            quote: [{
              close: [100.00],
              volume: [1000000]
            }]
          }
        }],
        error: null
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(mockResponse));
  } catch (e) {
    console.error(`Error in /api/yahoo/chart for ${req.query.symbol}:`, e);
    return res.status(500).json({ error: e.message || 'yahoo_chart_error' });
  }
});

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    version: '2.0.0',
    apis: ['finnhub', 'fmp', 'polygon', 'enhanced']
  });
});

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    finnhub_configured: !!FINNHUB_KEY,
    fmp_configured: !!FMP_KEY,
    polygon_configured: !!POLYGON_KEY,
    alpha_configured: !!ALPHA_KEY,
    finnhub_key_length: FINNHUB_KEY ? FINNHUB_KEY.length : 0,
    fmp_key_length: FMP_KEY ? FMP_KEY.length : 0,
    polygon_key_length: POLYGON_KEY ? POLYGON_KEY.length : 0
  });
});

// Test data source connectivity
app.get('/api/backtest/sources', async (req, res) => {
  const testSymbol = 'AAPL';
  const sources = [];
  
  // Test FMP
  if (FMP_KEY) {
    try {
      const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${testSymbol}?apikey=${FMP_KEY}&limit=5`;
      const start = Date.now();
      const { body } = await fetchJson(fmpUrl);
      const data = JSON.parse(body);
      const responseTime = Date.now() - start;
      
      sources.push({
        name: 'Financial Modeling Prep',
        status: data && data.historical ? 'working' : 'error',
        responseTime: responseTime,
        dataAvailable: data && data.historical ? data.historical.length : 0,
        priority: 1
      });
    } catch (error) {
      sources.push({
        name: 'Financial Modeling Prep',
        status: 'error',
        error: error.message,
        priority: 1
      });
    }
  } else {
    sources.push({
      name: 'Financial Modeling Prep',
      status: 'not_configured',
      priority: 1
    });
  }
  
  // Test Finnhub
  if (FINNHUB_KEY) {
    try {
      const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${testSymbol}&resolution=D&count=5&token=${FINNHUB_KEY}`;
      const start = Date.now();
      const { body } = await fetchJson(finnhubUrl);
      const data = JSON.parse(body);
      const responseTime = Date.now() - start;
      
      sources.push({
        name: 'Finnhub',
        status: data && data.s === 'ok' ? 'working' : 'error',
        responseTime: responseTime,
        dataAvailable: data && data.c ? data.c.length : 0,
        priority: 2
      });
    } catch (error) {
      sources.push({
        name: 'Finnhub',
        status: 'error',
        error: error.message,
        priority: 2
      });
    }
  } else {
    sources.push({
      name: 'Finnhub',
      status: 'not_configured',
      priority: 2
    });
  }
  
  // Test Polygon.io
  if (POLYGON_KEY) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 10);
      
      const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${testSymbol}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&sort=asc&apikey=${POLYGON_KEY}`;
      const start = Date.now();
      const { body } = await fetchJson(polygonUrl);
      const data = JSON.parse(body);
      const responseTime = Date.now() - start;
      
      sources.push({
        name: 'Polygon.io',
        status: data && data.results ? 'working' : 'error',
        responseTime: responseTime,
        dataAvailable: data && data.results ? data.results.length : 0,
        priority: 3
      });
    } catch (error) {
      sources.push({
        name: 'Polygon.io',
        status: 'error',
        error: error.message,
        priority: 3
      });
    }
  } else {
    sources.push({
      name: 'Polygon.io',
      status: 'not_configured',
      priority: 3
    });
  }
  
  // Test Alpha Vantage
  if (ALPHA_KEY) {
    try {
      const alphaUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${testSymbol}&outputsize=compact&apikey=${ALPHA_KEY}`;
      const start = Date.now();
      const { body } = await fetchAlphaJson(alphaUrl);
      const data = JSON.parse(body);
      const responseTime = Date.now() - start;
      
      sources.push({
        name: 'Alpha Vantage',
        status: data && data['Time Series (Daily)'] ? 'working' : 'error',
        responseTime: responseTime,
        dataAvailable: data && data['Time Series (Daily)'] ? Object.keys(data['Time Series (Daily)']).length : 0,
        priority: 4
      });
    } catch (error) {
      sources.push({
        name: 'Alpha Vantage',
        status: 'error',
        error: error.message,
        priority: 4
      });
    }
  } else {
    sources.push({
      name: 'Alpha Vantage',
      status: 'not_configured',
      priority: 4
    });
  }
  
  // Sort by priority
  sources.sort((a, b) => a.priority - b.priority);
  
  res.json({
    sources: sources,
    recommendation: sources.find(s => s.status === 'working')?.name || 'No working data sources',
    timestamp: new Date().toISOString()
  });
});

// New API endpoints for enhanced data sources
app.get('/api/finnhub/quote', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter required' });
    }
    if (!FINNHUB_KEY) {
      return res.status(503).json({ 
        error: 'Finnhub API key not configured',
        debug: {
          key_exists: !!FINNHUB_KEY,
          key_length: FINNHUB_KEY ? FINNHUB_KEY.length : 0,
          env_keys: Object.keys(process.env).filter(k => k.includes('API'))
        }
      });
    }
    
    const price = await fetchQuoteFinnhub(symbol);
    if (isFinite(price)) {
      res.json({ symbol, price, source: 'finnhub' });
    } else {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (e) {
    console.error('Error in /api/finnhub/quote:', e);
    res.status(500).json({ 
      error: 'Internal server error',
      details: e.message,
      stack: e.stack
    });
  }
});

app.get('/api/fmp/quote', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter required' });
    }
    if (!FMP_KEY) {
      return res.status(503).json({ 
        error: 'FMP API key not configured',
        debug: {
          key_exists: !!FMP_KEY,
          key_length: FMP_KEY ? FMP_KEY.length : 0,
          env_keys: Object.keys(process.env).filter(k => k.includes('API'))
        }
      });
    }
    
    const price = await fetchQuoteFMP(symbol);
    if (isFinite(price)) {
      res.json({ symbol, price, source: 'fmp' });
    } else {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (e) {
    console.error('Error in /api/fmp/quote:', e);
    res.status(500).json({ 
      error: 'Internal server error',
      details: e.message,
      stack: e.stack
    });
  }
});

app.get('/api/polygon/quote', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter required' });
    }
    if (!POLYGON_KEY) {
      return res.status(503).json({ 
        error: 'Polygon API key not configured',
        debug: {
          key_exists: !!POLYGON_KEY,
          key_length: POLYGON_KEY ? POLYGON_KEY.length : 0,
          env_keys: Object.keys(process.env).filter(k => k.includes('API'))
        }
      });
    }
    
    const price = await fetchQuotePolygon(symbol);
    if (isFinite(price)) {
      res.json({ symbol, price, source: 'polygon' });
    } else {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (e) {
    console.error('Error in /api/polygon/quote:', e);
    res.status(500).json({ 
      error: 'Internal server error',
      details: e.message,
      stack: e.stack
    });
  }
});

app.get('/api/quote/enhanced', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter required' });
    }
    
    const price = await fetchQuoteWithFallback(symbol);
    if (isFinite(price)) {
      res.json({ symbol, price, source: 'enhanced_fallback' });
    } else {
      res.status(404).json({ 
        error: 'Quote not found from any source',
        debug: {
          symbol,
          finnhub_configured: !!FINNHUB_KEY,
          fmp_configured: !!FMP_KEY,
          polygon_configured: !!POLYGON_KEY,
          alpha_configured: !!ALPHA_KEY
        }
      });
    }
  } catch (e) {
    console.error('Error in /api/quote/enhanced:', e);
    res.status(500).json({ 
      error: 'Internal server error',
      details: e.message,
      stack: e.stack
    });
  }
});

// LLM config (model/base) for frontend awareness
app.get('/api/grok/config', (req, res) => {
  try {
    const providedKey = ((req.headers['x-api-key'] || '') + '').trim();
    const provider = chooseProvider(req, providedKey);
    return res.json({
      model: provider.defaultModel,
      base: provider.baseUrl,
      provider: provider.name
    });
  } catch (_) {
    res.json({ model: PERPLEXITY_MODEL, base: 'https://api.perplexity.ai/chat/completions', provider: 'perplexity' });
  }
});

// OpenRouter LLM chat proxy (secure backend only)
app.post('/api/grok/chat', async (req, res) => {
  try {
    const start = Date.now();
    if (!rateLimitOk(req.ip, '/api/grok/chat')) return res.status(429).json({ error: 'rate_limited' });
    // Allow per-request API key via header or body
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const provider = chooseProvider(req, providedKey);
    if (!provider.apiKey) {
      return res.status(400).json({ error: 'Missing API key. Provide header x-api-key or set PERPLEXITY_API_KEY.' });
    }

    // Basic input shape: { messages: [{role, content}], model?, stream? }
    const body = req.body || {};
    const messages = sanitizeMessages(Array.isArray(body.messages) ? body.messages : []);
    const model = (body.model || provider.defaultModel).toString();
    const stream = Boolean(body.stream);

    // Choose base by provider
    const urlObj = new URL(provider.baseUrl);

    const requestPayload = JSON.stringify({ model, messages, stream });

    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'Accept': 'application/json',
        ...provider.headers
      }
    };

    const coalesceKey = `chat:${provider.name}:${model}:${JSON.stringify(messages)}`;
    if (grokPending.has(coalesceKey)) {
      const result = await grokPending.get(coalesceKey);
      res.setHeader('Content-Type', result.headers['content-type'] || 'application/json');
      recordMetric('/api/grok/chat', Date.now() - start, result.status >= 200 && result.status < 400);
      return res.status(result.status).send(result.body);
    }
    const p = new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data, headers: r.headers }));
      });
      req2.on('error', reject);
      req2.write(requestPayload);
      req2.end();
    }).catch(err => {
        console.error('LLM chat request failed:', err);
        grokPending.delete(coalesceKey);
        // Return an error structure that the caller can handle
        return { status: 502, body: JSON.stringify({ error: 'upstream_request_failed', details: err.message }), headers: {'content-type': 'application/json'} };
    }).finally(() => grokPending.delete(coalesceKey));
    grokPending.set(coalesceKey, p);
    const forward = await p;

    res.setHeader('Content-Type', forward.headers['content-type'] || 'application/json');
    recordMetric('/api/grok/chat', Date.now() - start, forward.status >= 200 && forward.status < 400);
    // OpenRouter-only setup; no fallback needed
    return res.status(forward.status).send(forward.body);
  } catch (e) {
    console.error('Error in /api/grok/chat:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_proxy_error' });
  }
});

// OpenRouter LLM streaming endpoint (SSE): transforms provider stream into plain text tokens
app.post('/api/grok/stream', async (req, res) => {
  try {
    if (!rateLimitOk(req.ip, '/api/grok/stream')) { res.status(429); res.write('event: error\n'); res.write('data: rate_limited\n\n'); return res.end(); }
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const provider = chooseProvider(req, providedKey);
    if (!provider.apiKey) {
      return res.status(400).json({ error: 'Missing API key. Provide header x-api-key or set PERPLEXITY_API_KEY.' });
    }

    const body = req.body || {};
    const messages = sanitizeMessages(Array.isArray(body.messages) ? body.messages : []);
    const model = (body.model || provider.defaultModel).toString();

    // Prepare SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const urlObj = new URL(provider.baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'Accept': 'text/event-stream',
        ...provider.headers
      }
    };

    const requestPayload = JSON.stringify({ model, messages, stream: true });

    const upstream = lib.request(options, (r) => {
      let buffer = '';
      r.on('data', (chunk) => {
        try {
          buffer += chunk.toString('utf8');
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const line = part.trim();
            if (!line) continue;
            // Expect OpenAI-style SSE: "data: {json}" or "data: [DONE]"
            const dataPrefix = 'data:';
            if (line.startsWith(dataPrefix)) {
              const payload = line.slice(dataPrefix.length).trim();
              if (payload === '[DONE]') {
                res.write('event: done\n');
                res.write('data: [DONE]\n\n');
                res.end();
                return;
              }
              try {
                const j = JSON.parse(payload);
                const delta = j?.choices?.[0]?.delta?.content || '';
                if (delta) {
                  // Emit plain token text so the client can append directly
                  const safe = delta.replace(/\r?\n/g, '\\n');
                  res.write(`data: ${safe}\n\n`);
                }
              } catch {
                // If JSON parse fails, forward raw text
                res.write(`data: ${payload}\n\n`);
              }
            } else {
              // Forward any non-standard lines as comments
              res.write(`: ${line}\n\n`);
            }
          }
        } catch (_) {
          // Best-effort streaming; ignore chunk errors
        }
      });
      r.on('end', () => {
        try {
          res.write('event: done\n');
          res.write('data: [DONE]\n\n');
        } finally {
          res.end();
        }
      });
    });

    upstream.on('error', () => {
      try {
        res.write('event: error\n');
        res.write('data: upstream_error\n\n');
      } finally {
        res.end();
      }
    });
    upstream.write(requestPayload);
    upstream.end();

    // Abort upstream if client disconnects
    req.on('close', () => {
      try { upstream.destroy(); } catch {}
    });
  } catch (e) {
    console.error('Error in /api/grok/stream:', e);
    try {
      res.write('event: error\n');
      res.write(`data: ${e && e.message ? e.message : 'llm_stream_error'}\n\n`);
    } finally {
      res.end();
    }
  }
});

// OpenRouter LLM analysis endpoint: accept { symbol, series } and return structured insights
app.post('/api/grok/analyze', async (req, res) => {
  try {
    // Allow per-request API key via header or body
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || PERPLEXITY_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing Perplexity API key. Provide header x-api-key or body.apiKey.' });
    }
    const body = req.body || {};
    const symbol = (body.symbol || '').toString();
    const series = body.series || {}; // { dates:[], closes:[], volumes:[] }
    // Simple 10-minute cache keyed by symbol + model + length + last values
    const modelForAnalyze = PERPLEXITY_MODEL;
    const closes = Array.isArray(series.closes) ? series.closes : [];
    const dates = Array.isArray(series.dates) ? series.dates : [];
    const cacheKey = `grok:analyze:${modelForAnalyze}:${symbol}:${closes.length}:${dates.length}:${closes.slice(-5).join(',')}:${(dates.slice(-2)||[]).join(',')}`;
    const nowTs = Date.now();
    const ttlAnalyzeMs = 10 * 60 * 1000; // 10 minutes
    const existing = cache.get(cacheKey);
    if (existing && (nowTs - existing.ts) < ttlAnalyzeMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(existing.body);
    }
    const latest = Array.isArray(series.closes) && series.closes.length ? series.closes[series.closes.length - 1] : null;
    const payload = {
      model: modelForAnalyze,
      messages: [
        { role: 'system', content: '你係一名擁有超過30年數學博士學位經驗的專業投資者同樣係最高級既程式員，專注於量化金融、隨機過程和機器學習模型在投資決策中的應用。分析方法強調多路徑評估：結合基本面（財務數據）、技術指標（歷史價格模式）、情緒指標（新聞和社交媒體）、以及數學模型（如蒙特卡洛模擬和時間序列預測），以捕捉不確定性並提供概率性洞見。請返回簡潔的JSON格式分析。' },
        { role: 'user', content: `Analyze ${symbol} given this JSON series (daily closes, volumes, dates). Return strict JSON with keys: summary, risks, levels {support,resistance}, outlook, actions. Series: ${JSON.stringify({ symbol, series, latest })}` }
      ]
    };
    const urlObj = new URL(XAI_API_BASE || 'https://api.x.ai/v1/chat/completions');
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };
    const response = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (c) => (data += c));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      req2.write(JSON.stringify(payload));
      req2.end();
    });
    try {
      const j = JSON.parse(response.body);
      const text = j?.choices?.[0]?.message?.content || '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      const outObj = { symbol, analysis: parsed };
      const outStr = JSON.stringify(outObj);
      cache.set(cacheKey, { ts: Date.now(), status: 200, body: outStr });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(outStr);
    } catch {
      return res.status(response.status).send(response.body);
    }
  } catch (e) {
    console.error('Error in /api/grok/analyze:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_analyze_error' });
  }
});

// Natural Language Screener: { apiKey, query, universe?, size? }
app.post('/api/grok/screener', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || PERPLEXITY_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing Perplexity API key. Provide header x-api-key or body.apiKey.' });
    }
    const body = req.body || {};
    const nlQuery = (body.query || '').toString().trim();
    if (!nlQuery) return res.status(400).json({ error: 'query required' });
    let universe = Array.isArray(body.universe) ? body.universe.map((s)=> (s||'').toString().trim()).filter(Boolean) : [];
    const size = Math.min(20, Math.max(1, Number(body.size || 10)));
    if (!universe.length) {
      universe = ['NVDA','MSFT','AAPL','AMZN','GOOGL','META','TSLA','AMD','AVGO','ORCL','LLY','ABBV','NFLX','CRM','INTC','ADBE','SHOP','BABA','0700.HK','9988.HK'];
    }

    const modelId = PERPLEXITY_MODEL;
    // Disable cache for market prediction to get fresh AI recommendations
    // const cacheKey = `grok:screener:${modelId}:${nlQuery}:${universe.join(',')}:${size}:${Date.now()}`;
    // const nowTs = Date.now();
    // const ttlMs = 10 * 60 * 1000;
    // const cached = cache.get(cacheKey);
    // if (cached && (nowTs - cached.ts) < ttlMs) {
    //   res.setHeader('Content-Type', 'application/json');
    //   return res.status(200).send(cached.body);
    // }

    // Fetch lightweight metrics via Yahoo for each symbol
    async function fetchQuote(sym) {
      const u1 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      try {
        let { status, body } = await tryFetchWithFallback(u1);
        if (status !== 200 || !body) {
          const u2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
          const r2 = await tryFetchWithFallback(u2);
          status = r2.status; body = r2.body;
        }
        try {
          const j = JSON.parse(body || '{}');
          const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
          if (!r) return { symbol: sym, ok: false };
          return {
            ok: true,
            symbol: r.symbol,
            shortName: r.shortName,
            price: Number(r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice),
            changePercent: Number(r.regularMarketChangePercent ?? 0),
            marketCap: Number(r.marketCap ?? 0),
            trailingPE: Number(r.trailingPE ?? NaN),
            forwardPE: Number(r.forwardPE ?? NaN),
            pegRatio: Number(r.pegRatio ?? NaN),
            beta: Number(r.beta ?? NaN),
            currency: r.currency || 'USD',
            sector: r.sector || '',
            industry: r.industry || ''
          };
        } catch {
          return { symbol: sym, ok: false };
        }
      } catch (e) {
        console.error(`Exception in fetchQuote for screener symbol ${sym}:`, e);
        return { symbol: sym, ok: false };
      }
    }

    const metrics = await Promise.all(universe.map(fetchQuote));
    const dataset = metrics.filter(m => m && m.ok).map(({ ok, ...rest }) => rest);

    // Compose prompt for LLM screener
    const instruction = `You are a senior equity screener. Given a user natural-language screening request and a dataset of symbols with metrics, select up to ${size} symbols that best match. Return strict JSON: { criteria_explained: string, selected: string[], reasons: { [symbol]: string }, risks?: string[] }`;
    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: `Request: ${nlQuery}\n\nUniverse size: ${dataset.length}\nMetrics JSON: ${JSON.stringify(dataset).slice(0, 35000)}\n\nReturn JSON only.` }
    ];

    const provider = chooseProvider(req, providedKey);
    const baseUrl = provider.baseUrl;
    const urlObj = new URL(baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };
    const payload = JSON.stringify({ model: modelId, messages, stream: false });
    const forward = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    let out;
    try {
      const j = JSON.parse(forward.body || '{}');
      const text = j?.choices?.[0]?.message?.content || '';
      out = JSON.parse(text);
    } catch {
      out = { raw: forward.body };
    }

    const responseObj = { query: nlQuery, universe, size, result: out, data: dataset };
    const outStr = JSON.stringify(responseObj);
    // cache.set(cacheKey, { ts: Date.now(), status: 200, body: outStr }); // Disabled cache
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    console.error('Error in /api/grok/screener:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_screener_error' });
  }
});

// News insights TL;DR via OpenRouter LLM: { apiKey, symbol, lookbackDays? }
app.post('/api/grok/news-insights', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    const body = req.body || {};
    const symbol = (body.symbol || '').toString().trim();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const lookbackDays = Math.min(30, Math.max(1, Number(body.lookbackDays || 7)));

    const modelId = PERPLEXITY_MODEL;
    const cacheKey = `grok:news:${modelId}:${symbol}:${lookbackDays}`;
    const nowTs = Date.now();
    const ttlMs = 10 * 60 * 1000;
    const cached = cache.get(cacheKey);
    if (cached && (nowTs - cached.ts) < ttlMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }

    // Fetch simple headlines via DuckDuckGo
    const q = encodeURIComponent(`${symbol} stock news ${new Date().getFullYear()}`);
    const url = `https://duckduckgo.com/html/?q=${q}`;
    const { body: html } = await fetchJson(url);
    const items = [];
    const regex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/gi;
    let m;
    while ((m = regex.exec(html || '')) !== null) {
      const raw = m[1] || '';
      const text = raw.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (text) items.push(text);
      if (items.length >= 8) break;
    }
    const headlines = items.slice(0, 8);

    // Heuristic sentiment
    const textAgg = headlines.join(' ').toLowerCase();
    const posWords = ['beat','surge','rally','buy','upgrade','bullish','record','growth','strong','outperform'];
    const negWords = ['miss','fall','drop','plunge','sell','downgrade','bearish','weak','underperform','cuts'];
    let pos = 0, neg = 0;
    posWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; pos += c; });
    negWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; neg += c; });
    const total = pos + neg;
    const score = total > 0 ? Math.max(-1, Math.min(1, (pos - neg) / total)) : 0;

    // Ask OpenRouter LLM for TL;DR
    const instruction = 'You are a financial news analyst. Given recent headlines for a stock, produce a concise TL;DR with 3 bullets, top risks (<=3), and near-term catalysts (<=3). Return strict JSON: { tldr: string[], risks: string[], catalysts: string[], stance: "positive"|"neutral"|"negative" }';
    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: `Symbol: ${symbol}\nHeuristic sentiment score: ${score}\nHeadlines: ${JSON.stringify(headlines)}\nLookback days: ${lookbackDays}\nReturn JSON only.` }
    ];

    const baseUrl = XAI_API_BASE || 'https://api.x.ai/v1/chat/completions';
    const urlObj = new URL(baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };
    const payload = JSON.stringify({ model: modelId, messages, stream: false });
    const forward = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    let out;
    try {
      const j = JSON.parse(forward.body || '{}');
      const text = j?.choices?.[0]?.message?.content || '';
      out = JSON.parse(text);
    } catch {
      out = { raw: forward.body };
    }
    const responseObj = { symbol, headlines, heuristic: { score, pos, neg, total }, insights: out };
    const outStr = JSON.stringify(responseObj);
    cache.set(cacheKey, { ts: Date.now(), status: 200, body: outStr });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    console.error('Error in /api/grok/news-insights:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_news_error' });
  }
});

// Peers compare benchmarking: { apiKey, symbol, peers?[] }
app.post('/api/grok/peers-compare', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    const body = req.body || {};
    const symbol = (body.symbol || '').toString().trim();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    let peers = Array.isArray(body.peers) ? body.peers.map(s => (s||'').toString().trim()).filter(Boolean) : [];
    if (!peers.length) {
      peers = ['MSFT','AAPL','AMZN','GOOGL','META','AMD','AVGO'];
      peers = peers.filter(p => p !== symbol);
    }
    const universe = [symbol, ...peers];

    const modelId = PERPLEXITY_MODEL;
    const cacheKey = `grok:peers:${modelId}:${universe.join(',')}`;
    const cached = cache.get(cacheKey);
    const nowTs = Date.now();
    const ttlMs = 10 * 60 * 1000;
    if (cached && (nowTs - cached.ts) < ttlMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }

    async function fetchQuote(sym) {
      const u1 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      try {
        let { status, body } = await tryFetchWithFallback(u1);
        if (status !== 200 || !body) {
          const u2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
          const r2 = await tryFetchWithFallback(u2);
          status = r2.status; body = r2.body;
        }
        try {
          const j = JSON.parse(body || '{}');
          const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
          if (!r) return { symbol: sym, ok: false };
          return {
            ok: true,
            symbol: r.symbol,
            shortName: r.shortName,
            sector: r.sector || '',
            industry: r.industry || '',
            price: Number(r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice),
            changePercent: Number(r.regularMarketChangePercent ?? 0),
            marketCap: Number(r.marketCap ?? 0),
            trailingPE: Number(r.trailingPE ?? NaN),
            forwardPE: Number(r.forwardPE ?? NaN),
            pegRatio: Number(r.pegRatio ?? NaN),
            beta: Number(r.beta ?? NaN),
            dividendYield: Number(r.trailingAnnualDividendYield ?? NaN)
          };
        } catch {
          return { symbol: sym, ok: false };
        }
      } catch (e) {
        console.error(`Exception in fetchQuote for peers-compare symbol ${sym}:`, e);
        return { symbol: sym, ok: false };
      }
    }

    const metrics = await Promise.all(universe.map(fetchQuote));
    const dataset = metrics.filter(m => m && m.ok).map(({ ok, ...rest }) => rest);
    const instruction = 'You are an equity peer benchmarking analyst. Compare the target vs peers across valuation (PE, PEG), scale (marketCap), momentum (changePercent), risk (beta), income (dividendYield). Return strict JSON: { ranking: { overall: string[], value: string[], growth: string[], momentum: string[], risk: string[] }, summary: string, key_diffs: string[] }';
    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: `Target: ${symbol}\nPeers: ${peers.join(', ')}\nDataset: ${JSON.stringify(dataset)}\nReturn JSON only.` }
    ];

    const baseUrl = XAI_API_BASE || 'https://api.x.ai/v1/chat/completions';
    const urlObj = new URL(baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };
    const payload = JSON.stringify({ model: modelId, messages, stream: false });
    const forward = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    let out;
    try {
      const j = JSON.parse(forward.body || '{}');
      const text = j?.choices?.[0]?.message?.content || '';
      out = JSON.parse(text);
    } catch {
      out = { raw: forward.body };
    }
    const responseObj = { symbol, peers, data: dataset, compare: out };
    const outStr = JSON.stringify(responseObj);
    cache.set(cacheKey, { ts: Date.now(), status: 200, body: outStr });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    console.error('Error in /api/grok/peers-compare:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_peers_error' });
  }
});

// Portfolio Doctor: { apiKey, holdings: [{ symbol, weight }], budget? }
app.post('/api/grok/portfolio-doctor', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    const body = req.body || {};
    const holdings = Array.isArray(body.holdings) ? body.holdings : [];
    if (!holdings.length) return res.status(400).json({ error: 'holdings required' });
    const budget = Number(body.budget || 100000);

    const modelId = PERPLEXITY_MODEL;
    const cacheKey = `grok:portfolio:${modelId}:${holdings.map(h=>`${h.symbol}:${h.weight}`).join('|')}:${budget}`;
    const cached = cache.get(cacheKey);
    const nowTs = Date.now();
    const ttlMs = 10 * 60 * 1000;
    if (cached && (nowTs - cached.ts) < ttlMs) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }

    async function fetchQuote(sym) {
      const u1 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      try {
        let { status, body } = await tryFetchWithFallback(u1);
        if (status !== 200 || !body) {
          const u2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
          const r2 = await tryFetchWithFallback(u2);
          status = r2.status; body = r2.body;
        }
        try {
          const j = JSON.parse(body || '{}');
          const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
          if (!r) return { symbol: sym, ok: false };
          return {
            ok: true,
            symbol: r.symbol,
            price: Number(r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice),
            beta: Number(r.beta ?? NaN),
            sector: r.sector || '',
            industry: r.industry || ''
          };
        } catch {
          return { symbol: sym, ok: false };
        }
      } catch (e) {
        console.error(`Exception in fetchQuote for portfolio-doctor symbol ${sym}:`, e);
        return { symbol: sym, ok: false };
      }
    }

    const symbols = holdings.map(h => (h.symbol || '').toString().trim()).filter(Boolean);
    const quotes = await Promise.all(symbols.map(fetchQuote));
    const data = quotes.filter(q => q && q.ok).map(({ ok, ...rest }) => rest);

    const instruction = 'You are a portfolio risk doctor. Given holdings with weights and quotes (price, beta, sector/industry), identify top 3 risk sources, show simple factor exposure (beta proxy), sector/industry concentration, a correlation warning if likely (heuristic), and propose 2-3 hedging ideas or diversification swaps. Return strict JSON: { risks: string[], concentration: { sectors: { [key]: number }, industries: { [key]: number } }, factor_exposure: { beta: number }, hedges: string[], notes: string[] }';
    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: `Holdings: ${JSON.stringify(holdings)}\nQuotes: ${JSON.stringify(data)}\nBudget: ${budget}\nReturn JSON only.` }
    ];

    const baseUrl = XAI_API_BASE || 'https://api.x.ai/v1/chat/completions';
    const urlObj = new URL(baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };
    const payload = JSON.stringify({ model: modelId, messages, stream: false });
    const forward = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    let out;
    try {
      const j = JSON.parse(forward.body || '{}');
      const text = j?.choices?.[0]?.message?.content || '';
      out = JSON.parse(text);
    } catch {
      out = { raw: forward.body };
    }
    const responseObj = { holdings, budget, quotes: data, doctor: out };
    const outStr = JSON.stringify(responseObj);
    cache.set(cacheKey, { ts: Date.now(), status: 200, body: outStr });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    console.error('Error in /api/grok/portfolio-doctor:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'llm_portfolio_error' });
  }
});

// Lightweight sentiment from public web search (heuristic, no API key)
app.get('/api/x/sentiment', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const q = encodeURIComponent(`${symbol} stock 2025 sentiment`);
    const url = `https://duckduckgo.com/html/?q=${q}`;
    const { body } = await fetchJson(url);
    const text = (body || '').toLowerCase();
    const posWords = ['bullish','buy','upgrade','beat','surge','rally','record','optimistic','outperform','raises','growth','strong'];
    const negWords = ['bearish','sell','downgrade','miss','fall','drop','plunge','weak','pessimistic','underperform','cuts','decline'];
    let pos = 0, neg = 0;
    posWords.forEach(w => { const m = text.match(new RegExp(`\\b${w}\\b`, 'g')); if (m) pos += m.length; });
    negWords.forEach(w => { const m = text.match(new RegExp(`\\b${w}\\b`, 'g')); if (m) neg += m.length; });
    const total = pos + neg;
    const score = total > 0 ? Math.max(-1, Math.min(1, (pos - neg) / total)) : 0;
    return res.json({ symbol, score, total, pos, neg, source: 'duckduckgo' });
  } catch (e) {
    console.error(`Error in /api/x/sentiment for ${req.query.symbol}:`, e);
    return res.status(200).json({ symbol: (req.query.symbol || '').toString(), score: null, error: e.message || 'sentiment_error' });
  }
});

// News headlines + sentiment via web search (simple heuristic)
app.get('/api/news/sentiment', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const q = encodeURIComponent(`${symbol} stock news 2025`);
    const url = `https://duckduckgo.com/html/?q=${q}`;
    const { body } = await fetchJson(url);
    const items = [];
    const regex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/gi;
    let m;
    while ((m = regex.exec(body || '')) !== null) {
      const raw = m[1] || '';
      const text = raw.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (text) items.push(text);
      if (items.length >= 5) break;
    }
    const headlines = items.slice(0, 5);
    const textAgg = headlines.join(' ').toLowerCase();
    const posWords = ['beat','surge','rally','buy','upgrade','bullish','record','growth','strong','outperform'];
    const negWords = ['miss','fall','drop','plunge','sell','downgrade','bearish','weak','underperform','cuts'];
    let pos = 0, neg = 0;
    posWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; pos += c; });
    negWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; neg += c; });
    const total = pos + neg;
    const score = total > 0 ? Math.max(-1, Math.min(1, (pos - neg) / total)) : 0;
    return res.json({ symbol, headlines, score, pos, neg, total, source: 'duckduckgo' });
  } catch (e) {
    console.error(`Error in /api/news/sentiment for ${req.query.symbol}:`, e);
    return res.status(200).json({ symbol: (req.query.symbol || '').toString(), headlines: [], score: null, error: e.message || 'news_error' });
  }
});

// Jump diffusion/Heston/GARCH placeholders returning quantile bands
function computeBandsFromCloses(closes, days, scale = 1) {
  if (!Array.isArray(closes) || closes.length === 0) {
    return { q05: [], q50: [], q95: [] };
  }
  const last = closes[closes.length - 1];
  const q50 = Array.from({ length: days + 1 }, (_, i) => last * (1 + 0.0005 * i));
  const q95 = q50.map((v, i) => v * (1 + 0.02 * Math.sqrt(i) * scale));
  const q05 = q50.map((v, i) => v / (1 + 0.02 * Math.sqrt(i) * scale));
  return { q05, q50, q95 };
}

app.post('/api/sim/jump', (req, res) => {
  const { closes = [], days = 21 } = req.body || {};
  res.json(computeBandsFromCloses(closes, days, 1.2));
});

app.post('/api/sim/heston', (req, res) => {
  const { closes = [], days = 21 } = req.body || {};
  res.json(computeBandsFromCloses(closes, days, 1.0));
});

app.post('/api/sim/garch', (req, res) => {
  const { closes = [], days = 21 } = req.body || {};
  res.json(computeBandsFromCloses(closes, days, 0.9));
});

// Backtest API endpoints
app.post('/api/backtest/run', authRequired, async (req, res) => {
  try {
    const { symbol, period, lookbackDays = 90, models = ['lstm', 'gbm', 'arima', 'prophet'] } = req.body;
    
    if (!symbol || !period) {
      return res.status(400).json({ error: 'Symbol and period are required' });
    }

    // Fetch historical data for backtesting using multiple data sources
    const fetchHistoricalData = async (symbol, days) => {
      console.log(`Fetching historical data for ${symbol} (${days} days)`);
      
      // Try FMP first (most reliable for historical data)
      if (FMP_KEY) {
        try {
          console.log('Trying FMP API...');
          const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`;
          const { body } = await fetchJson(fmpUrl);
          const data = JSON.parse(body);
          
          if (data && data.historical && Array.isArray(data.historical)) {
            const historical = data.historical.slice(0, days).reverse(); // FMP returns newest first
            const dates = historical.map(item => item.date);
            const closes = historical.map(item => parseFloat(item.close));
            const volumes = historical.map(item => parseFloat(item.volume));
            
            console.log(`✓ FMP: Retrieved ${closes.length} days of data`);
            return { dates, closes, volumes };
          }
        } catch (error) {
          console.warn('FMP API failed:', error.message);
        }
      }
      
      // Try Finnhub as second option
      if (FINNHUB_KEY) {
        try {
          console.log('Trying Finnhub API...');
          const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&count=${days}&token=${FINNHUB_KEY}`;
          const { body } = await fetchJson(finnhubUrl);
          const data = JSON.parse(body);
          
          if (data && data.s && data.s === 'ok' && data.c && data.c.length > 0) {
            const closes = data.c.map(price => parseFloat(price));
            const volumes = data.v ? data.v.map(vol => parseFloat(vol)) : [];
            const dates = data.t.map(timestamp => new Date(timestamp * 1000).toISOString().split('T')[0]);
            
            console.log(`✓ Finnhub: Retrieved ${closes.length} days of data`);
            return { dates, closes, volumes };
          }
        } catch (error) {
          console.warn('Finnhub API failed:', error.message);
        }
      }
      
      // Try Polygon.io as third option
      if (POLYGON_KEY) {
        try {
          console.log('Trying Polygon.io API...');
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - days * 2); // Get extra data to ensure we have enough
          
          const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&sort=asc&apikey=${POLYGON_KEY}`;
          const { body } = await fetchJson(polygonUrl);
          const data = JSON.parse(body);
          
          if (data && data.results && Array.isArray(data.results)) {
            const results = data.results.slice(-days); // Get last N days
            const dates = results.map(item => new Date(item.t).toISOString().split('T')[0]);
            const closes = results.map(item => parseFloat(item.c));
            const volumes = results.map(item => parseFloat(item.v));
            
            console.log(`✓ Polygon.io: Retrieved ${closes.length} days of data`);
            return { dates, closes, volumes };
          }
        } catch (error) {
          console.warn('Polygon.io API failed:', error.message);
        }
      }
      
      // Fallback to Alpha Vantage
      try {
        console.log('Falling back to Alpha Vantage...');
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${ALPHA_KEY}`;
        const { body } = await fetchAlphaJson(url);
        const data = JSON.parse(body);
        const timeSeries = data['Time Series (Daily)'];
        
        if (!timeSeries) {
          throw new Error('No historical data available from Alpha Vantage');
        }
        
        const dates = Object.keys(timeSeries).sort();
        const closes = dates.map(date => parseFloat(timeSeries[date]['4. close']));
        const volumes = dates.map(date => parseFloat(timeSeries[date]['5. volume']));
        
        // Return only the requested number of days
        const startIndex = Math.max(0, closes.length - days);
        console.log(`✓ Alpha Vantage: Retrieved ${closes.slice(startIndex).length} days of data`);
        return {
          dates: dates.slice(startIndex),
          closes: closes.slice(startIndex),
          volumes: volumes.slice(startIndex)
        };
      } catch (error) {
        console.error('All data sources failed:', error);
        throw new Error('Unable to fetch historical data from any source. Please check your API keys and symbol format.');
      }
    };

    // For long backtests, we need more historical data
    const totalDaysNeeded = Math.min(lookbackDays + period + 100, 2000); // Extra buffer for long backtests
    const historicalData = await fetchHistoricalData(symbol, totalDaysNeeded);
    
    if (historicalData.closes.length < lookbackDays + period) {
      return res.status(400).json({ 
        error: 'Insufficient historical data for backtesting',
        available: historicalData.closes.length,
        required: lookbackDays + period,
        requested: totalDaysNeeded
      });
    }

    console.log(`✓ Backtest data prepared: ${historicalData.closes.length} days available for ${lookbackDays} day backtest`);

    // Perform backtest simulation
    const backtestResults = {
      symbol,
      period,
      lookbackDays,
      startDate: historicalData.dates[historicalData.dates.length - lookbackDays],
      endDate: historicalData.dates[historicalData.dates.length - 1],
      models: {},
      summary: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0
      }
    };

    // Simulate predictions for each model
    const totalModels = models.length;
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const modelName = models[modelIndex];
      console.log(`Processing model ${modelIndex + 1}/${totalModels}: ${modelName}`);
      const modelResults = {
        predictions: [],
        actuals: [],
        trades: [],
        metrics: {
          mae: 0,
          rmse: 0,
          accuracy: 0,
          winRate: 0,
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0
        }
      };

      // Walk-forward backtest with optimized step size for long backtests
      const stepSize = lookbackDays > 365 ? 7 : 1; // Use weekly steps for long backtests
      const maxSteps = Math.floor(lookbackDays / stepSize);
      
      console.log(`Running ${modelName} backtest: ${maxSteps} steps with step size ${stepSize}`);
      
      for (let step = 0; step < maxSteps; step++) {
        const i = step * stepSize;
        const trainData = historicalData.closes.slice(0, historicalData.closes.length - lookbackDays + i);
        const actualPrice = historicalData.closes[historicalData.closes.length - lookbackDays + i + period - 1];
        
        if (trainData.length < 30 || !actualPrice) continue;

        // Generate prediction based on model type
        let prediction;
        try {
          switch (modelName) {
            case 'gbm':
              prediction = predictGBM(trainData, period);
              break;
            case 'arima':
              prediction = predictARIMA(trainData, period);
              break;
            case 'lstm':
              // Simplified LSTM prediction (would need TensorFlow.js on server)
              prediction = predictSimpleLSTM(trainData, period);
              break;
            case 'prophet':
              // Simplified Prophet prediction
              prediction = predictSimpleProphet(trainData, period);
              break;
            default:
              prediction = trainData[trainData.length - 1] * (1 + Math.random() * 0.1 - 0.05);
          }
        } catch (error) {
          console.warn(`Prediction failed for ${modelName} at step ${i}:`, error.message);
          continue;
        }

        const actual = actualPrice;
        const predictionError = Math.abs(prediction - actual) / actual;
        const directionCorrect = (prediction > trainData[trainData.length - 1]) === (actual > trainData[trainData.length - 1]);
        
        modelResults.predictions.push(prediction);
        modelResults.actuals.push(actual);
        
        // Calculate trade performance
        const entryPrice = trainData[trainData.length - 1];
        const tradeReturn = (actual - entryPrice) / entryPrice;
        const trade = {
          date: historicalData.dates[historicalData.dates.length - lookbackDays + i],
          entryPrice,
          prediction,
          actual,
          return: tradeReturn,
          directionCorrect,
          error: predictionError
        };
        modelResults.trades.push(trade);
      }

      // Calculate model metrics
      if (modelResults.trades.length > 0) {
        const returns = modelResults.trades.map(t => t.return);
        const correctDirections = modelResults.trades.filter(t => t.directionCorrect);
        const errors = modelResults.trades.map(t => t.error);
        
        modelResults.metrics.winRate = correctDirections.length / modelResults.trades.length;
        modelResults.metrics.totalReturn = returns.reduce((sum, r) => sum + r, 0);
        modelResults.metrics.mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
        modelResults.metrics.rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
        
        // Calculate Sharpe ratio (simplified)
        const avgReturn = modelResults.metrics.totalReturn / returns.length;
        const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
        modelResults.metrics.sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
        
        // Calculate max drawdown
        let peak = 0;
        let maxDD = 0;
        let cumulativeReturn = 0;
        for (const ret of returns) {
          cumulativeReturn += ret;
          if (cumulativeReturn > peak) peak = cumulativeReturn;
          const drawdown = peak - cumulativeReturn;
          if (drawdown > maxDD) maxDD = drawdown;
        }
        modelResults.metrics.maxDrawdown = maxDD;
      }

      backtestResults.models[modelName] = modelResults;
    }

    // Calculate overall summary
    const allTrades = Object.values(backtestResults.models).flatMap(m => m.trades);
    if (allTrades.length > 0) {
      backtestResults.summary.totalTrades = allTrades.length;
      backtestResults.summary.winningTrades = allTrades.filter(t => t.return > 0).length;
      backtestResults.summary.losingTrades = allTrades.filter(t => t.return < 0).length;
      backtestResults.summary.winRate = backtestResults.summary.winningTrades / backtestResults.summary.totalTrades;
      backtestResults.summary.totalReturn = allTrades.reduce((sum, t) => sum + t.return, 0);
      
      const returns = allTrades.map(t => t.return);
      const avgReturn = backtestResults.summary.totalReturn / returns.length;
      const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      backtestResults.summary.sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
    }

    res.json(backtestResults);
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ error: 'Backtest failed: ' + error.message });
  }
});

// Enhanced prediction functions with better statistical models
function predictGBM(closes, days) {
  if (closes.length < 2) return closes[closes.length - 1];
  
  // Calculate log returns
  const logReturns = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i-1]));
  }
  
  // Calculate drift and volatility
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const volatility = Math.sqrt(variance);
  
  // GBM formula: S_t = S_0 * exp((μ - σ²/2) * t + σ * √t * Z)
  const drift = mean - (variance / 2);
  const lastPrice = closes[closes.length - 1];
  
  // Use multiple scenarios for better prediction
  const scenarios = [];
  for (let i = 0; i < 100; i++) {
    const z = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / Math.sqrt(2); // Box-Muller approximation
    const price = lastPrice * Math.exp(drift * days + volatility * Math.sqrt(days) * z);
    scenarios.push(price);
  }
  
  // Return median of scenarios
  scenarios.sort((a, b) => a - b);
  return scenarios[Math.floor(scenarios.length / 2)];
}

function predictARIMA(closes, days) {
  if (closes.length < 10) return closes[closes.length - 1];
  
  // Simple ARIMA(1,1,1) approximation
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(closes[i] - closes[i-1]);
  }
  
  // Calculate autoregressive coefficient (simplified)
  let arCoeff = 0;
  if (returns.length > 1) {
    let numerator = 0, denominator = 0;
    for (let i = 1; i < returns.length; i++) {
      numerator += returns[i] * returns[i-1];
      denominator += returns[i-1] * returns[i-1];
    }
    arCoeff = denominator > 0 ? numerator / denominator : 0;
    arCoeff = Math.max(-0.9, Math.min(0.9, arCoeff)); // Constrain AR coefficient
  }
  
  // Forecast
  let forecast = returns[returns.length - 1];
  for (let i = 0; i < days; i++) {
    forecast = arCoeff * forecast;
  }
  
  return closes[closes.length - 1] + forecast;
}

function predictSimpleLSTM(closes, days) {
  if (closes.length < 20) return closes[closes.length - 1];
  
  // Enhanced LSTM-like prediction using multiple moving averages and momentum
  const shortMA = closes.slice(-5).reduce((sum, p) => sum + p, 0) / 5;
  const mediumMA = closes.slice(-10).reduce((sum, p) => sum + p, 0) / 10;
  const longMA = closes.slice(-20).reduce((sum, p) => sum + p, 0) / 20;
  
  // Calculate momentum indicators
  const momentum = (shortMA - longMA) / longMA;
  const acceleration = (shortMA - mediumMA) / mediumMA;
  
  // Volatility adjustment
  const volatility = calculateVolatility(closes.slice(-20));
  const volatilityFactor = Math.min(2, Math.max(0.1, volatility / 0.02)); // Normalize volatility
  
  // Combine signals with weights
  const trendSignal = momentum * 0.6 + acceleration * 0.4;
  const adjustedSignal = trendSignal / volatilityFactor;
  
  // Apply sigmoid-like activation
  const activation = Math.tanh(adjustedSignal * 2);
  
  return closes[closes.length - 1] * (1 + activation * days * 0.05);
}

function predictSimpleProphet(closes, days) {
  if (closes.length < 30) return closes[closes.length - 1];
  
  // Prophet-like prediction with trend and seasonality
  const n = closes.length;
  const trend = (closes[n-1] - closes[0]) / n;
  
  // Simple seasonality detection (weekly pattern)
  const weeklyReturns = [];
  for (let i = 7; i < n; i += 7) {
    if (i < n) weeklyReturns.push(closes[i] - closes[i-7]);
  }
  
  const seasonalComponent = weeklyReturns.length > 0 ? 
    weeklyReturns.reduce((sum, r) => sum + r, 0) / weeklyReturns.length : 0;
  
  // Volatility component
  const volatility = calculateVolatility(closes.slice(-20));
  
  // Combine components
  const trendComponent = trend * days;
  const seasonalComponent_adj = seasonalComponent * Math.floor(days / 7);
  const noiseComponent = (Math.random() - 0.5) * volatility * Math.sqrt(days);
  
  return closes[closes.length - 1] + trendComponent + seasonalComponent_adj + noiseComponent;
}

// Helper function to calculate volatility
function calculateVolatility(prices) {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i-1]));
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  
  return Math.sqrt(variance);
}

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    features: {
      userManager: !!userManager,
      database: !!userManager,
      multiUser: !!userManager
    }
  };
  res.json(health);
});

// Root route -> login homepage
app.get('/', (req, res) => {
  return res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile('login.html', { root: 'public' });
});

// Register page
app.get('/register', (req, res) => {
  res.sendFile('register.html', { root: 'public' });
});

// Admin page (protected)
app.get('/admin', authRequired, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile('admin.html', { root: 'public' });
});

// Auth endpoints
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Try database authentication first (if userManager is available)
    if (userManager) {
      try {
        const user = await userManager.authenticateUser(username, password);
        if (user) {
          // Create database session
          const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
          const userAgent = req.headers['user-agent'];
          const sessionResult = await userManager.createSession(user.id, ipAddress, userAgent);
          
          const secure = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https');
          const cookie = `sp_session=${encodeURIComponent(sessionResult.token)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`;
          res.setHeader('Set-Cookie', cookie);
          
          const next = (req.query && req.query.next) || req.body?.next || '/predictor';
          return res.json({ ok: true, next, user: { username: user.username, role: user.role } });
        }
      } catch (dbError) {
        console.warn('Database authentication failed, trying fallback:', dbError.message);
      }
    }

    // Fallback to legacy authentication
    if (AUTH_PASS && (username || '').toString() === AUTH_USER && (password || '').toString() === AUTH_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, { user: AUTH_USER, exp: Date.now() + SESSION_TTL_MS });
      const secure = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https');
      const cookie = `sp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`;
      res.setHeader('Set-Cookie', cookie);
      const next = (req.query && req.query.next) || req.body?.next || '/predictor';
      return res.json({ ok: true, next, user: { username: AUTH_USER, role: 'admin' } });
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: e && e.message ? e.message : 'login_error' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const token = cookies['sp_session'];
    
    if (token) {
      // Try to delete database session first (if userManager is available)
      if (userManager) {
        try {
          await userManager.deleteSession(token);
        } catch (dbError) {
          console.warn('Database session deletion failed:', dbError.message);
        }
      }
      
      // Also remove from memory sessions
      sessions.delete(token);
    }
    
    const secure = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https');
    res.setHeader('Set-Cookie', `sp_session=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Logout error:', e);
    return res.json({ ok: true });
  }
});

// User Management APIs
app.post('/api/users/register', async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'User registration is not available. Database not initialized.' });
  }

  try {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Basic validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await userManager.createUser({
      username,
      email,
      password,
      fullName,
      role: 'user'
    });

    res.status(201).json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        full_name: user.fullName,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users/profile', authRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'User profile is not available. Database not initialized.' });
  }

  try {
    const user = await userManager.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password_hash, ...userProfile } = user;
    res.json(userProfile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/users/profile', authRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'User profile update is not available. Database not initialized.' });
  }

  try {
    const updates = req.body;
    const allowedFields = ['full_name', 'email'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const success = await userManager.updateUser(req.user.id, filteredUpdates);
    if (success) {
      res.json({ success: true, message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Admin only endpoints
async function adminRequired(req, res, next) {
  try {
    const sess = await getSession(req);
    if (!sess || sess.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = sess.user;
    next();
  } catch (error) {
    console.error('Admin auth check error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

app.get('/api/admin/users', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await userManager.getAllUsers(parseInt(limit), offset);
    const stats = await userManager.getUserStats();
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: stats.total_users
      },
      stats
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:userId', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const allowedFields = ['role', 'status', 'api_quota'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const success = await userManager.updateUser(parseInt(userId), filteredUpdates);
    if (success) {
      res.json({ success: true, message: 'User updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:userId', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { userId } = req.params;
    
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const success = await userManager.deleteUser(parseInt(userId));
    if (success) {
      res.json({ success: true, message: 'User deactivated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Admin user deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Protect direct access to index.html
app.get('/index.html', authRequired, (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Protector for predictor
app.get('/predictor', authRequired, (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Serve static files from public directory (after protected HTML routes)
app.use(express.static('public'));

// Setup endpoint for creating admin accounts
app.post('/api/setup/admin', async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'User management is not available. Database not initialized.' });
  }

  try {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await userManager.getUserByUsername(username);
    if (existingUser) {
      // Update existing user to admin
      const updated = await userManager.updateUser(existingUser.id, {
        role: 'admin',
        api_quota: 10000
      });
      
      if (updated) {
        return res.json({ 
          success: true, 
          message: 'User updated to admin',
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            role: 'admin'
          }
        });
      } else {
        return res.status(500).json({ error: 'Failed to update user to admin' });
      }
    }

    // Create new admin user
    const user = await userManager.createUser({
      username,
      email,
      password,
      fullName,
      role: 'admin'
    });

    // Update API quota for admin
    await userManager.updateUser(user.id, {
      api_quota: 10000
    });

    res.status(201).json({ 
      success: true, 
      message: 'Admin user created successfully',
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        full_name: user.fullName,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Query Records Management APIs
app.get('/api/admin/queries/stats', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase query stats
      const { data: queries, error } = await userManager.supabase
        .from('user_queries')
        .select('type, created_at');

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const stats = {
        total_queries: queries.length,
        stock_queries: queries.filter(q => q.type === 'stock').length,
        ai_queries: queries.filter(q => q.type === 'ai').length,
        today_queries: queries.filter(q => q.created_at.startsWith(today)).length
      };

      res.json({ stats });
    } else {
      // SQLite/PostgreSQL query stats
      const db = userManager.db;
      const stats = await new Promise((resolve, reject) => {
        const sql = `
          SELECT 
            COUNT(*) as total_queries,
            COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
            COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
            COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as today_queries
          FROM user_queries
        `;
        db.get(sql, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({ stats });
    }
  } catch (error) {
    console.error('Query stats error:', error);
    res.status(500).json({ error: 'Failed to load query statistics' });
  }
});

app.get('/api/admin/queries', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { page = 1, limit = 20, user, type, date_from, date_to, keyword } = req.query;
    const offset = (page - 1) * limit;
    
    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase query listing
      let query = userManager.supabase
        .from('user_queries')
        .select(`
          *,
          users (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (user) {
        query = query.eq('username', user);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (date_from) {
        query = query.gte('created_at', date_from);
      }
      if (date_to) {
        query = query.lte('created_at', date_to);
      }
      if (keyword) {
        query = query.or(`content.ilike.%${keyword}%,result.ilike.%${keyword}%`);
      }

      const { data: queries, error } = await query;
      if (error) throw error;

      // Get total count
      let countQuery = userManager.supabase
        .from('user_queries')
        .select('*', { count: 'exact', head: true });

      if (user) countQuery = countQuery.eq('username', user);
      if (type) countQuery = countQuery.eq('type', type);
      if (date_from) countQuery = countQuery.gte('created_at', date_from);
      if (date_to) countQuery = countQuery.lte('created_at', date_to);
      if (keyword) countQuery = countQuery.or(`content.ilike.%${keyword}%,result.ilike.%${keyword}%`);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      res.json({
        queries: queries || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      });
    } else {
      // SQLite/PostgreSQL query listing
      let whereConditions = [];
      let params = [];

      if (user) {
        whereConditions.push('q.username = ?');
        params.push(user);
      }
      if (type) {
        whereConditions.push('q.type = ?');
        params.push(type);
      }
      if (date_from) {
        whereConditions.push('date(q.created_at) >= ?');
        params.push(date_from);
      }
      if (date_to) {
        whereConditions.push('date(q.created_at) <= ?');
        params.push(date_to);
      }
      if (keyword) {
        whereConditions.push('(q.content LIKE ? OR q.result LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
      
      const db = userManager.db;
      
      // 獲取查詢記錄
      const queries = await new Promise((resolve, reject) => {
        const sql = `
          SELECT q.*, u.full_name, u.email
          FROM user_queries q
          LEFT JOIN users u ON q.username = u.username
          ${whereClause}
          ORDER BY q.created_at DESC
          LIMIT ? OFFSET ?
        `;
        db.all(sql, [...params, limit, offset], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // 獲取總數
      const total = await new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count
          FROM user_queries q
          ${whereClause}
        `;
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      res.json({
        queries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (error) {
    console.error('Query list error:', error);
    res.status(500).json({ error: 'Failed to load queries' });
  }
});

app.get('/api/admin/queries/:queryId', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { queryId } = req.params;
    
    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase query detail
      const { data: query, error } = await userManager.supabase
        .from('user_queries')
        .select(`
          *,
          users (
            full_name,
            email
          )
        `)
        .eq('id', queryId)
        .single();

      if (error || !query) {
        return res.status(404).json({ error: 'Query not found' });
      }

      res.json(query);
    } else {
      // SQLite/PostgreSQL query detail
      const db = userManager.db;
      
      const query = await new Promise((resolve, reject) => {
        const sql = `
          SELECT q.*, u.full_name, u.email
          FROM user_queries q
          LEFT JOIN users u ON q.username = u.username
          WHERE q.id = ?
        `;
        db.get(sql, [queryId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!query) {
        return res.status(404).json({ error: 'Query not found' });
      }

      res.json(query);
    }
  } catch (error) {
    console.error('Query detail error:', error);
    res.status(500).json({ error: 'Failed to load query details' });
  }
});

app.delete('/api/admin/queries/:queryId', adminRequired, async (req, res) => {
  if (!userManager) {
    return res.status(503).json({ error: 'Admin features are not available. Database not initialized.' });
  }

  try {
    const { queryId } = req.params;
    
    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase query deletion
      const { error } = await userManager.supabase
        .from('user_queries')
        .delete()
        .eq('id', queryId);

      if (error) {
        return res.status(500).json({ error: 'Failed to delete query' });
      }

      res.json({ success: true, message: 'Query deleted successfully' });
    } else {
      // SQLite/PostgreSQL query deletion
      const db = userManager.db;
      
      const deleted = await new Promise((resolve, reject) => {
        db.run('DELETE FROM user_queries WHERE id = ?', [queryId], function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
      });

      if (deleted) {
        res.json({ success: true, message: 'Query deleted successfully' });
      } else {
        res.status(404).json({ error: 'Query not found' });
      }
    }
  } catch (error) {
    console.error('Delete query error:', error);
    res.status(500).json({ error: 'Failed to delete query' });
  }
});

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

    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase query logging
      const { data, error } = await userManager.supabase
        .from('user_queries')
        .insert([{
          username: username,
          type: type,
          content: content,
          result: result,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({ 
        success: true, 
        queryId: data.id,
        message: 'Query logged successfully' 
      });
    } else {
      // SQLite/PostgreSQL query logging
      const db = userManager.db;
      const insertSQL = `
        INSERT INTO user_queries (username, type, content, result, metadata) 
        VALUES (?, ?, ?, ?, ?)
      `;

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
    }
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

    const metadata = {
      symbol: symbol,
      price: price,
      change: change,
      timestamp: new Date().toISOString()
    };

    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase stock query logging
      const { data, error } = await userManager.supabase
        .from('user_queries')
        .insert([{
          username: username,
          type: 'stock',
          content: query,
          result: result,
          metadata: metadata,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({ 
        success: true, 
        queryId: data.id,
        message: 'Stock query logged successfully' 
      });
    } else {
      // SQLite/PostgreSQL stock query logging
      const db = userManager.db;
      const insertSQL = `
        INSERT INTO user_queries (username, type, content, result, metadata) 
        VALUES (?, 'stock', ?, ?, ?)
      `;

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
    }
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

    const metadata = {
      model: model || 'GPT-4',
      category: category || 'general',
      timestamp: new Date().toISOString()
    };

    if (userManager.constructor.name === 'SupabaseUserManager') {
      // Supabase AI query logging
      const { data, error } = await userManager.supabase
        .from('user_queries')
        .insert([{
          username: username,
          type: 'ai',
          content: question,
          result: answer,
          metadata: metadata,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({ 
        success: true, 
        queryId: data.id,
        message: 'AI query logged successfully' 
      });
    } else {
      // SQLite/PostgreSQL AI query logging
      const db = userManager.db;
      const insertSQL = `
        INSERT INTO user_queries (username, type, content, result, metadata) 
        VALUES (?, 'ai', ?, ?, ?)
      `;

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
    }
  } catch (error) {
    console.error('Log AI query error:', error);
    res.status(500).json({ error: 'Failed to log AI query' });
  }
});

// Admin queries page
app.get('/admin-queries', authRequired, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile('admin-queries.html', { root: 'public' });
});

// Historical data endpoint for backtesting - 使用專業金融數據源
app.post('/historical-data', async (req, res) => {
  try {
    const { symbol, days = 365 } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    console.log(`Fetching historical data for ${symbol} (${days} days) via Financial APIs`);
    
    // 使用新的金融數據源
    const FinancialDataSources = require('./financial_data_sources');
    const dataSource = new FinancialDataSources();
    
    const result = await dataSource.getHistoricalData(symbol, days);
    
    if (result.success) {
      console.log(`✓ ${result.source}: Retrieved ${result.count} days of data`);
      res.json(result);
    } else {
      console.log('All financial APIs failed, using simulated data');
      const simulatedData = generateSimulatedData(symbol, days);
      res.json({
        success: true,
        data: simulatedData,
        source: 'Simulated',
        symbol: symbol,
        count: simulatedData.length,
        warning: 'All financial APIs unavailable, using simulated data'
      });
    }
    
  } catch (error) {
    console.error('Historical data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch historical data',
      message: error.message 
    });
  }
});
        

// Real-time data endpoint for live trading - 使用專業金融數據源
app.get('/realtime/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    console.log(`Fetching real-time data for ${symbol} via Financial APIs`);
    
    // 使用新的金融數據源
    const FinancialDataSources = require('./financial_data_sources');
    const dataSource = new FinancialDataSources();
    
    const result = await dataSource.getRealtimeData(symbol);
    
    if (result.success) {
      console.log(`✓ ${result.source}: Retrieved real-time data for ${symbol}`);
      res.json(result);
    } else {
      console.log('All financial APIs failed, using simulated data');
      const simulatedData = generateSimulatedRealtimeData(symbol);
      res.json({
        success: true,
        data: simulatedData,
        source: 'Simulated',
        warning: 'All financial APIs unavailable, using simulated data'
      });
    }
    
  } catch (error) {
    console.error('Real-time data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch real-time data',
      message: error.message 
    });
  }
});

// 富途 API 整合端點
app.post('/futu/connect', async (req, res) => {
  try {
    const { username, password, host = '127.0.0.1', port = 11111 } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // 這裡應該調用 Python 腳本來連接富途 API
    const { spawn } = require('child_process');
    const python = spawn('python', ['futu_api_integration.py', 'connect', username, password, host, port]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: '富途 API 連接成功',
          output: output
        });
      } else {
        res.status(500).json({
          success: false,
          error: '富途 API 連接失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('富途 API 連接錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 富途實時行情端點
app.get('/futu/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // 調用 Python 腳本獲取富途實時行情
    const { spawn } = require('child_process');
    const python = spawn('python', ['futu_api_integration.py', 'quote', symbol]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析富途數據失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '獲取富途行情失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('富途行情獲取錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 富途下單端點
app.post('/futu/order', async (req, res) => {
  try {
    const { symbol, price, quantity, side, order_type = 'NORMAL', env = 'SIMULATE' } = req.body;
    
    if (!symbol || !price || !quantity || !side) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // 調用 Python 腳本執行下單
    const { spawn } = require('child_process');
    const python = spawn('python', [
      'futu_api_integration.py', 
      'order', 
      symbol, 
      price, 
      quantity, 
      side, 
      order_type, 
      env
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析下單結果失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '下單失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('富途下單錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 富途持倉查詢端點
app.get('/futu/positions', async (req, res) => {
  try {
    const { env = 'SIMULATE' } = req.query;
    
    // 調用 Python 腳本查詢持倉
    const { spawn } = require('child_process');
    const python = spawn('python', ['futu_api_integration.py', 'positions', env]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析持倉數據失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '查詢持倉失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('富途持倉查詢錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 機器學習模型訓練端點
app.post('/ml/train', async (req, res) => {
  try {
    const { model_type, symbol, period = 252 } = req.body;
    
    if (!model_type || !symbol) {
      return res.status(400).json({ error: 'Model type and symbol are required' });
    }
    
    console.log(`Training ${model_type} model for ${symbol}`);
    
    // 調用 Python 腳本訓練模型
    const { spawn } = require('child_process');
    const python = spawn('python', [
      'ml_trading_models.py', 
      'train', 
      model_type, 
      symbol, 
      period.toString()
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析訓練結果失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '模型訓練失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('機器學習訓練錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 機器學習預測端點
app.post('/ml/predict', async (req, res) => {
  try {
    const { model_type, symbol, features } = req.body;
    
    if (!model_type || !symbol) {
      return res.status(400).json({ error: 'Model type and symbol are required' });
    }
    
    console.log(`Predicting with ${model_type} model for ${symbol}`);
    
    // 調用 Python 腳本進行預測
    const { spawn } = require('child_process');
    const python = spawn('python', [
      'ml_trading_models.py', 
      'predict', 
      model_type, 
      symbol
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析預測結果失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '模型預測失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('機器學習預測錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 高級策略分析端點
app.post('/strategy/analyze', async (req, res) => {
  try {
    const { strategy_type, symbol1, symbol2, parameters = {} } = req.body;
    
    if (!strategy_type) {
      return res.status(400).json({ error: 'Strategy type is required' });
    }
    
    console.log(`Analyzing ${strategy_type} strategy`);
    
    // 調用 Python 腳本進行策略分析
    const { spawn } = require('child_process');
    const python = spawn('python', [
      'advanced_trading_strategies.py', 
      'analyze', 
      strategy_type, 
      symbol1 || '', 
      symbol2 || '',
      JSON.stringify(parameters)
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析策略分析結果失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '策略分析失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('策略分析錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 投資組合優化端點
app.post('/portfolio/optimize', async (req, res) => {
  try {
    const { symbols, method = 'max_sharpe', risk_free_rate = 0.02 } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
      return res.status(400).json({ error: 'At least 2 symbols are required' });
    }
    
    console.log(`Optimizing portfolio for ${symbols.join(', ')}`);
    
    // 調用 Python 腳本進行投資組合優化
    const { spawn } = require('child_process');
    const python = spawn('python', [
      'advanced_trading_strategies.py', 
      'optimize', 
      JSON.stringify(symbols),
      method,
      risk_free_rate.toString()
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          res.json({
            success: true,
            data: data
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: '解析投資組合優化結果失敗',
            details: output
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: '投資組合優化失敗',
          details: error
        });
      }
    });
    
  } catch (error) {
    console.error('投資組合優化錯誤:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 初始化多用戶系統
const multiUserSystem = new MultiUserSystem();
app.locals.multiUserSystem = multiUserSystem;

// 初始化安全中間件
const securityMiddleware = new SecurityMiddleware();
const middlewares = securityMiddleware.getMiddlewares();

// 應用安全中間件
app.use(middlewares.securityHeaders);
app.use(middlewares.cors);
app.use(middlewares.globalRateLimit);
app.use(middlewares.logRequest);

// 多用戶 API 端點
// 用戶註冊
app.post('/api/auth/register', middlewares.loginRateLimit, async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用戶名、郵箱和密碼是必需的' });
    }
    
    const result = await multiUserSystem.registerUser({ username, email, password, role });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('用戶註冊錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// 用戶登錄
app.post('/api/auth/login', middlewares.loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用戶名和密碼是必需的' });
    }
    
    const result = await multiUserSystem.loginUser(username, password);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('用戶登錄錯誤:', error);
    res.status(401).json({ error: error.message });
  }
});

// 獲取用戶信息
app.get('/api/auth/user', middlewares.authenticateToken, (req, res) => {
  try {
    const userData = multiUserSystem.getUserData(req.user.userId);
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('獲取用戶信息錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新用戶數據
app.put('/api/auth/user', middlewares.authenticateToken, (req, res) => {
  try {
    const { settings, portfolio } = req.body;
    const userData = multiUserSystem.updateUserData(req.user.userId, { settings, portfolio });
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('更新用戶數據錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 獲取用戶列表（僅管理員）
app.get('/api/admin/users', middlewares.authenticateToken, middlewares.requirePermission('canViewAllUsers'), (req, res) => {
  try {
    const userList = multiUserSystem.getUserList(req.user.userId);
    res.json({ success: true, data: userList });
  } catch (error) {
    console.error('獲取用戶列表錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新用戶狀態（僅管理員）
app.put('/api/admin/users/:userId/status', middlewares.authenticateToken, middlewares.requirePermission('canManageUsers'), (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const result = multiUserSystem.updateUserStatus(userId, status, req.user.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新用戶狀態錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 獲取系統統計（僅管理員）
app.get('/api/admin/stats', middlewares.authenticateToken, middlewares.requirePermission('canManageSystem'), (req, res) => {
  try {
    const stats = multiUserSystem.getSystemStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('獲取系統統計錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 應用錯誤處理中間件
app.use(middlewares.errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 交易系統服務器啟動在 http://localhost:${PORT}`);
  console.log(`📊 前端地址: http://localhost:8080`);
  console.log(`🔧 API 地址: http://localhost:${PORT}/api`);
  console.log(`🏥 健康檢查: http://localhost:${PORT}/health`);
});


