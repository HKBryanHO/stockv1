import express from 'express';
import cors from 'cors';
import https from 'https';
import dotenv from 'dotenv';
import http from 'http';
import { createClient } from 'redis';
import * as math from 'mathjs';
import cron from 'node-cron';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
// Ops helpers: rate limit, coalescing, telemetry, safety
const RL_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RL_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
const rateMap = new Map();
const grokPending = new Map();
const metrics = { routes: {}, startedAt: new Date().toISOString() };
// Prompt templates admin (shared shape)
let promptTemplates = {
  versions: {
    v1: { analyst: 'You are a helpful financial analysis assistant.', risk: 'Focus on risks and mitigations.', news: 'Summarize headlines into TL;DR with risks and catalysts.', screener: 'Transform NL request into stock filters and return candidates.' }
  },
  active: 'v1',
  ab: { v1: 100 }
};

function recordMetric(route, ms, ok) {
  const r = metrics.routes[route] || (metrics.routes[route] = { requests: 0, errors: 0, avgMs: 0 });
  r.requests += 1;
  if (!ok) r.errors += 1;
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

app.get('/api/metrics', (req, res) => {
  res.json(metrics);
});

// ---- Backend Alerts (Redis/memory) ----
const ALERTS_KEY = 'alerts:list';
async function readAlertsStore() {
  try {
    if (redisClient && redisClient.isOpen) {
      const raw = await redisClient.get(ALERTS_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (e) { /* fallthrough */ }
  return memoryCache.get(ALERTS_KEY) || [];
}
async function writeAlertsStore(list) {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.set(ALERTS_KEY, JSON.stringify(list));
      return;
    }
  } catch (e) { /* fallthrough */ }
  memoryCache.set(ALERTS_KEY, list);
}
function makeAlertId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

app.get('/api/alerts', async (req, res) => {
  try {
    const list = await readAlertsStore();
    res.json({ alerts: list });
  } catch (e) {
    res.status(500).json({ error: e.message || 'alerts_read_error' });
  }
});

app.post('/api/alerts', async (req, res) => {
  try {
    const { symbol, dir = '>=', price } = req.body || {};
    const sym = (symbol || '').toString().trim();
    const p = Number(price);
    if (!sym || !isFinite(p)) return res.status(400).json({ error: 'symbol_and_price_required' });
    if (dir !== '>=' && dir !== '<=') return res.status(400).json({ error: 'invalid_dir' });
    const list = await readAlertsStore();
    const alert = { id: makeAlertId(), symbol: sym, dir, price: p, fired: false, createdAt: Date.now() };
    list.push(alert);
    await writeAlertsStore(list);
    res.json({ ok: true, alert });
  } catch (e) {
    res.status(500).json({ error: e.message || 'alerts_create_error' });
  }
});

app.delete('/api/alerts/:id', async (req, res) => {
  try {
    const id = (req.params.id || '').toString();
    const list = await readAlertsStore();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      await writeAlertsStore(list);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'alerts_delete_error' });
  }
});

// Evaluate alerts every minute
async function evaluateAlerts() {
  try {
    const list = await readAlertsStore();
    const active = list.filter(a => !a.fired);
    if (!active.length) return;
    const bySymbol = new Map();
    active.forEach(a => { if (!bySymbol.has(a.symbol)) bySymbol.set(a.symbol, []); bySymbol.get(a.symbol).push(a); });
    for (const [sym, arr] of bySymbol.entries()) {
      try {
        const y1 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
        let { status, body } = await tryFetchWithFallback(y1);
        if (status !== 200 || !body) {
          const y2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
          const r2 = await tryFetchWithFallback(y2);
          status = r2.status; body = r2.body;
        }
        if (status !== 200 || !body) continue;
        const j = JSON.parse(body || '{}');
        const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
        const price = r ? (r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice) : null;
        if (!isFinite(price)) continue;
        let changed = false;
        for (const a of list) {
          if (a.symbol !== sym || a.fired) continue;
          const hit = (a.dir === '>=') ? (price >= a.price) : (price <= a.price);
          if (hit) { a.fired = true; a.firedAt = Date.now(); a.lastPrice = Number(price); changed = true; }
        }
        if (changed) await writeAlertsStore(list);
      } catch (_) { /* ignore per symbol */ }
    }
  } catch (_) { /* ignore */ }
}
cron.schedule('*/1 * * * *', evaluateAlerts);

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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_API_BASE = (process.env.XAI_API_BASE || '').trim();
const XAI_MODEL = (process.env.XAI_MODEL || '').trim();
const XAI_FALLBACK_API_BASE = (process.env.XAI_FALLBACK_API_BASE || '').trim();
const XAI_FALLBACK_MODEL = (process.env.XAI_FALLBACK_MODEL || '').trim();
const REDIS_URL = (process.env.REDIS_URL || '').trim();

// Redis client setup
let redisClient = null;
if (REDIS_URL) {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    redisClient.on('connect', () => console.log('Redis connected successfully'));
    // Connect asynchronously; if it fails, in-memory cache will be used
    redisClient.connect().catch(() => {
      console.log('Redis connect failed; using in-memory cache');
    });
  } catch (error) {
    console.log('Redis init failed; using in-memory cache');
  }
} else {
  console.log('REDIS_URL not set; using in-memory cache');
}

// Fallback in-memory cache
const memoryCache = new Map();
const pending = new Map();

// Cache helper functions
async function getCache(key) {
  if (redisClient && redisClient.isOpen) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.log('Redis get error:', error.message);
      return memoryCache.get(key) || null;
    }
  }
  return memoryCache.get(key) || null;
}

async function setCache(key, value, ttlSeconds = 300) {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.log('Redis set error:', error.message);
      memoryCache.set(key, value);
    }
  } else {
    memoryCache.set(key, value);
  }
}

function fetchAlphaJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 200, body: data }));
      })
      .on('error', (e) => reject(e));
  });
}

// Enhanced Alpha Vantage proxy with Redis caching
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

    // Check cache first
    const cacheKey = `alphavantage:${Buffer.from(url).toString('base64')}`;
    const cached = await getCache(cacheKey);
    
    if (cached && now - cached.ts < (cached.status === 200 ? ttlMs : negativeTtlMs)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(cached.status).send(cached.body);
    }

    // Check pending requests
    if (pending.has(url)) {
      const result = await pending.get(url);
      res.setHeader('Content-Type', 'application/json');
      return res.status(result.status).send(result.body);
    }

    const p = fetchAlphaJson(url)
      .then(async ({ status, body }) => {
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
        await setCache(cacheKey, record, outStatus === 200 ? 300 : 30);
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

// Enhanced monitoring with Redis persistence
const monitorState = { lastRun: null, items: [] };
const WATCHLIST = ['AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN'];

async function refreshWatchlist() {
  const promises = WATCHLIST.map(async (sym) => {
    try {
      const u1 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      let { status, body } = await tryFetchWithFallback(u1);
      if (status !== 200 || !body) {
        const u2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
        const r2 = await tryFetchWithFallback(u2);
        status = r2.status; body = r2.body;
      }
      const j = JSON.parse(body || '{}');
      const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
      if (!r) return { symbol: sym, ok: false };
      const lastClose = Number(r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice);
      const prevClose = Number(r.regularMarketPreviousClose ?? lastClose);
      const dailyReturnPct = (isFinite(lastClose) && isFinite(prevClose) && prevClose) ? ((lastClose/prevClose - 1) * 100) : 0;
      return { symbol: sym, ok: true, lastClose, dailyReturnPct, timestamp: new Date().toISOString() };
    } catch {
      return { symbol: sym, ok: false };
    }
  });

  monitorState.items = await Promise.all(promises);
  monitorState.lastRun = new Date().toISOString();
  await setCache('monitor:watchlist', monitorState, 600);
}

// Schedule monitoring job
cron.schedule('*/5 * * * *', refreshWatchlist); // Every 5 minutes
refreshWatchlist().catch(() => {});

app.get('/api/monitor/status', async (req, res) => {
  try {
    const cached = await getCache('monitor:watchlist');
    if (cached) {
      return res.json(cached);
    }
    res.json(monitorState);
  } catch (error) {
    res.json(monitorState);
  }
});

// Nightly prewarm Top N symbol summaries using Grok analyze
const PREWARM_SYMBOLS = ['NVDA','MSFT','AAPL','GOOGL','AMZN','TSLA','META','AMD','AVGO','LLY'];
async function prewarmGrok() {
  try {
    const apiKeyToUse = XAI_API_KEY;
    if (!apiKeyToUse) return;
    for (const sym of PREWARM_SYMBOLS) {
      try {
        // reuse market insights for series
        const p = new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact', apikey: ALPHA_KEY });
        const url = `https://www.alphavantage.co/query?${p.toString()}`;
        const { body } = await fetchAlphaJson(url);
        const j = JSON.parse(body);
        const ts = j && j['Time Series (Daily)'];
        if (!ts) continue;
        const dates = Object.keys(ts).sort();
        const closes = dates.map((d) => parseFloat(ts[d]['4. close']));
        const volumes = dates.map((d) => parseFloat(ts[d]['5. volume'] || '0'));
        const payload = { apiKey: apiKeyToUse, symbol: sym, series: { dates, closes, volumes } };
        await fetchJsonLike(`${XAI_API_BASE || 'https://api.x.ai/v1/chat/completions'}`, payload).catch(()=>{});
      } catch {}
    }
  } catch {}
}

function fetchJsonLike(_unused, _body) { return Promise.resolve({ status: 200 }); }

// Schedule nightly at 02:30
cron.schedule('30 2 * * *', prewarmGrok);

// Enhanced quantitative models
class QuantitativeModels {
  // Box-Muller transform for normal random numbers
  static boxMuller() {
    const u = Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Geometric Brownian Motion with enhanced parameters
  static simulateGBM(S0, mu, sigma, T, n, paths) {
    const dt = T / n;
    const results = [];
    
    for (let p = 0; p < paths; p++) {
      const path = [S0];
      let S = S0;
      
      for (let i = 1; i <= n; i++) {
        const Z = this.boxMuller();
        S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z);
        path.push(S);
      }
      results.push(path);
    }
    
    return results;
  }

  // Jump Diffusion Model (Merton Model)
  static simulateJumpDiffusion(S0, mu, sigma, lambda, jumpMean, jumpStd, T, n, paths) {
    const dt = T / n;
    const results = [];
    
    for (let p = 0; p < paths; p++) {
      const path = [S0];
      let S = S0;
      
      for (let i = 1; i <= n; i++) {
        const Z = this.boxMuller();
        const jump = Math.random() < lambda * dt ? this.boxMuller() * jumpStd + jumpMean : 0;
        S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z + jump);
        path.push(S);
      }
      results.push(path);
    }
    
    return results;
  }

  // Heston Stochastic Volatility Model
  static simulateHeston(S0, mu, kappa, theta, sigma, rho, v0, T, n, paths) {
    const dt = T / n;
    const results = [];
    
    for (let p = 0; p < paths; p++) {
      const path = [S0];
      const volPath = [v0];
      let S = S0;
      let v = v0;
      
      for (let i = 1; i <= n; i++) {
        const Z1 = this.boxMuller();
        const Z2 = this.boxMuller();
        const Z2Corr = rho * Z1 + Math.sqrt(1 - rho * rho) * Z2;
        
        // Update volatility
        v = Math.max(0, v + kappa * (theta - v) * dt + sigma * Math.sqrt(v) * Math.sqrt(dt) * Z2Corr);
        
        // Update price
        S = S * Math.exp((mu - 0.5 * v) * dt + Math.sqrt(v) * Math.sqrt(dt) * Z1);
        
        path.push(S);
        volPath.push(v);
      }
      results.push({ price: path, volatility: volPath });
    }
    
    return results;
  }

  // GARCH(1,1) Model
  static simulateGARCH(S0, mu, omega, alpha, beta, T, n, paths) {
    const dt = T / n;
    const results = [];
    
    for (let p = 0; p < paths; p++) {
      const path = [S0];
      const volPath = [Math.sqrt(omega / (1 - alpha - beta))]; // Long-term variance
      let S = S0;
      let sigma2 = volPath[0] * volPath[0];
      
      for (let i = 1; i <= n; i++) {
        const Z = this.boxMuller();
        const return_t = (S / path[i-1] - 1) || 0;
        
        // Update GARCH variance
        sigma2 = omega + alpha * return_t * return_t + beta * sigma2;
        const sigma = Math.sqrt(sigma2);
        
        // Update price
        S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z);
        
        path.push(S);
        volPath.push(sigma);
      }
      results.push({ price: path, volatility: volPath });
    }
    
    return results;
  }

  // Calculate quantiles from simulation results
  static calculateQuantiles(simulations, quantiles = [0.05, 0.25, 0.5, 0.75, 0.95]) {
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

// Enhanced simulation endpoints
app.post('/api/sim/jump', async (req, res) => {
  try {
    const { closes = [], days = 21, paths = 5000 } = req.body || {};
    
    if (!Array.isArray(closes) || closes.length === 0) {
      return res.json({ q05: [], q50: [], q95: [] });
    }

    const lastPrice = closes[closes.length - 1];
    
    // Estimate parameters from historical data
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i-1]));
    }
    
    const meanReturn = math.mean(returns);
    const variance = math.variance(returns);
    const sigma = Math.sqrt(variance * 252); // Annualized
    const mu = meanReturn * 252; // Annualized
    
    // Jump diffusion parameters (estimated)
    const lambda = 0.1; // Jump frequency
    const jumpMean = 0.0; // Jump mean
    const jumpStd = 0.02; // Jump standard deviation
    
    const simulations = QuantitativeModels.simulateJumpDiffusion(
      lastPrice, mu, sigma, lambda, jumpMean, jumpStd, days/252, days, paths
    );
    
    const quantiles = QuantitativeModels.calculateQuantiles(simulations);
    
    res.json({
      q05: quantiles.q5,
      q50: quantiles.q50,
      q95: quantiles.q95,
      model: 'Jump Diffusion',
      parameters: { mu, sigma, lambda, jumpMean, jumpStd }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sim/heston', async (req, res) => {
  try {
    const { closes = [], days = 21, paths = 5000 } = req.body || {};
    
    if (!Array.isArray(closes) || closes.length === 0) {
      return res.json({ q05: [], q50: [], q95: [] });
    }

    const lastPrice = closes[closes.length - 1];
    
    // Estimate parameters from historical data
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i-1]));
    }
    
    const meanReturn = math.mean(returns);
    const variance = math.variance(returns);
    const sigma = Math.sqrt(variance * 252);
    const mu = meanReturn * 252;
    
    // Heston parameters (estimated)
    const kappa = 2.0; // Mean reversion speed
    const theta = variance * 252; // Long-term variance
    const sigma_vol = 0.3; // Volatility of volatility
    const rho = -0.7; // Correlation
    const v0 = variance * 252; // Initial variance
    
    const simulations = QuantitativeModels.simulateHeston(
      lastPrice, mu, kappa, theta, sigma_vol, rho, v0, days/252, days, paths
    );
    
    const priceSimulations = simulations.map(sim => sim.price);
    const quantiles = QuantitativeModels.calculateQuantiles(priceSimulations);
    
    res.json({
      q05: quantiles.q5,
      q50: quantiles.q50,
      q95: quantiles.q95,
      model: 'Heston Stochastic Volatility',
      parameters: { mu, kappa, theta, sigma_vol, rho, v0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sim/garch', async (req, res) => {
  try {
    const { closes = [], days = 21, paths = 5000 } = req.body || {};
    
    if (!Array.isArray(closes) || closes.length === 0) {
      return res.json({ q05: [], q50: [], q95: [] });
    }

    const lastPrice = closes[closes.length - 1];
    
    // Estimate GARCH parameters from historical data
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i-1]));
    }
    
    const meanReturn = math.mean(returns);
    const variance = math.variance(returns);
    const mu = meanReturn * 252;
    
    // GARCH(1,1) parameters (estimated)
    const omega = variance * 0.1; // Base variance
    const alpha = 0.1; // ARCH coefficient
    const beta = 0.85; // GARCH coefficient
    
    const simulations = QuantitativeModels.simulateGARCH(
      lastPrice, mu, omega, alpha, beta, days/252, days, paths
    );
    
    const priceSimulations = simulations.map(sim => sim.price);
    const quantiles = QuantitativeModels.calculateQuantiles(priceSimulations);
    
    res.json({
      q05: quantiles.q5,
      q50: quantiles.q50,
      q95: quantiles.q95,
      model: 'GARCH(1,1)',
      parameters: { mu, omega, alpha, beta }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    redis: redisClient && redisClient.isOpen ? 'connected' : 'disconnected',
    memoryCache: memoryCache.size,
    uptime: process.uptime()
  };
  res.json(health);
});

// xAI Grok config (model/base) for frontend awareness
app.get('/api/grok/config', (req, res) => {
  res.json({
    model: XAI_MODEL || 'grok-2-latest',
    base: XAI_API_BASE || 'https://api.x.ai/v1/chat/completions'
  });
});

// Serve static files from public directory
app.use(express.static('public'));

// Root route - serve BMA-HK homepage
app.get('/', (req, res) => {
  res.sendFile('home.html', { root: 'public' });
});

// Predictor subpage
app.get('/predictor', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Enhanced proxy server listening on http://localhost:${PORT}`);
  console.log(`Redis: ${redisClient && redisClient.isOpen ? 'Connected' : 'Not available'}`);
});

// xAI Grok chat proxy (secure backend only)
app.post('/api/grok/chat', async (req, res) => {
  try {
    const start = Date.now();
    if (!rateLimitOk(req.ip, '/api/grok/chat')) return res.status(429).json({ error: 'rate_limited' });
    // Allow per-request API key via header or body
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    }

    const body = req.body || {};
    const messages = sanitizeMessages(Array.isArray(body.messages) ? body.messages : []);
    const model = (body.model || XAI_MODEL || 'grok-2-latest').toString();
    const stream = Boolean(body.stream);

    const baseUrl = XAI_API_BASE || 'https://api.x.ai/v1/chat/completions';
    const urlObj = new URL(baseUrl);
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
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Accept': 'application/json'
      }
    };

    const coalesceKey = `chat:${model}:${JSON.stringify(messages)}`;
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
    if (forward.status >= 500 && XAI_FALLBACK_API_BASE) {
      try {
        const fbUrl = new URL(XAI_FALLBACK_API_BASE);
        const fbOptions = { ...options, hostname: fbUrl.hostname, port: fbUrl.port || 443, path: fbUrl.pathname + (fbUrl.search || '') };
        const fbBody = JSON.stringify({ ...JSON.parse(requestPayload), model: (XAI_FALLBACK_MODEL || model) });
        const fb = await new Promise((resolve, reject) => {
          const rq = (fbUrl.protocol === 'https:' ? https : http).request(fbOptions, (r) => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=> resolve({ status:r.statusCode||500, body:d, headers:r.headers })); });
          rq.on('error', reject); rq.write(fbBody); rq.end();
        });
        res.setHeader('Content-Type', fb.headers['content-type'] || 'application/json');
        return res.status(fb.status).send(fb.body);
      } catch (_) {}
    }
    return res.status(forward.status).send(forward.body);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_proxy_error' });
  }
});

// xAI Grok streaming endpoint (SSE) with optimized server
app.post('/api/grok/stream', async (req, res) => {
  try {
    if (!rateLimitOk(req.ip, '/api/grok/stream')) { res.status(429); res.write('event: error\n'); res.write('data: rate_limited\n\n'); return res.end(); }
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    }

    const body = req.body || {};
    const messages = sanitizeMessages(Array.isArray(body.messages) ? body.messages : []);
    const model = (body.model || XAI_MODEL || 'grok-2-latest').toString();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

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
        'Accept': 'text/event-stream'
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
                  const safe = delta.replace(/\r?\n/g, '\\n');
                  res.write(`data: ${safe}\n\n`);
                }
              } catch {
                res.write(`data: ${payload}\n\n`);
              }
            } else {
              res.write(`: ${line}\n\n`);
            }
          }
        } catch (_) {}
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

    req.on('close', () => {
      try { upstream.destroy(); } catch {}
    });
  } catch (e) {
    try {
      res.write('event: error\n');
      res.write(`data: ${e && e.message ? e.message : 'grok_stream_error'}\n\n`);
    } finally {
      res.end();
    }
  }
});

// xAI Grok analysis endpoint: accept { symbol, series } and return structured insights
app.post('/api/grok/analyze', async (req, res) => {
  try {
    // Allow per-request API key via header or body
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    }
    const body = req.body || {};
    const symbol = (body.symbol || '').toString();
    const series = body.series || {};
    const modelForAnalyze = XAI_MODEL || 'grok-2-latest';
    const closes = Array.isArray(series.closes) ? series.closes : [];
    const dates = Array.isArray(series.dates) ? series.dates : [];
    // Redis/in-memory cache key
    const cacheKey = `grok:analyze:${modelForAnalyze}:${symbol}:${closes.length}:${dates.length}:${closes.slice(-5).join(',')}:${(dates.slice(-2)||[]).join(',')}`;
    const ttlSeconds = 600; // 10 minutes
    const latest = closes.length ? closes[closes.length - 1] : null;

    // Try cache first
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
      }
    } catch (_) {}

    const payload = {
      model: modelForAnalyze,
      messages: [
        { role: 'system', content: 'You are a senior equity analyst. Return concise JSON.' },
        { role: 'user', content: `Analyze ${symbol} with this JSON time series (daily closes, volumes, dates). Return strict JSON keys: summary, risks, levels {support,resistance}, outlook, actions. Series: ${JSON.stringify({ symbol, series, latest })}` }
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
      try { await setCache(cacheKey, outStr, ttlSeconds); } catch (_) {}
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(outStr);
    } catch {
      return res.status(response.status).send(response.body);
    }
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_analyze_error' });
  }
});

// Natural Language Screener with Redis/memory cache
app.post('/api/grok/screener', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    }
    const body = req.body || {};
    const nlQuery = (body.query || '').toString().trim();
    if (!nlQuery) return res.status(400).json({ error: 'query required' });
    let universe = Array.isArray(body.universe) ? body.universe.map((s)=> (s||'').toString().trim()).filter(Boolean) : [];
    const size = Math.min(20, Math.max(1, Number(body.size || 10)));
    if (!universe.length) {
      universe = ['NVDA','MSFT','AAPL','AMZN','GOOGL','META','TSLA','AMD','AVGO','ORCL','LLY','ABBV','NFLX','CRM','INTC','ADBE','SHOP','BABA','0700.HK','9988.HK'];
    }

    const modelId = XAI_MODEL || 'grok-2-latest';
    const cacheKey = `grok:screener:${modelId}:${nlQuery}:${universe.join(',')}:${size}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
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

    const instruction = `You are a senior equity screener. Given a user natural-language screening request and a dataset of symbols with metrics, select up to ${size} symbols that best match. Return strict JSON: { criteria_explained: string, selected: string[], reasons: { [symbol]: string }, risks?: string[] }`;
    const messages = [
      { role: 'system', content: instruction },
      { role: 'user', content: `Request: ${nlQuery}\n\nUniverse size: ${dataset.length}\nMetrics JSON: ${JSON.stringify(dataset).slice(0, 35000)}\n\nReturn JSON only.` }
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

    const responseObj = { query: nlQuery, universe, size, result: out, data: dataset };
    const outStr = JSON.stringify(responseObj);
    await setCache(cacheKey, outStr, 600);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_screener_error' });
  }
});

// News insights TL;DR with Redis cache
app.post('/api/grok/news-insights', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    const body = req.body || {};
    const symbol = (body.symbol || '').toString().trim();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const lookbackDays = Math.min(30, Math.max(1, Number(body.lookbackDays || 7)));

    const modelId = XAI_MODEL || 'grok-2-latest';
    const cacheKey = `grok:news:${modelId}:${symbol}:${lookbackDays}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
    }

    const q = encodeURIComponent(`${symbol} stock news ${new Date().getFullYear()}`);
    const url = `https://duckduckgo.com/html/?q=${q}`;
    const { body: html } = await fetchJson(url);
    const items = [];
    const regex = /<a[^>]*class=\"result__a\"[^>]*>(.*?)<\/a>/gi;
    let m;
    while ((m = regex.exec(html || '')) !== null) {
      const raw = m[1] || '';
      const text = raw.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (text) items.push(text);
      if (items.length >= 8) break;
    }
    const headlines = items.slice(0, 8);

    const textAgg = headlines.join(' ').toLowerCase();
    const posWords = ['beat','surge','rally','buy','upgrade','bullish','record','growth','strong','outperform'];
    const negWords = ['miss','fall','drop','plunge','sell','downgrade','bearish','weak','underperform','cuts'];
    let pos = 0, neg = 0;
    posWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; pos += c; });
    negWords.forEach(w => { const c = (textAgg.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length; neg += c; });
    const total = pos + neg;
    const score = total > 0 ? Math.max(-1, Math.min(1, (pos - neg) / total)) : 0;

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
    await setCache(cacheKey, outStr, 600);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_news_error' });
  }
});

// Peers compare benchmarking with Redis cache
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

    const modelId = XAI_MODEL || 'grok-2-latest';
    const cacheKey = `grok:peers:${modelId}:${universe.join(',')}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
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
    await setCache(cacheKey, outStr, 600);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_peers_error' });
  }
});

// Portfolio Doctor with Redis cache
app.post('/api/grok/portfolio-doctor', async (req, res) => {
  try {
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    const body = req.body || {};
    const holdings = Array.isArray(body.holdings) ? body.holdings : [];
    if (!holdings.length) return res.status(400).json({ error: 'holdings required' });
    const budget = Number(body.budget || 100000);

    const modelId = XAI_MODEL || 'grok-2-latest';
    const cacheKey = `grok:portfolio:${modelId}:${holdings.map(h=>`${h.symbol}:${h.weight}`).join('|')}:${budget}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
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
    await setCache(cacheKey, outStr, 600);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(outStr);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_portfolio_error' });
  }
});
