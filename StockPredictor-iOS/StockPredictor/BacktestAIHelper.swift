import Foundation

struct BacktestAIHelper {
    static func generateExplanation(results: [BacktestResult]) -> String {
        guard !results.isEmpty else { return "" }
        // 尋找最佳策略
        let sorted = results.sorted { $0.cagr > $1.cagr }
        let best = sorted.first!
        var lines: [String] = []
        lines.append("最佳策略：\(best.strategy)，年化報酬率 \(String(format: "%.2f%%", best.cagr*100))，Sharpe \(String(format: "%.2f", best.sharpe))，最大回撤 \(String(format: "%.2f%%", best.mdd*100))。")
        if best.sharpe > 1.0 {
            lines.append("風險調整後表現良好，適合穩健型投資者。")
        } else if best.sharpe > 0.5 {
            lines.append("風險調整後表現中等，建議搭配其他因子參考。")
        } else {
            lines.append("風險較高，建議審慎評估與分散配置。")
        }
        if let worst = results.min(by: { $0.cagr < $1.cagr }), worst.strategy != best.strategy {
            lines.append("相較下，\(worst.strategy) 策略表現較弱，年化報酬率僅 \(String(format: "%.2f%%", worst.cagr*100))。")
        }
        lines.append("建議：可優先考慮績效最佳策略，並持續追蹤市場變化調整參數。");
        return lines.joined(separator: "\n")
    }
}