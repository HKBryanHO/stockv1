import Foundation

struct BatchBacktestAIHelper {
    static func generateSummary(results: [BatchBacktestResult]) -> String {
        guard !results.isEmpty else { return "" }
        // 以CAGR排序，找出最佳股票與策略
        let best = results.max { $0.cagr < $1.cagr }!
        var lines: [String] = []
        lines.append("最佳組合：\(best.symbol) - \(best.strategy)，年化報酬率 \(String(format: "%.2f%%", best.cagr*100))，Sharpe \(String(format: "%.2f", best.sharpe))，最大回撤 \(String(format: "%.2f%%", best.mdd*100))。")
        let top3 = results.sorted { $0.cagr > $1.cagr }.prefix(3)
        lines.append("前3名：" + top3.map { "\($0.symbol)-\($0.strategy)(\(String(format: "%.2f%%", $0.cagr*100)))" }.joined(separator: ", "))
        if best.sharpe > 1.0 {
            lines.append("風險調整後表現優異，建議重點關注。")
        } else if best.sharpe > 0.5 {
            lines.append("風險調整後表現中等，可納入觀察。")
        } else {
            lines.append("風險較高，建議審慎評估。");
        }
        lines.append("建議：可優先考慮績效最佳組合，並持續追蹤市場變化調整策略。");
        return lines.joined(separator: "\n")
    }
}