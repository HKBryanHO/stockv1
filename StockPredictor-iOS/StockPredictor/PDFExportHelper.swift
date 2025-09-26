    /// 匯出多股多策略績效與 AI 摘要為 PDF
    static func exportBatchStrategyReport(symbols: [String], results: [BatchBacktestResult], aiSummary: String, fileName: String = "BatchStrategyReport.pdf") -> URL? {
        let format = UIGraphicsPDFRendererFormat()
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842) // A4
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        let textFont = UIFont.systemFont(ofSize: 14)
        let titleFont = UIFont.boldSystemFont(ofSize: 20)
        let subtitleFont = UIFont.boldSystemFont(ofSize: 16)
        let margin: CGFloat = 32
        let spacing: CGFloat = 18
        let tableFont = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        let data = renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = margin
            // 標題
            let title = "多股多策略回測報告"
            let titleAttr = [NSAttributedString.Key.font: titleFont]
            title.draw(at: CGPoint(x: margin, y: y), withAttributes: titleAttr)
            y += titleFont.lineHeight + spacing
            // 策略績效表
            "績效比較表".draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: subtitleFont])
            y += subtitleFont.lineHeight + 6
            let header = String(format: "%-8s %-8s %-8s %-8s %-8s %-8s", "股票", "策略", "CAGR", "Sharpe", "MDD", "勝率")
            header.draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: tableFont])
            y += tableFont.lineHeight + 2
            for r in results {
                let row = String(format: "%-8s %-8s %-8.2f%% %-8.2f %-8.2f%% %-8.1f%%", r.symbol, r.strategy, r.cagr*100, r.sharpe, r.mdd*100, r.winRate*100)
                row.draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: tableFont])
                y += tableFont.lineHeight + 2
            }
            y += spacing
            // AI 解釋
            "AI 智能摘要".draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: subtitleFont])
            y += subtitleFont.lineHeight + 4
            let aiAttr = [NSAttributedString.Key.font: textFont]
            let aiRect = CGRect(x: margin, y: y, width: pageRect.width - margin*2, height: 300)
            aiSummary.draw(with: aiRect, options: .usesLineFragmentOrigin, attributes: aiAttr, context: nil)
        }
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }
import PDFKit
import SwiftUI

import UIKit
struct PDFExportHelper {
    static func render(view: UIView, fileName: String) -> URL? {
        let pdfRenderer = UIGraphicsPDFRenderer(bounds: view.bounds)
        let data = pdfRenderer.pdfData { ctx in
            ctx.beginPage()
            view.layer.render(in: ctx.cgContext)
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }

    /// 將多策略績效與 AI 解釋匯出為純文字 PDF
    static func exportStrategyReport(symbol: String, backtestResults: [BacktestResult], aiExplanation: String, fileName: String = "StrategyReport.pdf") -> URL? {
        let format = UIGraphicsPDFRendererFormat()
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842) // A4
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        let textFont = UIFont.systemFont(ofSize: 14)
        let titleFont = UIFont.boldSystemFont(ofSize: 20)
        let subtitleFont = UIFont.boldSystemFont(ofSize: 16)
        let margin: CGFloat = 32
        let spacing: CGFloat = 18
        let tableFont = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        let data = renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = margin
            // 標題
            let title = "\(symbol) 多策略回測報告"
            let titleAttr = [NSAttributedString.Key.font: titleFont]
            title.draw(at: CGPoint(x: margin, y: y), withAttributes: titleAttr)
            y += titleFont.lineHeight + spacing
            // 策略績效表
            "策略績效比較".draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: subtitleFont])
            y += subtitleFont.lineHeight + 6
            let header = String(format: "%-8s %-8s %-8s %-8s %-8s %-8s", "策略", "CAGR", "Sharpe", "MDD", "次數", "勝率")
            header.draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: tableFont])
            y += tableFont.lineHeight + 2
            for bt in backtestResults {
                let row = String(format: "%-8s %-8.2f%% %-8.2f %-8.2f%% %-8d %-8.1f%%", bt.strategy, bt.cagr*100, bt.sharpe, bt.mdd*100, bt.trades, bt.winRate*100)
                row.draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: tableFont])
                y += tableFont.lineHeight + 2
            }
            y += spacing
            // AI 解釋
            "AI 策略解釋與建議".draw(at: CGPoint(x: margin, y: y), withAttributes: [ .font: subtitleFont])
            y += subtitleFont.lineHeight + 4
            let aiAttr = [NSAttributedString.Key.font: textFont]
            let aiRect = CGRect(x: margin, y: y, width: pageRect.width - margin*2, height: 300)
            aiExplanation.draw(with: aiRect, options: .usesLineFragmentOrigin, attributes: aiAttr, context: nil)
        }
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }
}
