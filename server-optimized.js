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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_API_BASE = (process.env.XAI_API_BASE || '').trim();
const XAI_MODEL = (process.env.XAI_MODEL || '').trim();
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
        return { symbol: sym, ok: true, lastClose, dailyReturnPct, timestamp: new Date().toISOString() };
      } catch {
        return { symbol: sym, ok: false };
      }
    }).catch(() => ({ symbol: sym, ok: false }));
  });

  monitorState.items = await Promise.all(promises);
  monitorState.lastRun = new Date().toISOString();
  
  // Persist to Redis
  await setCache('monitor:watchlist', monitorState, 600); // 10 minutes
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
    // Allow per-request API key via header or body
    const providedKey = ((req.headers['x-xai-api-key'] || req.headers['x-api-key'] || '') + '').trim() || (req.body && (req.body.apiKey || '').toString().trim());
    const apiKeyToUse = providedKey || XAI_API_KEY;
    if (!apiKeyToUse) {
      return res.status(400).json({ error: 'Missing xAI API key. Provide header x-xai-api-key or body.apiKey.' });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
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

    const forward = await new Promise((resolve, reject) => {
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode || 500, body: data, headers: r.headers }));
      });
      req2.on('error', reject);
      req2.write(requestPayload);
      req2.end();
    });

    res.setHeader('Content-Type', forward.headers['content-type'] || 'application/json');
    return res.status(forward.status).send(forward.body);
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_proxy_error' });
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
    const latest = Array.isArray(series.closes) && series.closes.length ? series.closes[series.closes.length - 1] : null;
    const payload = {
      model: XAI_MODEL || 'grok-2-latest',
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
      return res.json({ symbol, analysis: parsed });
    } catch {
      return res.status(response.status).send(response.body);
    }
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'grok_analyze_error' });
  }
});
