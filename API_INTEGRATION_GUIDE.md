# API Integration Guide

## Overview

This guide explains how to set up and use the new enhanced data sources for the Stock Predictor application. We've integrated three additional APIs to provide more reliable and comprehensive stock data:

1. **Finnhub** - Primary real-time data source
2. **Financial Modeling Prep (FMP)** - Historical and fundamental data
3. **Polygon.io** - Real-time backup data source

## API Registration

### 1. Finnhub (Recommended - Primary Source)
- **Website**: https://finnhub.io/register
- **Free Tier**: 60 calls/minute, no daily limit
- **Features**: Real-time stock prices, company fundamentals, forex/crypto
- **Latency**: <1 second
- **Best for**: High-frequency real-time queries

### 2. Financial Modeling Prep (FMP)
- **Website**: https://site.financialmodelingprep.com/register
- **Free Tier**: Unlimited calls (rate limited)
- **Features**: Historical/real-time stock data, financial statements
- **Latency**: 15 minutes (free tier), real-time (paid)
- **Best for**: Historical data and financial analysis

### 3. Polygon.io
- **Website**: https://polygon.io/register
- **Free Tier**: 5 calls/minute
- **Features**: Real-time stock/forex/options data, WebSocket support
- **Latency**: Low latency, cloud-based
- **Best for**: Real-time data with WebSocket streaming

## Configuration

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Finnhub API Configuration (Primary real-time data source)
FINNHUB_API_KEY=your_finnhub_api_key_here

# Financial Modeling Prep API Configuration (Historical data)
FMP_API_KEY=your_fmp_api_key_here

# Polygon.io API Configuration (Real-time backup)
POLYGON_API_KEY=your_polygon_api_key_here
```

### 2. Server Restart

After adding the API keys, restart your server:

```bash
npm start
# or
node server.js
```

## API Endpoints

### New Endpoints

1. **Finnhub Quote**
   ```
   GET /api/finnhub/quote?symbol=AAPL
   ```

2. **FMP Quote**
   ```
   GET /api/fmp/quote?symbol=AAPL
   ```

3. **Polygon Quote**
   ```
   GET /api/polygon/quote?symbol=AAPL
   ```

4. **Enhanced Fallback Quote**
   ```
   GET /api/quote/enhanced?symbol=AAPL
   ```

### Enhanced Market Insights

The existing `/api/market/insights` endpoint now uses the enhanced fallback system, which tries APIs in this order:

1. Finnhub (if configured)
2. FMP (if configured)
3. Polygon.io (if configured)
4. Alpha Vantage (fallback)

## Testing

### Run the Test Script

```bash
node test-new-apis.js
```

This will test all the new API endpoints and show you which ones are working.

### Manual Testing

Test individual endpoints:

```bash
# Test Finnhub
curl "http://localhost:3001/api/finnhub/quote?symbol=AAPL"

# Test FMP
curl "http://localhost:3001/api/fmp/quote?symbol=AAPL"

# Test Polygon
curl "http://localhost:3001/api/polygon/quote?symbol=AAPL"

# Test Enhanced Fallback
curl "http://localhost:3001/api/quote/enhanced?symbol=AAPL"
```

## Fallback Strategy

The system implements a smart fallback strategy:

1. **Primary**: Finnhub (most reliable for real-time)
2. **Secondary**: FMP (good for historical data)
3. **Tertiary**: Polygon.io (real-time backup)
4. **Fallback**: Alpha Vantage (existing system)

If any API fails or returns invalid data, the system automatically tries the next one in the chain.

## Benefits

### Reliability
- Multiple data sources reduce single points of failure
- Automatic fallback ensures data availability
- Better error handling and logging

### Performance
- Finnhub provides <1 second latency
- FMP offers unlimited free calls
- Polygon.io supports WebSocket streaming

### Coverage
- Real-time data from multiple sources
- Historical data for analysis
- Financial statements and fundamentals

## Troubleshooting

### Common Issues

1. **API Key Not Configured**
   - Error: `503 - API key not configured`
   - Solution: Add the API key to your `.env` file

2. **Rate Limiting**
   - Error: `429 - Too Many Requests`
   - Solution: Wait or upgrade to paid tier

3. **Invalid Symbol**
   - Error: `404 - Quote not found`
   - Solution: Check symbol format (e.g., AAPL, not APPL)

### Debugging

Check server logs for detailed error messages:

```bash
# Look for these log messages:
✓ Finnhub quote for AAPL: $150.25
✓ FMP quote for AAPL: $150.30
✗ All quote sources failed for INVALID
```

## Cost Optimization

### Free Tier Limits

- **Finnhub**: 60 calls/minute (sufficient for most use cases)
- **FMP**: Unlimited calls (rate limited)
- **Polygon**: 5 calls/minute (good for testing)

### Recommended Setup

For production use:
1. **Primary**: Finnhub (free tier is sufficient)
2. **Backup**: FMP (free tier for historical data)
3. **Optional**: Polygon.io (if you need WebSocket streaming)

## Next Steps

1. Register for API keys
2. Add keys to `.env` file
3. Restart server
4. Run test script
5. Monitor logs for successful API calls
6. Enjoy more reliable stock data!

## Support

If you encounter issues:
1. Check the server logs
2. Run the test script
3. Verify API keys are correct
4. Check API provider status pages
5. Review rate limiting policies
