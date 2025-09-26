import Foundation

class CustomStrategyEngine {
    // 支援簡單公式解析與執行（僅示範，實際可擴充）
    // 公式範例: "close > MA(close,20) and RSI(close,14) < 30"
    static func evaluate(formula: String, closes: [Double], opens: [Double]? = nil, highs: [Double]? = nil, lows: [Double]? = nil, volumes: [Double]? = nil) -> [Bool] {
        // 僅支援單條件: close > MA(close,20)
        // 可擴充為完整解析器
        var signals = [Bool](repeating: false, count: closes.count)
        if formula.contains("close > MA(close,") {
            if let maStart = formula.range(of: "MA(close,")?.upperBound,
               let maEnd = formula[maStart...].firstIndex(of: ")"),
               let period = Int(formula[maStart..<maEnd]) {
                let ma = movingAverage(closes, period: period)
                for i in 0..<closes.count {
                    if i >= period-1 {
                        signals[i] = closes[i] > ma[i]
                    }
                }
            }
        }
        // 可擴充更多條件與運算
        return signals
    }

    static func movingAverage(_ arr: [Double], period: Int) -> [Double] {
        var ma: [Double] = []
        for i in 0..<arr.count {
            if i < period-1 { ma.append(Double.nan) }
            else { ma.append(arr[(i-period+1)...i].reduce(0,+)/Double(period)) }
        }
        return ma
    }
}
