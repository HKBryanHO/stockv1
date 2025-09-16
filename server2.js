import express from 'express';
import cors from 'cors';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';

// Simple in-memory cache and coalescing
const cache = new Map(); // key -> { ts, status, body }
const pending = new Map(); // key -> Promise

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

function fetchJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      port: u.port || 443,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        ...extraHeaders,
      },
    };
    const req2 = https.request(options, (r) => {
      let data = '';
      r.on('data', (chunk) => (data += chunk));
      r.on('end', () => resolve({ status: r.statusCode || 200, body: data }));
    });
    req2.on('error', (e) => reject(e));
    req2.end();
  });
}

async function tryFetchWithFallback(url) {
  const attempt = async () => {
    const res = await fetchJson(url);
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetchJson(url);
    }
    return res;
  };
  try {
    return await attempt();
  } catch (e) {
    try {
      const wrapped = `https://cors.isomorphic-git.org/${url}`;
      const r2 = await fetchJson(wrapped);
      return r2;
    } catch (e2) {
      return { status: 599, body: JSON.stringify({ error: 'network_error', detail: e2 && e2.message }) };
    }
  }
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

    const series = {};

    const tsPromises = symbols.map(async (sym) => {
      // Alpha Vantage daily series (cached by proxy logic)
      const p = new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact', apikey: ALPHA_KEY });
      const url = `https://www.alphavantage.co/query?${p.toString()}`;
      const { body } = await fetchAlphaJson(url);
      const j = JSON.parse(body);
      const ts = j && j['Time Series (Daily)'];
      if (!ts) return { sym, ok: false };
      const dates = Object.keys(ts).sort();
      const closes = dates.map((d) => parseFloat(ts[d]['4. close']));
      const volumes = dates.map((d) => parseFloat(ts[d]['5. volume'] || '0'));
      return { sym, ok: true, dates, closes, volumes };
    });

    const yqPromises = symbols.map(async (sym) => {
      const yurl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      try {
        const { body } = await fetchJson(yurl);
        const j = JSON.parse(body);
        const r = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
        const price = r ? (r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice) : undefined;
        return { sym, price: Number(price) };
      } catch {
        return { sym, price: NaN };
      }
    });

    const [tsResults, yqResults] = await Promise.all([
      Promise.all(tsPromises),
      Promise.all(yqPromises)
    ]);

    const priceMap = new Map(yqResults.map((x) => [x.sym, x.price]));

    tsResults.forEach((r) => {
      if (!r.ok) return;
      const lp = priceMap.get(r.sym);
      if (isFinite(lp)) {
        r.closes[r.closes.length - 1] = Number(lp);
      }
      series[r.sym] = { dates: r.dates, closes: r.closes, volumes: r.volumes };
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
    const yurl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const { status, body } = await tryFetchWithFallback(yurl);
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).send(body);
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
    const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includeAdjustedClose=true`;
    const { status, body } = await tryFetchWithFallback(yurl);
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).send(body);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'yahoo_chart_error' });
  }
});

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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

// Serve static files from public directory
app.use(express.static('public'));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});


