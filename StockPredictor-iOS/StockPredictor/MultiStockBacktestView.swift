import SwiftUI

struct MultiStockBacktestView: View {
    @State private var batchOptResults: [BatchOptimizerResult] = []
    @State private var isBatchOptimizing = false
    @State private var showBatchOptSheet = false
    @State private var optimizerResult: String = ""
    @State private var isOptimizing = false
    @ObservedObject var cloudSync = CloudSyncManager.shared
    @State private var showLogin = false
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var showHistory = false
    @State private var loadedRecords: [CloudBacktestRecord] = []
    @State private var symbols: String = "AAPL,MSFT,GOOG"
    @State private var maFast: Int = 5
    @State private var maSlow: Int = 20
    @State private var rsiPeriod: Int = 14
    @State private var macdFast: Int = 12
    @State private var macdSlow: Int = 26
    @State private var macdSignal: Int = 9
    @State private var isLoading = false
    @State private var results: [BatchBacktestResult] = []
    @State private var aiSummary: String = ""
    @State private var sortKey: SortKey = .cagr
    @State private var sortDesc: Bool = true

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("多股批次回測").font(.largeTitle).bold()
                    Spacer()
                    if cloudSync.isLoggedIn {
                        Button("登出") { cloudSync.isLoggedIn = false; cloudSync.userId = "" }
                    } else {
                        Button("登入/註冊") { showLogin = true }
                    }
                }
                TextField("輸入股票代碼（逗號分隔）", text: $symbols)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                HStack {
                    Text("MA Fast:")
                    Stepper(value: $maFast, in: 2...maSlow-1) { Text("\(maFast)") }
                    Text("MA Slow:")
                    Stepper(value: $maSlow, in: maFast+1...60) { Text("\(maSlow)") }
                    Text("RSI:")
                    Stepper(value: $rsiPeriod, in: 5...30) { Text("\(rsiPeriod)") }
                }
                HStack {
                    Text("MACD Fast:")
                    Stepper(value: $macdFast, in: 2...macdSlow-1) { Text("\(macdFast)") }
                    Text("MACD Slow:")
                    Stepper(value: $macdSlow, in: macdFast+1...60) { Text("\(macdSlow)") }
                    Text("Signal:")
                    Stepper(value: $macdSignal, in: 2...30) { Text("\(macdSignal)") }
                }
                HStack {
                    Button(action: runBatchBacktest) {
                        HStack { if isLoading { ProgressView() } Text("開始回測") }
                    }.disabled(isLoading)
                    Button(action: optimizeMA) {
                        HStack { if isOptimizing { ProgressView() } Text("策略優化(MA)") }
                    }.disabled(isLoading || symbols.isEmpty)
                    Button(action: batchOptimize) {
                        HStack { if isBatchOptimizing { ProgressView() } Text("批次優化(多股多策略)") }
                    }.disabled(isLoading || symbols.isEmpty)
                if !batchOptResults.isEmpty {
                    Button("查看批次優化結果") { showBatchOptSheet = true }
                }
    // 批次優化多股多策略
    func batchOptimize() {
        let symbolArr = symbols.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty }
        isBatchOptimizing = true
        batchOptResults = []
        BatchOptimizerEngine.optimize(
            symbols: symbolArr,
            fetchHistory: { symbol, cb in TechnicalAPI.shared.fetchHistory(symbol: symbol, completion: cb) },
            maFastRange: 2...10,
            maSlowRange: 10...30,
            rsiRange: 7...21,
            macdFastRange: 6...14,
            macdSlowRange: 15...30,
            macdSignalRange: 5...12,
            metric: { $0.cagr }
        ) { results in
            batchOptResults = results
            isBatchOptimizing = false
        }
    }

    // 一鍵套用最佳參數（以MA為例，套用第一檔最佳MA參數）
    func applyBestMAFromBatch() {
        if let best = batchOptResults.first(where: { $0.strategy == "MA" }) {
            if let fast = best.bestParams["fast"], let slow = best.bestParams["slow"] {
                maFast = fast; maSlow = slow
            }
        }
    }

    // 批次優化結果表格
    @ViewBuilder
    var batchOptSheet: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("批次優化結果").font(.headline)
            if batchOptResults.isEmpty {
                Text("尚無結果")
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("股票").bold().frame(width: 60)
                            Text("策略").bold().frame(width: 50)
                            Text("最佳參數").bold().frame(width: 120)
                            Text("CAGR").bold().frame(width: 60)
                        }
                        ForEach(batchOptResults, id: \ .symbol) { r in
                            HStack {
                                Text(r.symbol).frame(width: 60)
                                Text(r.strategy).frame(width: 50)
                                Text(r.bestParams.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")).frame(width: 120)
                                Text(String(format: "%.2f%%", r.bestMetric*100)).frame(width: 60)
                            }
                        }
                    }
                }.frame(maxHeight: 300)
            }
            Button("一鍵套用最佳MA參數") { applyBestMAFromBatch() }
            Button("關閉") { showBatchOptSheet = false }
        }.padding().frame(width: 400)
    }
    .sheet(isPresented: $showBatchOptSheet) { batchOptSheet }
                    if cloudSync.isLoggedIn {
                        Button("儲存至雲端") { saveToCloud() }.disabled(results.isEmpty)
                        Button("載入歷史紀錄") { loadHistory() }
                    }
                }
    // 登入視窗
    @ViewBuilder
    var loginSheet: some View {
        VStack(spacing: 16) {
            Text("雲端帳號登入/註冊").font(.headline)
            TextField("Email", text: $email).textFieldStyle(RoundedBorderTextFieldStyle())
            SecureField("Password", text: $password).textFieldStyle(RoundedBorderTextFieldStyle())
            Button("登入") {
                cloudSync.login(email: email, password: password) { _ in showLogin = false }
            }.buttonStyle(.borderedProminent)
            Button("取消") { showLogin = false }
        }.padding().frame(width: 300)
    }

    // 歷史紀錄視窗
    @ViewBuilder
    var historySheet: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("雲端歷史回測紀錄").font(.headline)
            if loadedRecords.isEmpty {
                Text("尚無紀錄")
            } else {
                ScrollView {
                    ForEach(loadedRecords) { rec in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("時間：\(rec.timestamp)").font(.caption)
                            Text("股票：\(rec.symbols.joined(separator: ", "))").font(.caption)
                            Text("參數：\(rec.params.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))").font(.caption2)
                            Text("AI摘要：\n\(rec.aiSummary)").font(.footnote).foregroundColor(.blue)
                        }.padding(6).background(Color(.systemGray6)).cornerRadius(8)
                    }
                }.frame(maxHeight: 300)
            }
            Button("關閉") { showHistory = false }
        }.padding().frame(width: 350)
    }
    // 儲存至雲端
    func saveToCloud() {
        let symbolArr = symbols.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty }
        let params: [String: String] = [
            "maFast": String(maFast), "maSlow": String(maSlow), "rsiPeriod": String(rsiPeriod),
            "macdFast": String(macdFast), "macdSlow": String(macdSlow), "macdSignal": String(macdSignal)
        ]
        cloudSync.saveRecord(symbols: symbolArr, params: params, results: results, aiSummary: aiSummary) { _ in }
    }
    // 載入歷史紀錄
    func loadHistory() {
        cloudSync.loadRecords { recs in
            loadedRecords = recs
            showHistory = true
        }
    }
    .sheet(isPresented: $showLogin) { loginSheet }
    .sheet(isPresented: $showHistory) { historySheet }
                if !optimizerResult.isEmpty {
                    Text("最佳MA參數：" + optimizerResult).font(.subheadline).foregroundColor(.orange)
                }
                Divider()
                if !results.isEmpty {
    // 一鍵優化 MA 參數（僅針對第一檔股票示範，可擴充多股）
    func optimizeMA() {
        let symbolArr = symbols.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty }
        guard let first = symbolArr.first else { return }
        isOptimizing = true
        TechnicalAPI.shared.fetchHistory(symbol: first) { result in
            DispatchQueue.main.async {
                isOptimizing = false
                switch result {
                case .success(let closes):
                    if let opt = OptimizerEngine.optimizeMA(closes: closes, fastRange: 2...20, slowRange: 5...60, metric: { $0.cagr }) {
                        if let fast = opt.bestParams["fast"], let slow = opt.bestParams["slow"] {
                            maFast = fast; maSlow = slow
                            optimizerResult = "fast=\(fast), slow=\(slow), CAGR=\(String(format: "%.2f%%", opt.bestMetric*100))"
                        }
                    } else {
                        optimizerResult = "無法找到最佳參數"
                    }
                case .failure:
                    optimizerResult = "歷史資料取得失敗"
                }
            }
        }
    }
                    HStack {
                        Text("排序：")
                        Picker("排序欄位", selection: $sortKey) {
                            ForEach(SortKey.allCases, id: \ .self) { key in
                                Text(key.rawValue).tag(key)
                            }
                        }.pickerStyle(.segmented)
                        Button(action: { sortDesc.toggle() }) {
                            Image(systemName: sortDesc ? "arrow.down" : "arrow.up")
                        }
                        Spacer()
                        Button("匯出 PDF") { exportPDF() }
                        Button("匯出 CSV") { exportCSV() }
                    }
                    ScrollView(.horizontal) {
                        Table(results.sorted(by: sortComparator))
                    }
                    Divider()
                    Text("AI 智能摘要").font(.headline)
                    Text(aiSummary).foregroundColor(.blue)
                }
    @State private var exportURL: URL? = nil
    @State private var showShareSheet = false
    func exportPDF() {
        let symbolArr = symbols.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty }
        if let url = PDFExportHelper.exportBatchStrategyReport(symbols: symbolArr, results: results, aiSummary: aiSummary) {
            exportURL = url
            showShareSheet = true
        }
    }
    func exportCSV() {
        if let url = CSVExportHelper.exportBatchResultsCSV(results: results) {
            exportURL = url
            showShareSheet = true
        }
    }
    // ShareSheet for export
    struct ShareSheet: UIViewControllerRepresentable {
        var activityItems: [Any]
        func makeUIViewController(context: Context) -> UIActivityViewController {
            UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
        }
        func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
    }
        .background(
            Group {
                if let url = exportURL, showShareSheet {
                    ShareSheet(activityItems: [url])
                }
            }
        )
                Spacer()
            }
            .padding()
        }
    }

    func runBatchBacktest() {
        isLoading = true
        results = []
        aiSummary = ""
        let symbolArr = symbols.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }.filter { !$0.isEmpty }
        let customStrategies = CustomStrategyManager.shared.strategies
        BatchBacktestEngine.run(
            symbols: symbolArr,
            maFast: maFast,
            maSlow: maSlow,
            rsiPeriod: rsiPeriod,
            macdFast: macdFast,
            macdSlow: macdSlow,
            macdSignal: macdSignal,
            customStrategies: customStrategies
        ) { res in
            self.results = res
            self.aiSummary = BatchBacktestAIHelper.generateSummary(results: res)
            self.isLoading = false
        }
    }

    func sortComparator(lhs: BatchBacktestResult, rhs: BatchBacktestResult) -> Bool {
        let cmp: Bool
        switch sortKey {
        case .symbol: cmp = lhs.symbol < rhs.symbol
        case .strategy: cmp = lhs.strategy < rhs.strategy
        case .cagr: cmp = lhs.cagr < rhs.cagr
        case .sharpe: cmp = lhs.sharpe < rhs.sharpe
        case .mdd: cmp = lhs.mdd < rhs.mdd
        case .winRate: cmp = lhs.winRate < rhs.winRate
        case .profitFactor: cmp = lhs.profitFactor < rhs.profitFactor
        case .calmarRatio: cmp = lhs.calmarRatio < rhs.calmarRatio
        }
        return sortDesc ? !cmp : cmp
    }
}

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

enum SortKey: String, CaseIterable {
    case symbol = "股票"
    case strategy = "策略"
    case cagr = "CAGR"
    case sharpe = "Sharpe"
    case mdd = "MDD"
    case winRate = "勝率"
    case profitFactor = "盈虧比"
    case calmarRatio = "Calmar"
}

struct Table: View {
    let results: [BatchBacktestResult]
    @State private var showDetailView = false
    @State private var selectedResult: BatchBacktestResult?
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            VStack(alignment: .leading, spacing: 2) {
                // 標題行
                HStack(spacing: 4) {
                    Text("股票").bold().frame(width: 50)
                    Text("策略").bold().frame(width: 80)
                    Text("CAGR").bold().frame(width: 60)
                    Text("Sharpe").bold().frame(width: 60)
                    Text("MDD").bold().frame(width: 60)
                    Text("勝率").bold().frame(width: 50)
                    Text("交易次數").bold().frame(width: 60)
                    Text("盈虧比").bold().frame(width: 60)
                    Text("Calmar").bold().frame(width: 60)
                    Text("詳情").bold().frame(width: 50)
                }
                .padding(.horizontal, 8)
                .background(Color(.systemGray5))
                
                // 數據行
                ForEach(results) { r in
                    HStack(spacing: 4) {
                        Text(r.symbol).frame(width: 50)
                        Text(r.strategy).frame(width: 80).font(.caption)
                        Text(String(format: "%.2f%%", r.cagr*100))
                            .frame(width: 60)
                            .foregroundColor(r.cagr > 0 ? .green : .red)
                        Text(String(format: "%.2f", r.sharpe))
                            .frame(width: 60)
                            .foregroundColor(r.sharpe > 1 ? .green : r.sharpe > 0 ? .orange : .red)
                        Text(String(format: "%.2f%%", r.mdd*100))
                            .frame(width: 60)
                            .foregroundColor(r.mdd > 0.2 ? .red : r.mdd > 0.1 ? .orange : .green)
                        Text(String(format: "%.1f%%", r.winRate*100))
                            .frame(width: 50)
                            .foregroundColor(r.winRate > 0.5 ? .green : .orange)
                        Text("\(r.trades)").frame(width: 60)
                        Text(String(format: "%.2f", r.profitFactor))
                            .frame(width: 60)
                            .foregroundColor(r.profitFactor > 1.5 ? .green : r.profitFactor > 1 ? .orange : .red)
                        Text(String(format: "%.2f", r.calmarRatio))
                            .frame(width: 60)
                            .foregroundColor(r.calmarRatio > 1 ? .green : r.calmarRatio > 0 ? .orange : .red)
                        Button("📊") {
                            selectedResult = r
                            showDetailView = true
                        }
                        .frame(width: 50)
                    }
                    .padding(.horizontal, 8)
                    .background(Color(.systemBackground))
                }
            }
            .font(.caption)
        }
        .sheet(isPresented: $showDetailView) {
            if let result = selectedResult {
                DetailedResultView(result: result)
            }
        }
    }
}

struct DetailedResultView: View {
    let result: BatchBacktestResult
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(result.symbol) - \(result.strategy)")
                        .font(.title2)
                        .bold()
                    
                    Divider()
                    
                    HStack {
                        VStack(alignment: .leading) {
                            Text("績效指標")
                                .font(.headline)
                                .foregroundColor(.blue)
                            
                            Group {
                                HStack {
                                    Text("年化報酬率 (CAGR):")
                                    Spacer()
                                    Text(String(format: "%.2f%%", result.cagr * 100))
                                        .foregroundColor(result.cagr > 0 ? .green : .red)
                                }
                                HStack {
                                    Text("Sharpe 比率:")
                                    Spacer()
                                    Text(String(format: "%.2f", result.sharpe))
                                        .foregroundColor(result.sharpe > 1 ? .green : .orange)
                                }
                                HStack {
                                    Text("最大回撤 (MDD):")
                                    Spacer()
                                    Text(String(format: "%.2f%%", result.mdd * 100))
                                        .foregroundColor(result.mdd > 0.2 ? .red : .green)
                                }
                                HStack {
                                    Text("Calmar 比率:")
                                    Spacer()
                                    Text(String(format: "%.2f", result.calmarRatio))
                                        .foregroundColor(result.calmarRatio > 1 ? .green : .orange)
                                }
                            }
                        }
                        
                        VStack(alignment: .leading) {
                            Text("交易統計")
                                .font(.headline)
                                .foregroundColor(.purple)
                            
                            Group {
                                HStack {
                                    Text("交易次數:")
                                    Spacer()
                                    Text("\(result.trades)")
                                }
                                HStack {
                                    Text("勝率:")
                                    Spacer()
                                    Text(String(format: "%.1f%%", result.winRate * 100))
                                        .foregroundColor(result.winRate > 0.5 ? .green : .orange)
                                }
                                HStack {
                                    Text("盈虧比:")
                                    Spacer()
                                    Text(String(format: "%.2f", result.profitFactor))
                                        .foregroundColor(result.profitFactor > 1.5 ? .green : .orange)
                                }
                                HStack {
                                    Text("最大獲利:")
                                    Spacer()
                                    Text(String(format: "%.2f%%", result.maxWin * 100))
                                        .foregroundColor(.green)
                                }
                                HStack {
                                    Text("最大虧損:")
                                    Spacer()
                                    Text(String(format: "%.2f%%", result.maxLoss * 100))
                                        .foregroundColor(.red)
                                }
                            }
                        }
                    }
                    
                    Spacer()
                    
                    // 策略評級
                    VStack(alignment: .leading, spacing: 8) {
                        Text("策略評級")
                            .font(.headline)
                            .foregroundColor(.orange)
                        
                        let rating = calculateStrategyRating(result)
                        HStack {
                            Text("綜合評分:")
                            Spacer()
                            Text(rating.score)
                                .font(.title2)
                                .bold()
                                .foregroundColor(rating.color)
                        }
                        Text(rating.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
            }
            .navigationTitle("回測詳情")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("關閉") { dismiss() })
        }
    }
    
    func calculateStrategyRating(_ result: BatchBacktestResult) -> (score: String, color: Color, description: String) {
        var score = 0.0
        
        // CAGR 評分 (30%)
        if result.cagr > 0.2 { score += 30 }
        else if result.cagr > 0.1 { score += 20 }
        else if result.cagr > 0.05 { score += 10 }
        
        // Sharpe 評分 (25%)
        if result.sharpe > 1.5 { score += 25 }
        else if result.sharpe > 1.0 { score += 20 }
        else if result.sharpe > 0.5 { score += 10 }
        
        // MDD 評分 (20%)
        if result.mdd < 0.1 { score += 20 }
        else if result.mdd < 0.2 { score += 15 }
        else if result.mdd < 0.3 { score += 5 }
        
        // 勝率評分 (15%)
        if result.winRate > 0.6 { score += 15 }
        else if result.winRate > 0.5 { score += 10 }
        else if result.winRate > 0.4 { score += 5 }
        
        // 盈虧比評分 (10%)
        if result.profitFactor > 2.0 { score += 10 }
        else if result.profitFactor > 1.5 { score += 7 }
        else if result.profitFactor > 1.0 { score += 3 }
        
        let grade: String
        let color: Color
        let description: String
        
        if score >= 80 {
            grade = "A+"
            color = .green
            description = "優秀策略，建議考慮實盤交易"
        } else if score >= 70 {
            grade = "A"
            color = .green
            description = "良好策略，風險控制得當"
        } else if score >= 60 {
            grade = "B+"
            color = .blue
            description = "中等策略，可進一步優化"
        } else if score >= 50 {
            grade = "B"
            color = .orange
            description = "需要改進的策略"
        } else {
            grade = "C"
            color = .red
            description = "不建議使用的策略"
        }
        
        return (grade, color, description)
    }
}
