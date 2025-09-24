import Foundation

struct BatchBacktestResult: Identifiable {
    let id = UUID()
    let symbol: String
    let strategy: String
    let cagr: Double
    let sharpe: Double
    let mdd: Double
    let winRate: Double
    let trades: Int
    let profitFactor: Double
    let calmarRatio: Double
    let maxWin: Double
    let maxLoss: Double
}


import SwiftUI

class BatchBacktestEngine {
    static func run(
        symbols: [String],
        maFast: Int,
        maSlow: Int,
        rsiPeriod: Int,
        macdFast: Int,
        macdSlow: Int,
        macdSignal: Int,
        customStrategies: [CustomStrategy] = [],
        completion: @escaping ([BatchBacktestResult]) -> Void
    ) {
        let group = DispatchGroup()
        var results: [BatchBacktestResult] = []
        let lock = NSLock()
        for symbol in symbols {
            group.enter()
            TechnicalAPI.shared.fetchHistory(symbol: symbol) { result in
                if case .success(let closes) = result {
                    let strategyResults = BacktestEngine.multiStrategyBacktest(
                        closes: closes,
                        maPeriod: maSlow,
                        rsiPeriod: rsiPeriod,
                        maFast: maFast,
                        macdFast: macdFast,
                        macdSlow: macdSlow,
                        macdSignal: macdSignal
                    )
                    lock.lock()
                    for r in strategyResults {
                        results.append(BatchBacktestResult(
                            symbol: symbol,
                            strategy: r.strategy,
                            cagr: r.cagr,
                            sharpe: r.sharpe,
                            mdd: r.mdd,
                            winRate: r.winRate,
                            trades: r.trades,
                            profitFactor: r.profitFactor,
                            calmarRatio: r.calmarRatio,
                            maxWin: r.maxWin,
                            maxLoss: r.maxLoss
                        ))
                    }
                    lock.unlock()
                }
                // Custom strategy support: fetch candles and evaluate user formula
                if !customStrategies.isEmpty {
                    TechnicalAPI.shared.fetchCandles(symbol: symbol) { candleResult in
                        if case .success(let candles) = candleResult {
                            let closes = candles.map { $0.close }
                            let opens = candles.map { $0.open }
                            let highs = candles.map { $0.high }
                            let lows = candles.map { $0.low }
                            let volumes = candles.map { $0.volume ?? 0 }
                            for cs in customStrategies {
                                let signals = CustomStrategyEngine.evaluate(formula: cs.formula, closes: closes, opens: opens, highs: highs, lows: lows, volumes: volumes)
                                
                                // 改進的績效計算：使用與 BacktestEngine 相同的方法
                                var position = 0
                                var equity: [Double] = [1.0]
                                var tradeReturns: [Double] = []
                                var tradeCount = 0
                                var wins = 0
                                var entryPrice = 0.0
                                let transactionCost = 0.001
                                
                                for i in 1..<closes.count {
                                    let prevPos = position
                                    var currentEquity = equity.last!
                                    
                                    // 信號處理
                                    if position == 0 && signals[i-1] == false && signals[i] == true {
                                        // 買入信號
                                        position = 1
                                        tradeCount += 1
                                        entryPrice = closes[i]
                                        currentEquity *= (1 - transactionCost)
                                    } else if position == 1 && signals[i-1] == true && signals[i] == false {
                                        // 賣出信號
                                        position = 0
                                        let tradeReturn = (closes[i] - entryPrice) / entryPrice - transactionCost
                                        currentEquity *= (1 + tradeReturn)
                                        tradeReturns.append(tradeReturn)
                                        if tradeReturn > 0 { wins += 1 }
                                    }
                                    
                                    // 更新權益曲線
                                    if position == 1 && prevPos == 1 {
                                        let ret = closes[i] / closes[i-1] - 1
                                        currentEquity *= (1 + ret)
                                    }
                                    
                                    equity.append(currentEquity)
                                }
                                
                                // 計算詳細指標
                                let metrics = BacktestEngine.calculatePerformanceMetrics(
                                    equity: equity, 
                                    trades: tradeReturns, 
                                    tradingDays: closes.count
                                )
                                
                                let winRate = tradeCount > 0 ? Double(wins) / Double(tradeCount) : 0
                                
                                lock.lock()
                                results.append(BatchBacktestResult(
                                    symbol: symbol,
                                    strategy: cs.name,
                                    cagr: metrics.cagr,
                                    sharpe: metrics.sharpe,
                                    mdd: metrics.mdd,
                                    winRate: winRate,
                                    trades: tradeCount,
                                    profitFactor: metrics.profitFactor,
                                    calmarRatio: metrics.calmarRatio,
                                    maxWin: metrics.maxWin,
                                    maxLoss: metrics.maxLoss
                                ))
                                lock.unlock()
                            }
                        }
                        group.leave()
                    }
                } else {
                    group.leave()
                }
            }
        }
        DispatchQueue.global().async {
            group.wait()
            DispatchQueue.main.async {
                completion(results)
            }
        }
    }
}
