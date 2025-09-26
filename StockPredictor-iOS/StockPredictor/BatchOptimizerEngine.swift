import Foundation

struct BatchOptimizerResult {
    let symbol: String
    let strategy: String
    let bestParams: [String: Int]
    let bestMetric: Double
}

class BatchOptimizerEngine {
    // 批次優化多股多策略（僅示範 MA/RSI/MACD，可擴充）
    static func optimize(
        symbols: [String],
        fetchHistory: @escaping (String, @escaping (Result<[Double], Error>) -> Void) -> Void,
        maFastRange: ClosedRange<Int>,
        maSlowRange: ClosedRange<Int>,
        rsiRange: ClosedRange<Int>,
        macdFastRange: ClosedRange<Int>,
        macdSlowRange: ClosedRange<Int>,
        macdSignalRange: ClosedRange<Int>,
        metric: @escaping (BacktestResult) -> Double,
        completion: @escaping ([BatchOptimizerResult]) -> Void
    ) {
        let group = DispatchGroup()
        var results: [BatchOptimizerResult] = []
        let lock = NSLock()
        for symbol in symbols {
            group.enter()
            fetchHistory(symbol) { res in
                if case .success(let closes) = res {
                    // MA
                    if let maOpt = OptimizerEngine.optimizeMA(closes: closes, fastRange: maFastRange, slowRange: maSlowRange, metric: metric) {
                        lock.lock()
                        results.append(BatchOptimizerResult(symbol: symbol, strategy: "MA", bestParams: maOpt.bestParams, bestMetric: maOpt.bestMetric))
                        lock.unlock()
                    }
                    // RSI
                    var bestRSI: Int = 0; var bestRSIMetric = -Double.infinity
                    for rsi in rsiRange {
                        if let r = BacktestEngine.rsiBacktest(closes: closes, period: rsi) {
                            let m = metric(r)
                            if m > bestRSIMetric { bestRSIMetric = m; bestRSI = rsi }
                        }
                    }
                    if bestRSI > 0 {
                        lock.lock()
                        results.append(BatchOptimizerResult(symbol: symbol, strategy: "RSI", bestParams: ["period": bestRSI], bestMetric: bestRSIMetric))
                        lock.unlock()
                    }
                    // MACD
                    var bestMACD: (Int, Int, Int) = (0,0,0); var bestMACDMetric = -Double.infinity
                    for fast in macdFastRange {
                        for slow in macdSlowRange where slow > fast {
                            for signal in macdSignalRange {
                                if let r = BacktestEngine.macdBacktest(closes: closes, fast: fast, slow: slow, signal: signal) {
                                    let m = metric(r)
                                    if m > bestMACDMetric { bestMACDMetric = m; bestMACD = (fast, slow, signal) }
                                }
                            }
                        }
                    }
                    if bestMACD.0 > 0 {
                        lock.lock()
                        results.append(BatchOptimizerResult(symbol: symbol, strategy: "MACD", bestParams: ["fast": bestMACD.0, "slow": bestMACD.1, "signal": bestMACD.2], bestMetric: bestMACDMetric))
                        lock.unlock()
                    }
                }
                group.leave()
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
