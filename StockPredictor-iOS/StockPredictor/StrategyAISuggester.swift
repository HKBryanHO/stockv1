import Foundation

class StrategyAISuggester {
    // AI策略範例與自動補全
    static let templates: [String] = [
        "close > MA(close,20) and RSI(close,14) < 30",
        "close > open and volume > MA(volume,10)",
        "MACD(close,12,26,9) > 0 and close > MA(close,50)",
        "RSI(close,14) < 25 and close < MA(close,60)",
        "close > high[1] and volume > 2*MA(volume,20)"
    ]
    static let functions: [String] = [
        "MA(series,period)",
        "RSI(series,period)",
        "MACD(series,fast,slow,signal)",
        "open", "close", "high", "low", "volume"
    ]
    static func suggest(for input: String) -> [String] {
        // 根據輸入自動補全（簡單範例）
        let lower = input.lowercased()
        return functions.filter { $0.lowercased().hasPrefix(lower) }
    }
    static func randomTemplate() -> String {
        templates.randomElement() ?? "close > MA(close,20)"
    }
    static func aiTip(for input: String) -> String {
        if input.contains("rsi") { return "RSI常用於超買超賣判斷，可配合MA過濾。" }
        if input.contains("macd") { return "MACD可偵測趨勢轉折，建議與量能搭配。" }
        if input.contains("volume") { return "量能異常常為突破訊號，可結合價量。" }
        return "可用函數: " + functions.joined(separator: ", ")
    }
}
