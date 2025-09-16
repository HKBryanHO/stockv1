// Mock Data Generator for Frontend-Only Version
class MockDataGenerator {
    constructor() {
        this.symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX'];
        this.marketConditions = ['bull', 'bear', 'sideways'];
    }

    // Generate realistic stock price data
    generateStockData(symbol) {
        const days = 252; // One year of trading days
        const basePrice = this.getBasePrice(symbol);
        const volatility = this.getVolatility(symbol);
        
        const prices = [];
        const volumes = [];
        const dates = [];
        
        let currentPrice = basePrice;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        for (let i = 0; i < days; i++) {
            // Generate realistic price movement
            const dailyReturn = this.generateDailyReturn(volatility);
            currentPrice = currentPrice * (1 + dailyReturn);
            
            // Ensure price doesn't go negative
            currentPrice = Math.max(currentPrice, basePrice * 0.1);
            
            prices.push(parseFloat(currentPrice.toFixed(2)));
            volumes.push(this.generateVolume());
            
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        return {
            symbol: symbol,
            closes: prices,
            volumes: volumes,
            dates: dates,
            latestPrice: prices[prices.length - 1],
            change: prices[prices.length - 1] - prices[prices.length - 2],
            changePercent: ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2] * 100)
        };
    }

    // Generate fundamental data
    generateFundamentals(symbol) {
        const baseMetrics = {
            'AAPL': { pe: 28.5, eps: 6.05, marketCap: 3000000000000 },
            'GOOGL': { pe: 25.2, eps: 4.56, marketCap: 1800000000000 },
            'MSFT': { pe: 32.1, eps: 9.12, marketCap: 2800000000000 },
            'TSLA': { pe: 45.8, eps: 3.62, marketCap: 800000000000 },
            'AMZN': { pe: 52.3, eps: 0.76, marketCap: 1500000000000 },
            'META': { pe: 22.7, eps: 12.25, marketCap: 900000000000 },
            'NVDA': { pe: 65.4, eps: 4.44, marketCap: 1200000000000 },
            'NFLX': { pe: 35.2, eps: 10.13, marketCap: 200000000000 }
        };
        
        const metrics = baseMetrics[symbol] || baseMetrics['AAPL'];
        
        return {
            pe: metrics.pe + (Math.random() - 0.5) * 5,
            eps: metrics.eps + (Math.random() - 0.5) * 0.5,
            peg: (metrics.pe + (Math.random() - 0.5) * 5) / (0.1 + Math.random() * 0.2),
            marketCap: metrics.marketCap + (Math.random() - 0.5) * metrics.marketCap * 0.1,
            debtToEquity: 0.3 + Math.random() * 0.4,
            debtEquity: 0.3 + Math.random() * 0.4,
            roe: 0.15 + Math.random() * 0.2,
            revenueGrowth: -0.05 + Math.random() * 0.3,
            fcf: metrics.marketCap * 0.05 * (0.8 + Math.random() * 0.4), // Free Cash Flow
            fcfYield: 0.02 + Math.random() * 0.08 // FCF Yield
        };
    }

    // Generate prediction results
    generatePredictionResult(stockData, formData) {
        const latestPrice = stockData.latestPrice;
        const volatility = this.calculateVolatility(stockData.closes);
        
        // Generate multiple prediction paths
        const paths = this.generatePredictionPaths(latestPrice, volatility, formData.days, formData.paths);
        
        // Calculate quantiles
        const quantiles = this.calculateQuantiles(paths);
        
        // Generate risk metrics
        const riskMetrics = this.generateRiskMetrics(stockData.closes, quantiles);
        
        // Generate technical indicators
        const technical = this.generateTechnicalIndicators(stockData.closes);
        
        // Generate sentiment analysis
        const sentiment = this.generateSentiment(stockData, technical);
        
        return {
            stockData: stockData,
            predictions: {
                combined: quantiles[50], // Median
                upProbability: this.calculateUpProbability(quantiles, latestPrice),
                quantiles: quantiles,
                paths: paths.slice(0, 100), // Limit for performance
                lstm: quantiles[50] * (0.95 + Math.random() * 0.1), // LSTM prediction
                arima: quantiles[50] * (0.98 + Math.random() * 0.04), // ARIMA prediction
                gbm: quantiles[50] // GBM prediction
            },
            simulations: {
                paths: paths.slice(0, 100), // Limit for performance
                quantiles: {
                    q5: this.generateQuantilePath(quantiles[5], formData.days),
                    q25: this.generateQuantilePath(quantiles[25], formData.days),
                    q50: this.generateQuantilePath(quantiles[50], formData.days),
                    q75: this.generateQuantilePath(quantiles[75], formData.days),
                    q95: this.generateQuantilePath(quantiles[95], formData.days)
                }
            },
            riskMetrics: riskMetrics,
            technical: technical,
            sentiment: sentiment,
            model: formData.model || 'GBM',
            parameters: this.generateModelParameters(formData.model, volatility)
        };
    }

    // Helper methods
    getBasePrice(symbol) {
        const basePrices = {
            'AAPL': 175, 'GOOGL': 140, 'MSFT': 350, 'TSLA': 250,
            'AMZN': 150, 'META': 300, 'NVDA': 450, 'NFLX': 400
        };
        return basePrices[symbol] || 100;
    }

    getVolatility(symbol) {
        const volatilities = {
            'AAPL': 0.25, 'GOOGL': 0.30, 'MSFT': 0.28, 'TSLA': 0.45,
            'AMZN': 0.35, 'META': 0.40, 'NVDA': 0.50, 'NFLX': 0.35
        };
        return volatilities[symbol] || 0.30;
    }

    generateDailyReturn(volatility) {
        // Generate realistic daily return using normal distribution
        const mean = 0.0005; // Slight positive drift
        const stdDev = volatility / Math.sqrt(252); // Annual volatility to daily
        
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        
        return mean + stdDev * z0;
    }

    generateVolume() {
        return Math.floor(1000000 + Math.random() * 10000000);
    }

    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push(Math.log(prices[i] / prices[i-1]));
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance * 252); // Annualized volatility
    }

    generatePredictionPaths(currentPrice, volatility, days, numPaths) {
        const paths = [];
        const dt = 1/252; // Daily time step
        
        for (let i = 0; i < numPaths; i++) {
            const path = [currentPrice];
            let price = currentPrice;
            
            for (let day = 1; day <= days; day++) {
                const drift = 0.0005 * dt;
                const shock = volatility * Math.sqrt(dt) * (Math.random() - 0.5) * 2;
                price = price * Math.exp(drift + shock);
                path.push(Math.max(price, currentPrice * 0.1)); // Prevent negative prices
            }
            
            paths.push(path);
        }
        
        return paths;
    }

    calculateQuantiles(paths) {
        const finalPrices = paths.map(path => path[path.length - 1]);
        finalPrices.sort((a, b) => a - b);
        
        const quantiles = {};
        const percentiles = [5, 10, 25, 50, 75, 90, 95];
        
        percentiles.forEach(p => {
            const index = Math.floor((p / 100) * (finalPrices.length - 1));
            quantiles[p] = finalPrices[index];
        });
        
        return quantiles;
    }

    calculateUpProbability(quantiles, currentPrice) {
        const median = quantiles[50];
        return median > currentPrice ? 65 + Math.random() * 20 : 35 + Math.random() * 20;
    }

    generateQuantilePath(finalValue, days) {
        // Generate a smooth path from 0 to finalValue
        const path = [];
        const startValue = finalValue * (0.8 + Math.random() * 0.4); // Start between 80-120% of final value
        
        for (let i = 0; i <= days; i++) {
            const progress = i / days;
            // Use a smooth interpolation with some randomness
            const smoothProgress = progress * progress * (3 - 2 * progress); // Smooth step function
            const randomFactor = 1 + (Math.random() - 0.5) * 0.1; // ±5% randomness
            const value = startValue + (finalValue - startValue) * smoothProgress * randomFactor;
            path.push(Math.max(value, finalValue * 0.1)); // Prevent negative values
        }
        
        return path;
    }

    generateRiskMetrics(closes, quantiles) {
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
            returns.push((closes[i] - closes[i-1]) / closes[i-1]);
        }
        
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length);
        
        return {
            var95: quantiles[5],
            var99: quantiles[1] || quantiles[5] * 0.8,
            expectedShortfall: quantiles[5] * 0.9,
            maxDrawdown: this.calculateMaxDrawdown(closes),
            sharpeRatio: meanReturn / volatility * Math.sqrt(252),
            suggestedAllocation: Math.min(0.2, Math.max(0.05, (meanReturn / volatility) * 0.1))
        };
    }

    calculateMaxDrawdown(prices) {
        let maxDrawdown = 0;
        let peak = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) {
                peak = prices[i];
            }
            const drawdown = (peak - prices[i]) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        
        return maxDrawdown;
    }

    generateTechnicalIndicators(closes) {
        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const rsi = this.calculateRSI(closes);
        const macd = this.calculateMACD(closes);
        
        return {
            sma20: sma20[sma20.length - 1],
            sma50: sma50[sma50.length - 1],
            rsi: rsi[rsi.length - 1],
            macd: macd.macd[macd.macd.length - 1],
            macdSignal: macd.signal[macd.signal.length - 1],
            trend: sma20[sma20.length - 1] > sma50[sma50.length - 1] ? 'bullish' : 'bearish'
        };
    }

    calculateSMA(prices, period) {
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    calculateRSI(prices, period = 14) {
        const rsi = [];
        for (let i = period; i < prices.length; i++) {
            const gains = [];
            const losses = [];
            
            for (let j = i - period + 1; j <= i; j++) {
                const change = prices[j] - prices[j-1];
                gains.push(change > 0 ? change : 0);
                losses.push(change < 0 ? -change : 0);
            }
            
            const avgGain = gains.reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
            
            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        return rsi;
    }

    calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const emaFast = this.calculateEMA(prices, fastPeriod);
        const emaSlow = this.calculateEMA(prices, slowPeriod);
        
        const macd = [];
        for (let i = 0; i < emaFast.length; i++) {
            macd.push(emaFast[i] - emaSlow[i]);
        }
        
        const signal = this.calculateEMA(macd, signalPeriod);
        
        return { macd, signal };
    }

    calculateEMA(prices, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        ema[0] = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema[i] = (prices[i] * multiplier) + (ema[i-1] * (1 - multiplier));
        }
        
        return ema;
    }

    generateSentiment(stockData, technical) {
        const factors = {
            technical: technical.rsi > 70 ? -0.2 : technical.rsi < 30 ? 0.2 : 0,
            trend: technical.trend === 'bullish' ? 0.1 : -0.1,
            volatility: stockData.closes.length > 0 ? 
                (this.calculateVolatility(stockData.closes) > 0.3 ? -0.1 : 0.1) : 0,
            momentum: technical.macd > technical.macdSignal ? 0.1 : -0.1
        };
        
        const score = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
        
        return {
            score: Math.max(-1, Math.min(1, score)),
            factors: factors,
            recommendation: score > 0.2 ? 'BUY' : score < -0.2 ? 'SELL' : 'HOLD'
        };
    }

    generateModelParameters(model, volatility) {
        const baseParams = {
            volatility: volatility,
            drift: 0.05,
            timeHorizon: 1
        };
        
        switch (model) {
            case 'JUMP':
                return {
                    ...baseParams,
                    jumpIntensity: 0.1,
                    jumpMean: 0.0,
                    jumpVolatility: 0.15
                };
            case 'HESTON':
                return {
                    ...baseParams,
                    meanReversion: 2.0,
                    longTermVol: volatility,
                    volVolatility: 0.3,
                    correlation: -0.7
                };
            case 'GARCH':
                return {
                    ...baseParams,
                    alpha: 0.1,
                    beta: 0.85,
                    omega: 0.0001
                };
            default:
                return baseParams;
        }
    }
}

// Export for use in other files
window.MockDataGenerator = MockDataGenerator;
