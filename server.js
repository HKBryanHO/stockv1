import express from 'express';
import cors from 'cors';
import https from 'https';
import dotenv from 'dotenv';
import http from 'http';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';
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

// Minimal in-memory session store
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
function getSession(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['sp_session'];
    if (!token) return null;
    const rec = sessions.get(token);
    if (!rec) return null;
    if (Date.now() > rec.exp) { sessions.delete(token); return null; }
    return { token, user: rec.user };
  } catch { return null; }
}
function authRequired(req, res, next) {
  const sess = getSession(req);
  if (sess) return next();
  // redirect to login preserving destination
  const dest = encodeURIComponent(req.originalUrl || '/predictor');
  return res.redirect(`/login?next=${dest}`);
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
          const zlib = require('zlib');
          stream = r.pipe(zlib.createGunzip());
        } else if (r.headers['content-encoding'] === 'deflate') {
          const zlib = require('zlib');
          stream = r.pipe(zlib.createInflate());
        } else if (r.headers['content-encoding'] === 'br') {
          const zlib = require('zlib');
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
        const zlib = require('zlib');
        stream = r.pipe(zlib.createGunzip());
      } else if (r.headers['content-encoding'] === 'deflate') {
        const zlib = require('zlib');
        stream = r.pipe(zlib.createInflate());
      } else if (r.headers['content-encoding'] === 'br') {
        const zlib = require('zlib');
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
      .finally(() => pending.delete(url));
    pending.set(url, p);
    const result = await p;
    res.setHeader('Content-Type', 'application/json');
    return res.status(result.status).send(result.body);
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Proxy error' });
  }
});

// Batch market insights: unified OHLCV (Alpha) + live price (Yahoo)
app.get('/api/market/insights', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols || '').toString();
    const symbols = symbolsParam
      ? symbolsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : ['NVDA','PLTR','MSFT','GOOGL','9988.HK','0700.HK','AVGO','AMD','IONQ','LLY','ABBV'];

    const normalizeSymbol = (s) => {
      if (!s) return s;
      const map = { 'TSMC': 'TSM' };
      if (map[s]) return map[s];
      return s;
    };

    const fetchChartYahoo = async (symbolRaw) => {
      const symbol = normalizeSymbol(symbolRaw);
      const u1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&events=history&includeAdjustedClose=true`;
      let { status, body } = await tryFetchWithFallback(u1);
      if (status !== 200 || !body) {
        const u2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&events=history&includeAdjustedClose=true`;
        const r2 = await tryFetchWithFallback(u2);
        status = r2.status; body = r2.body;
      }
      if (status !== 200 || !body) return { ok: false };
      let j;
      try { j = JSON.parse(body); } catch { return { ok: false }; }
      const r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r) return { ok: false };
      const timestamps = r.timestamp || [];
      const quote = r.indicators && r.indicators.quote && r.indicators.quote[0] || {};
      const closes = (quote.close || []).map((v) => Number(v));
      const volumes = (quote.volume || []).map((v) => Number(v || 0));
      const dates = timestamps.map((t) => new Date(t * 1000).toISOString().slice(0,10));
      return { ok: true, dates, closes, volumes };
    };

    const fetchQuoteYahoo = async (symbolRaw) => {
      const symbol = normalizeSymbol(symbolRaw);
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      try {
        const { body } = await fetchJson(url);
        const j = JSON.parse(body);
        const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
        const price = r ? (r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice) : undefined;
        return isFinite(price) ? Number(price) : NaN;
      } catch {
        return NaN;
      }
    };

    const series = {};
    const charts = await Promise.all(symbols.map((s) => fetchChartYahoo(s)));
    const quotes = await Promise.all(symbols.map((s) => fetchQuoteYahoo(s)));
    symbols.forEach((sym, idx) => {
      const ch = charts[idx];
      if (!ch || !ch.ok) return;
      const closes = ch.closes.slice();
      const lp = quotes[idx];
      if (isFinite(lp) && closes.length) closes[closes.length - 1] = lp;
      series[sym] = { dates: ch.dates, closes, volumes: ch.volumes };
    });

    return res.json({ symbols, series, updatedAt: new Date().toISOString() });
  } catch (e) {
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
      } catch {
        return { symbol: sym, ok: false };
      }
    }).catch(() => ({ symbol: sym, ok: false }));
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
    return res.status(500).json({ error: e.message || 'yahoo_chart_error' });
  }
});

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
    }).finally(() => grokPending.delete(coalesceKey));
    grokPending.set(coalesceKey, p);
    const forward = await p;

    res.setHeader('Content-Type', forward.headers['content-type'] || 'application/json');
    recordMetric('/api/grok/chat', Date.now() - start, forward.status >= 200 && forward.status < 400);
    // OpenRouter-only setup; no fallback needed
    return res.status(forward.status).send(forward.body);
  } catch (e) {
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

// Root route -> login homepage
app.get('/', (req, res) => {
  return res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile('login.html', { root: 'public' });
});

// Auth endpoints
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!AUTH_PASS) {
      return res.status(500).json({ error: 'AUTH_PASSWORD not configured on server' });
    }
    if ((username || '').toString() !== AUTH_USER || (password || '').toString() !== AUTH_PASS) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { user: AUTH_USER, exp: Date.now() + SESSION_TTL_MS });
    const secure = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https');
    const cookie = `sp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`;
    res.setHeader('Set-Cookie', cookie);
    const next = (req.query && req.query.next) || req.body?.next || '/predictor';
    return res.json({ ok: true, next });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'login_error' });
  }
});

app.post('/auth/logout', (req, res) => {
  try {
    const cookies = parseCookies(req);
    const token = cookies['sp_session'];
    if (token) sessions.delete(token);
    const secure = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https');
    res.setHeader('Set-Cookie', `sp_session=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`);
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: true });
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

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});


