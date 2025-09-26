import Foundation

struct CSVExportHelper {
    static func exportBatchResultsCSV(results: [BatchBacktestResult], fileName: String = "BatchBacktest.csv") -> URL? {
        let header = "股票,策略,CAGR,Sharpe,MDD,勝率\n"
        let rows = results.map { r in
            "\(r.symbol),\(r.strategy),\(String(format: "%.4f", r.cagr)),\(String(format: "%.2f", r.sharpe)),\(String(format: "%.4f", r.mdd)),\(String(format: "%.3f", r.winRate))"
        }
        let csv = header + rows.joined(separator: "\n")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }
}