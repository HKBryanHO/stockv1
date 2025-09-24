import Foundation

struct BacktestResult: Identifiable {
    let id = UUID()
    let strategy: String
    let cagr: Double
    let sharpe: Double
    let mdd: Double
    let trades: Int
    let winRate: Double
    let equityCurve: [Double]
    let avgReturn: Double
    let volatility: Double
    let maxWin: Double
    let maxLoss: Double
    let profitFactor: Double
    let calmarRatio: Double
    let tradingDays: Int
}

class BacktestEngine {
    // 交易成本 (0.1% 雙向)
    static let transactionCost = 0.001
    // 無風險利率 (年化)
    static let riskFreeRate = 0.02
    
    // 計算移動平均
    static func calculateMA(_ data: [Double], period: Int) -> [Double] {
        var result: [Double] = []
        for i in 0..<data.count {
            if i < period - 1 {
                result.append(Double.nan)
            } else {
                let sum = data[(i-period+1)...i].reduce(0, +)
                result.append(sum / Double(period))
            }
        }
        return result
    }
    
    // 計算最大回撤
    static func calculateMaxDrawdown(_ equity: [Double]) -> Double {
        var peak = equity[0]
        var maxDD = 0.0
        
        for value in equity {
            if value > peak {
                peak = value
            } else {
                let drawdown = (peak - value) / peak
                maxDD = max(maxDD, drawdown)
            }
        }
        return maxDD
    }
    
    // 計算詳細績效指標
    static func calculatePerformanceMetrics(equity: [Double], trades: [Double], tradingDays: Int) -> (cagr: Double, sharpe: Double, mdd: Double, avgReturn: Double, volatility: Double, maxWin: Double, maxLoss: Double, profitFactor: Double, calmarRatio: Double) {
        guard equity.count > 1 else { 
            return (0, 0, 0, 0, 0, 0, 0, 0, 0) 
        }
        
        // CAGR
        let totalReturn = equity.last! / equity.first!
        let years = Double(tradingDays) / 252.0
        let cagr = pow(totalReturn, 1.0 / years) - 1.0
        
        // 日收益率
        let returns = zip(equity.dropFirst(), equity).map { $1 / $0 - 1.0 }
        let avgReturn = returns.reduce(0, +) / Double(returns.count)
        let volatility = sqrt(returns.map { pow($0 - avgReturn, 2) }.reduce(0, +) / Double(returns.count - 1))
        
        // Sharpe 比率 (年化)
        let excessReturn = avgReturn * 252.0 - riskFreeRate
        let annualizedVol = volatility * sqrt(252.0)
        let sharpe = annualizedVol > 0 ? excessReturn / annualizedVol : 0
        
        // 最大回撤
        let mdd = calculateMaxDrawdown(equity)
        
        // 交易統計
        let maxWin = trades.isEmpty ? 0 : trades.max() ?? 0
        let maxLoss = trades.isEmpty ? 0 : trades.min() ?? 0
        
        let winningTrades = trades.filter { $0 > 0 }
        let losingTrades = trades.filter { $0 < 0 }
        
        let grossProfit = winningTrades.reduce(0, +)
        let grossLoss = abs(losingTrades.reduce(0, +))
        let profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
        
        // Calmar 比率
        let calmarRatio = mdd > 0 ? cagr / mdd : 0
        
        return (cagr, sharpe, mdd, avgReturn, volatility, maxWin, maxLoss, profitFactor, calmarRatio)
    }
    
    static func maCrossBacktest(closes: [Double], fast: Int = 5, slow: Int = 20, stopLoss: Double = 0.05, takeProfit: Double = 0.10) -> BacktestResult? {
        guard closes.count > slow else { return nil }
        
        let fastMA = calculateMA(closes, period: fast)
        let slowMA = calculateMA(closes, period: slow)
        
        var position = 0
        var equity: [Double] = [1.0]
        var trades: [Double] = []
        var tradeCount = 0
        var wins = 0
        var entryPrice = 0.0
        
        for i in 1..<closes.count {
            let prevPos = position
            var currentEquity = equity.last!
            
            // 檢查止損和止盈
            if position == 1 {
                let currentReturn = (closes[i] - entryPrice) / entryPrice
                if currentReturn <= -stopLoss {
                    // 止損
                    position = 0
                    let tradeReturn = -stopLoss - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                } else if currentReturn >= takeProfit {
                    // 止盈
                    position = 0
                    let tradeReturn = takeProfit - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    wins += 1
                }
            }
            
            // MA 交叉信號
            if !fastMA[i-1].isNaN && !slowMA[i-1].isNaN && !fastMA[i].isNaN && !slowMA[i].isNaN {
                if position == 0 && fastMA[i-1] < slowMA[i-1] && fastMA[i] >= slowMA[i] {
                    // 買入信號
                    position = 1
                    tradeCount += 1
                    entryPrice = closes[i]
                    currentEquity *= (1 - transactionCost) // 交易成本
                } else if position == 1 && fastMA[i-1] > slowMA[i-1] && fastMA[i] <= slowMA[i] {
                    // 賣出信號
                    position = 0
                    let tradeReturn = (closes[i] - entryPrice) / entryPrice - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    if tradeReturn > 0 { wins += 1 }
                }
            }
            
            // 如果持有部位，更新權益
            if position == 1 && prevPos == 1 {
                let ret = closes[i] / closes[i-1] - 1
                currentEquity *= (1 + ret)
            }
            
            equity.append(currentEquity)
        }
        
        let metrics = calculatePerformanceMetrics(equity: equity, trades: trades, tradingDays: closes.count)
        let winRate = tradeCount > 0 ? Double(wins) / Double(tradeCount) : 0
        
        return BacktestResult(
            strategy: "MA交叉(\(fast)/\(slow))",
            cagr: metrics.cagr,
            sharpe: metrics.sharpe,
            mdd: metrics.mdd,
            trades: tradeCount,
            winRate: winRate,
            equityCurve: equity,
            avgReturn: metrics.avgReturn,
            volatility: metrics.volatility,
            maxWin: metrics.maxWin,
            maxLoss: metrics.maxLoss,
            profitFactor: metrics.profitFactor,
            calmarRatio: metrics.calmarRatio,
            tradingDays: closes.count
        )
    }
    // 計算 RSI (使用 Wilder's smoothing)
    static func calculateRSI(_ closes: [Double], period: Int = 14) -> [Double] {
        var rsi: [Double] = []
        var avgGain = 0.0
        var avgLoss = 0.0
        
        for i in 0..<closes.count {
            if i == 0 {
                rsi.append(Double.nan)
                continue
            }
            
            let change = closes[i] - closes[i-1]
            let gain = change > 0 ? change : 0
            let loss = change < 0 ? abs(change) : 0
            
            if i < period {
                rsi.append(Double.nan)
                continue
            } else if i == period {
                // 初始平均值
                let initialGains = (1...period).map { idx -> Double in
                    let change = closes[idx] - closes[idx-1]
                    return change > 0 ? change : 0
                }
                let initialLosses = (1...period).map { idx -> Double in
                    let change = closes[idx] - closes[idx-1]
                    return change < 0 ? abs(change) : 0
                }
                avgGain = initialGains.reduce(0, +) / Double(period)
                avgLoss = initialLosses.reduce(0, +) / Double(period)
            } else {
                // Wilder's smoothing
                avgGain = (avgGain * Double(period - 1) + gain) / Double(period)
                avgLoss = (avgLoss * Double(period - 1) + loss) / Double(period)
            }
            
            if avgLoss == 0 {
                rsi.append(100)
            } else {
                let rs = avgGain / avgLoss
                rsi.append(100 - 100 / (1 + rs))
            }
        }
        
        return rsi
    }
    
    // RSI 策略：RSI < 30 買入，RSI > 70 賣出
    static func rsiBacktest(closes: [Double], period: Int = 14, oversold: Double = 30, overbought: Double = 70, stopLoss: Double = 0.08, takeProfit: Double = 0.15) -> BacktestResult? {
        guard closes.count > period + 10 else { return nil }
        
        let rsiValues = calculateRSI(closes, period: period)
        
        var position = 0
        var equity: [Double] = [1.0]
        var trades: [Double] = []
        var tradeCount = 0
        var wins = 0
        var entryPrice = 0.0
        
        for i in 1..<closes.count {
            let prevPos = position
            var currentEquity = equity.last!
            
            // 檢查止損和止盈
            if position == 1 && entryPrice > 0 {
                let currentReturn = (closes[i] - entryPrice) / entryPrice
                if currentReturn <= -stopLoss {
                    // 止損
                    position = 0
                    let tradeReturn = -stopLoss - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                } else if currentReturn >= takeProfit {
                    // 止盈
                    position = 0
                    let tradeReturn = takeProfit - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    wins += 1
                }
            }
            
            // RSI 信號
            if !rsiValues[i-1].isNaN && !rsiValues[i].isNaN {
                if position == 0 && rsiValues[i-1] < oversold && rsiValues[i] >= oversold {
                    // 超賣反彈買入
                    position = 1
                    tradeCount += 1
                    entryPrice = closes[i]
                    currentEquity *= (1 - transactionCost)
                } else if position == 1 && rsiValues[i-1] > overbought && rsiValues[i] <= overbought {
                    // 超買賣出
                    position = 0
                    let tradeReturn = (closes[i] - entryPrice) / entryPrice - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    if tradeReturn > 0 { wins += 1 }
                }
            }
            
            // 如果持有部位，更新權益
            if position == 1 && prevPos == 1 {
                let ret = closes[i] / closes[i-1] - 1
                currentEquity *= (1 + ret)
            }
            
            equity.append(currentEquity)
        }
        
        let metrics = calculatePerformanceMetrics(equity: equity, trades: trades, tradingDays: closes.count)
        let winRate = tradeCount > 0 ? Double(wins) / Double(tradeCount) : 0
        
        return BacktestResult(
            strategy: "RSI策略(\(period))",
            cagr: metrics.cagr,
            sharpe: metrics.sharpe,
            mdd: metrics.mdd,
            trades: tradeCount,
            winRate: winRate,
            equityCurve: equity,
            avgReturn: metrics.avgReturn,
            volatility: metrics.volatility,
            maxWin: metrics.maxWin,
            maxLoss: metrics.maxLoss,
            profitFactor: metrics.profitFactor,
            calmarRatio: metrics.calmarRatio,
            tradingDays: closes.count
        )
    }

    // 計算 EMA
    static func calculateEMA(_ data: [Double], period: Int) -> [Double] {
        var ema: [Double] = []
        let alpha = 2.0 / Double(period + 1)
        
        for i in 0..<data.count {
            if i == 0 {
                ema.append(data[0])
            } else {
                let value = alpha * data[i] + (1 - alpha) * ema[i-1]
                ema.append(value)
            }
        }
        return ema
    }
    
    // MACD 策略：MACD 上穿 signal 買入，下穿賣出
    static func macdBacktest(closes: [Double], fast: Int = 12, slow: Int = 26, signal: Int = 9, stopLoss: Double = 0.06, takeProfit: Double = 0.12) -> BacktestResult? {
        guard closes.count > slow + signal + 10 else { return nil }
        
        let fastEMA = calculateEMA(closes, period: fast)
        let slowEMA = calculateEMA(closes, period: slow)
        let macdLine = zip(fastEMA, slowEMA).map { $0 - $1 }
        let signalLine = calculateEMA(macdLine, period: signal)
        let histogram = zip(macdLine, signalLine).map { $0 - $1 }
        
        var position = 0
        var equity: [Double] = [1.0]
        var trades: [Double] = []
        var tradeCount = 0
        var wins = 0
        var entryPrice = 0.0
        
        for i in 1..<closes.count {
            let prevPos = position
            var currentEquity = equity.last!
            
            // 檢查止損和止盈
            if position == 1 && entryPrice > 0 {
                let currentReturn = (closes[i] - entryPrice) / entryPrice
                if currentReturn <= -stopLoss {
                    // 止損
                    position = 0
                    let tradeReturn = -stopLoss - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                } else if currentReturn >= takeProfit {
                    // 止盈
                    position = 0
                    let tradeReturn = takeProfit - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    wins += 1
                }
            }
            
            // MACD 信號 (使用 histogram 零軸交叉作為確認)
            if i > slow + signal {
                if position == 0 && macdLine[i-1] < signalLine[i-1] && macdLine[i] >= signalLine[i] && histogram[i] > 0 {
                    // MACD 上穿 signal 且 histogram > 0 (金叉確認)
                    position = 1
                    tradeCount += 1
                    entryPrice = closes[i]
                    currentEquity *= (1 - transactionCost)
                } else if position == 1 && macdLine[i-1] > signalLine[i-1] && macdLine[i] <= signalLine[i] {
                    // MACD 下穿 signal (死叉)
                    position = 0
                    let tradeReturn = (closes[i] - entryPrice) / entryPrice - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    if tradeReturn > 0 { wins += 1 }
                }
            }
            
            // 如果持有部位，更新權益
            if position == 1 && prevPos == 1 {
                let ret = closes[i] / closes[i-1] - 1
                currentEquity *= (1 + ret)
            }
            
            equity.append(currentEquity)
        }
        
        let metrics = calculatePerformanceMetrics(equity: equity, trades: trades, tradingDays: closes.count)
        let winRate = tradeCount > 0 ? Double(wins) / Double(tradeCount) : 0
        
        return BacktestResult(
            strategy: "MACD策略(\(fast),\(slow),\(signal))",
            cagr: metrics.cagr,
            sharpe: metrics.sharpe,
            mdd: metrics.mdd,
            trades: tradeCount,
            winRate: winRate,
            equityCurve: equity,
            avgReturn: metrics.avgReturn,
            volatility: metrics.volatility,
            maxWin: metrics.maxWin,
            maxLoss: metrics.maxLoss,
            profitFactor: metrics.profitFactor,
            calmarRatio: metrics.calmarRatio,
            tradingDays: closes.count
        )
    }
    
    // 布林帶策略 (新增)
    static func bollingerBandsBacktest(closes: [Double], period: Int = 20, stdDev: Double = 2.0, stopLoss: Double = 0.05, takeProfit: Double = 0.10) -> BacktestResult? {
        guard closes.count > period + 10 else { return nil }
        
        let ma = calculateMA(closes, period: period)
        var upperBand: [Double] = []
        var lowerBand: [Double] = []
        
        for i in 0..<closes.count {
            if i < period - 1 {
                upperBand.append(Double.nan)
                lowerBand.append(Double.nan)
            } else {
                let slice = Array(closes[(i-period+1)...i])
                let mean = ma[i]
                let variance = slice.map { pow($0 - mean, 2) }.reduce(0, +) / Double(period)
                let std = sqrt(variance)
                upperBand.append(mean + stdDev * std)
                lowerBand.append(mean - stdDev * std)
            }
        }
        
        var position = 0
        var equity: [Double] = [1.0]
        var trades: [Double] = []
        var tradeCount = 0
        var wins = 0
        var entryPrice = 0.0
        
        for i in 1..<closes.count {
            let prevPos = position
            var currentEquity = equity.last!
            
            // 檢查止損和止盈
            if position == 1 && entryPrice > 0 {
                let currentReturn = (closes[i] - entryPrice) / entryPrice
                if currentReturn <= -stopLoss {
                    position = 0
                    let tradeReturn = -stopLoss - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                } else if currentReturn >= takeProfit {
                    position = 0
                    let tradeReturn = takeProfit - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    wins += 1
                }
            }
            
            // 布林帶信號
            if !lowerBand[i].isNaN && !upperBand[i].isNaN && !ma[i].isNaN {
                if position == 0 && closes[i-1] <= lowerBand[i-1] && closes[i] > lowerBand[i] {
                    // 價格突破下軌後回歸 (超賣反彈)
                    position = 1
                    tradeCount += 1
                    entryPrice = closes[i]
                    currentEquity *= (1 - transactionCost)
                } else if position == 1 && (closes[i] >= upperBand[i] || closes[i] <= ma[i]) {
                    // 價格觸及上軌或回落到中軌
                    position = 0
                    let tradeReturn = (closes[i] - entryPrice) / entryPrice - transactionCost
                    currentEquity *= (1 + tradeReturn)
                    trades.append(tradeReturn)
                    if tradeReturn > 0 { wins += 1 }
                }
            }
            
            // 如果持有部位，更新權益
            if position == 1 && prevPos == 1 {
                let ret = closes[i] / closes[i-1] - 1
                currentEquity *= (1 + ret)
            }
            
            equity.append(currentEquity)
        }
        
        let metrics = calculatePerformanceMetrics(equity: equity, trades: trades, tradingDays: closes.count)
        let winRate = tradeCount > 0 ? Double(wins) / Double(tradeCount) : 0
        
        return BacktestResult(
            strategy: "布林帶策略(\(period),\(stdDev))",
            cagr: metrics.cagr,
            sharpe: metrics.sharpe,
            mdd: metrics.mdd,
            trades: tradeCount,
            winRate: winRate,
            equityCurve: equity,
            avgReturn: metrics.avgReturn,
            volatility: metrics.volatility,
            maxWin: metrics.maxWin,
            maxLoss: metrics.maxLoss,
            profitFactor: metrics.profitFactor,
            calmarRatio: metrics.calmarRatio,
            tradingDays: closes.count
        )
    }

    // 多策略回測 (增強版)
    static func multiStrategyBacktest(
        closes: [Double],
        maPeriod: Int = 20,
        rsiPeriod: Int = 14,
        maFast: Int = 5,
        macdFast: Int = 12,
        macdSlow: Int = 26,
        macdSignal: Int = 9,
        includeBollinger: Bool = true
    ) -> [BacktestResult] {
        var results: [BacktestResult] = []
        
        // MA 交叉策略
        if let ma = maCrossBacktest(closes: closes, fast: maFast, slow: maPeriod) {
            results.append(ma)
        }
        
        // RSI 策略
        if let rsi = rsiBacktest(closes: closes, period: rsiPeriod) {
            results.append(rsi)
        }
        
        // MACD 策略
        if let macd = macdBacktest(closes: closes, fast: macdFast, slow: macdSlow, signal: macdSignal) {
            results.append(macd)
        }
        
        // 布林帶策略
        if includeBollinger, let bb = bollingerBandsBacktest(closes: closes) {
            results.append(bb)
        }
        
        return results
    }
}
