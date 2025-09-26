import Foundation

struct OptimizerResult {
    let bestParams: [String: Int]
    let bestMetric: Double
    let allResults: [[String: Int]: Double]
}

class OptimizerEngine {
    // 針對單一股票與策略進行網格搜尋優化
    static func optimizeMA(closes: [Double], fastRange: ClosedRange<Int>, slowRange: ClosedRange<Int>, metric: (BacktestResult) -> Double) -> OptimizerResult? {
        var bestParams: [String: Int] = [:]
        var bestMetric: Double = -Double.infinity
        var allResults: [[String: Int]: Double] = [:]
        for fast in fastRange {
            for slow in slowRange where slow > fast {
                if let result = BacktestEngine.maCrossBacktest(closes: closes, fast: fast, slow: slow) {
                    let m = metric(result)
                    allResults[["fast": fast, "slow": slow]] = m
                    if m > bestMetric {
                        bestMetric = m
                        bestParams = ["fast": fast, "slow": slow]
                    }
                }
            }
        }
        guard !bestParams.isEmpty else { return nil }
        return OptimizerResult(bestParams: bestParams, bestMetric: bestMetric, allResults: allResults)
    }
    // 可擴充 RSI/MACD 等策略優化
}
