import SwiftUI
import Combine

struct StockAnalysisView: View {
    // AI explanation for strategies
    @State private var aiStrategyExplanation: String = ""
    @State private var news: [NewsItem] = []
    @State private var newsLoading = false
    @State private var newsError: String?
    // 用戶自訂參數
    @State private var simDays: Int = 21
    @State private var simPaths: Int = 20
    @State private var maPeriod: Int = 20
    @State private var maFast: Int = 5
    @State private var rsiPeriod: Int = 14
    @State private var macdFast: Int = 12
    @State private var macdSlow: Int = 26
    @State private var macdSignal: Int = 9
    @State private var aiSummary: AISummaryResponse?
    @State private var aiSummaryLoading = false
    @State private var aiSummaryError: String?
    let symbol: String
    @State private var quote: QuoteResponse?
    @State private var loading = false
    @State private var error: String?
    @State private var closes: [Double] = []
    @State private var candles: [Candlestick] = []
    @State private var ma20: Double?
    @State private var rsi: Double?
    @State private var profile: FMPProfile?
    @State private var sentiment: SentimentResponse?
    @State private var simulation: SimulationResult?
    @State private var events: [StockEvent] = []
    @State private var eventsLoading = false
    @State private var eventsError: String?
        @State private var showShareSheet = false
        @State private var pdfURL: URL?

    // Multi-strategy backtest results
    @State private var backtestResults: [BacktestResult] = []

    @ObservedObject var langManager = LocalizationManager.shared

    var body: some View {
                    Divider()
                    // 公司新聞摘要區塊
                    Text("公司新聞摘要").font(.headline)
                    if newsLoading {
                        ProgressView("載入中...")
                    } else if let err = newsError {
                        Text("新聞載入失敗：\(err)").foregroundColor(.red)
                    } else if news.isEmpty {
                        Text("暫無新聞")
                    } else {
                        ForEach(news.prefix(5)) { item in
                            VStack(alignment: .leading, spacing: 2) {
                                Link(item.title, destination: URL(string: item.url)!)
                                    .font(.subheadline).bold()
                                Text(item.summary).font(.caption).foregroundColor(.secondary)
                                Text(item.date).font(.caption2).foregroundColor(.gray)
                            }.padding(.vertical, 2)
                        }
                    }
        NavigationView {
            VStack {
                HStack {
                    Spacer()
                    Picker("Language", selection: $langManager.locale) {
                        Text("繁體中文").tag(Locale(identifier: "zh-Hant"))
                        Text("English").tag(Locale(identifier: "en"))
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
                .padding(.top, 8)
                // 目標價推播設定
                PriceAlertSettingView(symbol: symbol)
                // 策略參數設定區塊
                DisclosureGroup("策略參數設定".localized(langManager.locale.identifier)) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("MA Fast:")
                            Stepper(value: $maFast, in: 2...maPeriod-1, step: 1) {
                                Text("\(maFast)")
                            }
                            Text("MA Slow:")
                            Stepper(value: $maPeriod, in: maFast+1...60, step: 1) {
                                Text("\(maPeriod)")
                            }
                        }
                        HStack {
                            Text("RSI 週期:")
                            Stepper(value: $rsiPeriod, in: 5...30, step: 1) {
                                Text("\(rsiPeriod)")
                            }
                        }
                        HStack {
                            Text("MACD Fast:")
                            Stepper(value: $macdFast, in: 2...macdSlow-1, step: 1) {
                                Text("\(macdFast)")
                            }
                            Text("MACD Slow:")
                            Stepper(value: $macdSlow, in: macdFast+1...60, step: 1) {
                                Text("\(macdSlow)")
                            }
                            Text("Signal:")
                            Stepper(value: $macdSignal, in: 2...30, step: 1) {
                                Text("\(macdSignal)")
                            }
                        }
                        Button("重新回測".localized(langManager.locale.identifier)) {
                            runCustomBacktest()
                        }.buttonStyle(.borderedProminent)
                    }
                }.padding(.bottom, 6)
    // 依用戶參數執行多策略回測
    func runCustomBacktest() {
        backtestResults = BacktestEngine.multiStrategyBacktest(
            closes: closes,
            maPeriod: maPeriod,
            rsiPeriod: rsiPeriod,
            maFast: maFast,
            macdFast: macdFast,
            macdSlow: macdSlow,
            macdSignal: macdSignal
        )
        aiStrategyExplanation = BacktestAIHelper.generateExplanation(results: backtestResults)
    }
// 目標價推播設定元件
struct PriceAlertSettingView: View {
    @ObservedObject var manager = PriceAlertManager.shared
    @State private var target: String = ""
    @State private var above: Bool = true
    let symbol: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("目標價推播提醒").font(.headline)
            HStack {
                TextField("目標價", text: $target)
                    .keyboardType(.decimalPad)
                    .frame(width: 80)
                Picker("方向", selection: $above) {
                    Text("高於").tag(true)
                    Text("低於").tag(false)
                }.pickerStyle(.segmented).frame(width: 100)
                Button("新增") {
                    if let t = Double(target) {
                        manager.addAlert(symbol: symbol, target: t, above: above)
                        target = ""
                    }
                }.buttonStyle(.bordered)
            }
            ForEach(manager.alerts.filter { $0.symbol == symbol }) { alert in
                HStack {
                    Text("當價格\(alert.above ? ">=" : "<=")$\(String(format: "%.2f", alert.target)) 時提醒")
                    Spacer()
                    Button(role: .destructive) {
                        manager.removeAlert(alert)
                    } label: {
                        Image(systemName: "trash")
                    }
                }.font(.caption)
            }
        }.padding(.vertical, 4)
    }
}
                HStack {
                    Spacer()
                    ThemeStatusView()
                }
                .padding(.bottom, 2)
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
// 顯示目前主題狀態
struct ThemeStatusView: View {
    @Environment(\.colorScheme) var colorScheme
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: colorScheme == .dark ? "moon.fill" : "sun.max.fill")
                .foregroundColor(colorScheme == .dark ? .yellow : .orange)
            Text(colorScheme == .dark ? "深色模式" : "淺色模式")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
                    // 用戶自訂模擬參數區塊
                    DisclosureGroup("模擬/技術指標參數設定".localized(langManager.locale.identifier)) {
                        HStack {
                            Text("模擬天數：".localized(langManager.locale.identifier))
                            Stepper(value: $simDays, in: 5...90, step: 1) {
                                Text("\(simDays) " + "天".localized(langManager.locale.identifier))
                            }
                        }
                        HStack {
                            Text("模擬路徑數：".localized(langManager.locale.identifier))
                            Stepper(value: $simPaths, in: 5...100, step: 1) {
                                Text("\(simPaths) " + "條".localized(langManager.locale.identifier))
                            }
                        }
                        HStack {
                            Text("MA 週期：".localized(langManager.locale.identifier))
                            Stepper(value: $maPeriod, in: 5...60, step: 1) {
                                Text("\(maPeriod)")
                            }
                        }
                        HStack {
                            Text("RSI 週期：".localized(langManager.locale.identifier))
                            Stepper(value: $rsiPeriod, in: 5...30, step: 1) {
                                Text("\(rsiPeriod)")
                            }
                        }
                        Button("重新分析".localized(langManager.locale.identifier)) {
                            fetchAll()
                        }.buttonStyle(.borderedProminent)
                    }.padding(.bottom, 6)
                    Text("\(symbol) " + "多因子分析".localized(langManager.locale.identifier))
                        .font(.title2).bold()
                    if loading {
                        ProgressView("載入中...".localized(langManager.locale.identifier))
                    } else if let quote = quote {
                        HStack {
                            Text("現價：".localized(langManager.locale.identifier))
                            Text(String(format: "$%.2f", quote.price))
                                .foregroundColor(.green)
                        }
                        .font(.title3)
                    } else if let error = error {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("錯誤：".localized(langManager.locale.identifier) + error).foregroundColor(.red)
                            Button("重試") {
                                fetchAll()
                            }.buttonStyle(.borderedProminent)
                        }
                    }
                    Divider()
                    // AI 智能摘要區塊
                    Text("AI 智能摘要與建議".localized(langManager.locale.identifier)).font(.headline)
                    if aiSummaryLoading {
                        ProgressView("AI 分析生成中...".localized(langManager.locale.identifier))
                    } else if let ai = aiSummary {
                        Text(ai.summary).font(.body).padding(.bottom, 2)
                        if let sug = ai.suggestion {
                            Text("建議：".localized(langManager.locale.identifier) + sug).font(.subheadline).foregroundColor(.blue)
                        }
                    } else if let err = aiSummaryError {
                        Text("AI 產生失敗：".localized(langManager.locale.identifier) + err).foregroundColor(.red)
                    } else {
                        Text("尚未產生AI摘要".localized(langManager.locale.identifier))
                    }
                    // K線圖區塊
                    Text("歷史價格K線圖".localized(langManager.locale.identifier)).font(.headline)
                    if candles.count > 1 {
                        ChartZoomScrollView(height: 180) {
                            ZStack {
                                CandlestickChart(candles: candles, height: 180)
                                // 事件標記
                                if !events.isEmpty {
                                    GeometryReader { geo in
                                        ForEach(events) { event in
                                            if let idx = candles.firstIndex(where: { Calendar.current.isDate($0.date, inSameDayAs: event.date) }) {
                                                let w = geo.size.width
                                                let candleW = max(w / CGFloat(max(candles.count, 20)), 4)
                                                let x = CGFloat(idx) * candleW + candleW/2
                                                VStack(spacing: 0) {
                                                    Image(systemName: event.type == "dividend" ? "dollarsign.circle" : event.type == "buyback" ? "arrow.2.circlepath" : "star.circle")
                                                        .resizable().frame(width: 14, height: 14)
                                                        .foregroundColor(event.type == "dividend" ? .yellow : event.type == "buyback" ? .blue : .purple)
                                                    Text(event.type.localized(langManager.locale.identifier)).font(.caption2).foregroundColor(.secondary)
                                                }
                                                .position(x: x, y: 16)
                                                .help(event.description)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        if eventsLoading {
                            ProgressView("公司事件載入中...")
                        } else if let err = eventsError {
                            Text("公司事件載入失敗：\(err)").foregroundColor(.red)
                        } else if !events.isEmpty {
                            HStack(spacing: 8) {
                                ForEach(events) { event in
                                    Label(event.type.localized(langManager.locale.identifier), systemImage: event.type == "dividend" ? "dollarsign.circle" : event.type == "buyback" ? "arrow.2.circlepath" : "star.circle")
                                        .font(.caption)
                                        .foregroundColor(event.type == "dividend" ? .yellow : event.type == "buyback" ? .blue : .purple)
                                        .help(event.description)
                                }
                            }
                        }
                    } else {
                        Text("載入中...".localized(langManager.locale.identifier)).font(.footnote)
                    }
                    // 技術指標區塊
                    Text("技術指標".localized(langManager.locale.identifier)).font(.headline)
                    if closes.count > 1 {
                        ChartZoomScrollView(height: 160) {
                            LineChart(data: closes, ma: ma20, height: 160, color: .blue, maColor: .orange)
                        }
                        .padding(.vertical, 4)
                    }
                    HStack {
                        VStack(alignment: .leading) {
                            if let ma20 = ma20 {
                                Text("MA20: ".localized(langManager.locale.identifier) + "$\(String(format: "%.2f", ma20))")
                            } else {
                                Text("MA20: ".localized(langManager.locale.identifier) + "載入中...".localized(langManager.locale.identifier))
                            }
                            if let rsi = rsi {
                                Text("RSI: ".localized(langManager.locale.identifier) + "\(String(format: "%.1f", rsi))")
                            } else {
                                Text("RSI: ".localized(langManager.locale.identifier) + "載入中...".localized(langManager.locale.identifier))
                            }
                        }
                        Spacer()
                    }
                    Divider()
                    // 基本面區塊
                    Text("基本面摘要".localized(langManager.locale.identifier)).font(.headline)
                    if let p = profile {
                        VStack(alignment: .leading, spacing: 4) {
                            if let name = p.companyName { Text("公司：".localized(langManager.locale.identifier) + name) }
                            if let cap = p.marketCap { Text("市值：".localized(langManager.locale.identifier) + "$\(formatBillion(cap))") }
                            if let pe = p.pe { Text("PE：".localized(langManager.locale.identifier) + "\(String(format: "%.2f", pe))") }
                            if let dy = p.dividendYield { Text("股息率：".localized(langManager.locale.identifier) + "\(String(format: "%.2f%%", dy*100))") }
                            if let sector = p.sector { Text("產業：".localized(langManager.locale.identifier) + sector) }
                            if let desc = p.description { Text(desc).font(.footnote).foregroundColor(.secondary) }
                        }
                    } else {
                        Text("載入中...".localized(langManager.locale.identifier))
                    }
                    Divider()
                    // 情緒分析區塊
                    Text("情緒指標".localized(langManager.locale.identifier)).font(.headline)
                    if let s = sentiment {
                        VStack(alignment: .leading, spacing: 4) {
                            if let sentiment = s.sentiment {
                                Text("新聞/社交情緒：".localized(langManager.locale.identifier) + sentiment)
                            }
                            if let score = s.score {
                                Text("分數：".localized(langManager.locale.identifier) + "\(String(format: "%.2f", score))")
                            }
                            if let details = s.details {
                                Text(details).font(.footnote).foregroundColor(.secondary)
                            }
                        }
                    } else {
                        Text("載入中...".localized(langManager.locale.identifier))
                    }
                    Divider()
                    // 蒙特卡洛模擬區塊
                    Text("蒙特卡洛模擬".localized(langManager.locale.identifier)).font(.headline)
                    if let sim = simulation {
                        if let paths = sim.paths, paths.count > 0 {
                            Text("模擬多路徑價格走勢圖".localized(langManager.locale.identifier)).font(.subheadline)
                            SimulationPathsChart(paths: paths, height: 120)
                                .padding(.vertical, 4)
                        }
                        if let mean = sim.mean, let lower = sim.lower, let upper = sim.upper {
                            SimulationRangeChart(mean: mean, lower: lower, upper: upper, height: 80)
                                .padding(.vertical, 4)
                            Text(String(format: NSLocalizedString("未來1個月目標價分布：\n均值$%1$@，90%區間$%2$@~$%3$@", comment: ""), String(format: "%.2f", mean), String(format: "%.2f", lower), String(format: "%.2f", upper)).localized(langManager.locale.identifier))
                        }
                        Divider()
                        // 策略回測區塊
                        Text("策略回測 (MA交叉)".localized(langManager.locale.identifier)).font(.headline)
                        if let bt = backtestResult {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("CAGR: \(String(format: \"%.2f%%\", bt.cagr*100))")
                                Text("Sharpe: \(String(format: \"%.2f\", bt.sharpe))")
                                Text("最大回撤: \(String(format: \"%.2f%%\", bt.mdd*100))")
                                Text("交易次數: \(bt.trades)")
                                Text("勝率: \(String(format: \"%.1f%%\", bt.winRate*100))")
                            }
                            .font(.subheadline)
                            .padding(.bottom, 4)
                            if bt.equityCurve.count > 1 {
                                ChartZoomScrollView(height: 120) {
                                    LineChart(data: bt.equityCurve, ma: nil, height: 120, color: .purple, maColor: .clear)
                                }
                                .padding(.vertical, 2)
                            }
                        } else {
                            Text("回測資料不足或載入中...".localized(langManager.locale.identifier)).font(.footnote)
                        }
                    } else {
                        Text("載入中...".localized(langManager.locale.identifier))
                    }
                    HStack {
                        Spacer()
                        Button {
                            exportPDF()
                        } label: {
                            Label("匯出分析報告 PDF".localized(langManager.locale.identifier), systemImage: "doc.richtext")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    }
                    .padding()
                    .background(
                        Group {
                            if let url = pdfURL, showShareSheet {
                                ShareSheet(activityItems: [url])
                            }
                        }
                    )
                }
            }
            .navigationTitle("\(symbol) " + "分析".localized(langManager.locale.identifier))
            .onAppear(perform: fetchAll)
        }
    }

        // 匯出PDF功能
        extension StockAnalysisView {
            func exportPDF() {
                // 匯出多策略績效與 AI 解釋為專業 PDF 報告
                if let url = PDFExportHelper.exportStrategyReport(symbol: symbol, backtestResults: backtestResults, aiExplanation: aiStrategyExplanation) {
                    pdfURL = url
                    showShareSheet = true
                }
            }
        }

        // SwiftUI ShareSheet
        struct ShareSheet: UIViewControllerRepresentable {
            var activityItems: [Any]
            func makeUIViewController(context: Context) -> UIActivityViewController {
                UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
            }
            func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
        }
    func fetchAll() {
        // 6. 公司新聞
        newsLoading = true
        newsError = nil
        NewsAPI.shared.fetchNews(symbol: symbol) { arr in
            DispatchQueue.main.async {
                newsLoading = false
                if let arr = arr {
                    news = arr
                } else {
                    newsError = "API錯誤"
                }
            }
        }
        // 7. 公司事件
        eventsLoading = true
        eventsError = nil
        StockEventAPI.shared.fetchEvents(symbol: symbol) { result in
            DispatchQueue.main.async {
                eventsLoading = false
                switch result {
                case .success(let arr):
                    events = arr
                case .failure(let err):
                    eventsError = err.localizedDescription
                }
            }
        }
        // 5. AI 智能摘要
        aiSummaryLoading = true
        loading = true
        error = nil
        // 1. 報價
        MultiSourceQuoteAPI.shared.fetchQuote(symbol: symbol) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let q):
                    quote = q
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
        // 2. 歷史價格（收盤價）
        TechnicalAPI.shared.fetchHistory(symbol: symbol) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let closesArr):
                    closes = closesArr
                    ma20 = TechnicalAPI.shared.movingAverage(closesArr, period: maPeriod)
                    rsi = TechnicalAPI.shared.rsi(closesArr, period: rsiPeriod)
                    // Run multi-strategy backtest
                    backtestResults = BacktestEngine.multiStrategyBacktest(closes: closesArr, maPeriod: maPeriod, rsiPeriod: rsiPeriod)
                    // Generate AI explanation for strategies
                    aiStrategyExplanation = BacktestAIHelper.generateExplanation(results: backtestResults)
                    // 5. 蒙特卡洛模擬
                    SimulationAPI.shared.runJumpSimulationWithPaths(closes: closesArr, days: simDays, paths: simPaths) { simResult in
                        DispatchQueue.main.async {
                            switch simResult {
                            case .success(let sim):
                                simulation = sim
                                // AI 智能摘要（等所有資料齊全再呼叫）
                                AISummaryAPI.shared.fetchAISummary(symbol: symbol, quote: quote, ma20: ma20, rsi: rsi, profile: profile, sentiment: sentiment, simulation: sim) { result in
                                    DispatchQueue.main.async {
                                        aiSummaryLoading = false
                                        switch result {
                                        case .success(let ai):
                                            aiSummary = ai
                                        case .failure(let err):
                                            aiSummaryError = err.localizedDescription
                                        }
                                    }
                                }
                            case .failure:
                                break
                            }
                        }
                    }
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
        // 2b. 歷史K線資料
        TechnicalAPI.shared.fetchCandles(symbol: symbol) { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let candleArr):
                    candles = candleArr
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
        // 3. 基本面
        FundamentalAPI.shared.fetchProfile(symbol: symbol) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let p):
                    profile = p
                case .failure:
                    break
                }
            }
        }
                        // 多策略回測區塊
                        Text("多策略回測比較".localized(langManager.locale.identifier)).font(.headline)
                        if backtestResults.isEmpty {
                            Text("回測資料不足或載入中...".localized(langManager.locale.identifier)).font(.footnote)
                        } else {
                            ForEach(backtestResults) { bt in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("策略：\(bt.strategy)").font(.subheadline).bold()
                                    Text("CAGR: \(String(format: \"%.2f%%\", bt.cagr*100))")
                                    Text("Sharpe: \(String(format: \"%.2f\", bt.sharpe))")
                                    Text("最大回撤: \(String(format: \"%.2f%%\", bt.mdd*100))")
                                    Text("交易次數: \(bt.trades)")
                                    Text("勝率: \(String(format: \"%.1f%%\", bt.winRate*100))")
                                }
                                .font(.subheadline)
                                .padding(.bottom, 2)
                                if bt.equityCurve.count > 1 {
                                    ChartZoomScrollView(height: 100) {
                                        LineChart(data: bt.equityCurve, ma: nil, height: 100, color: .purple, maColor: .clear)
                                    }
                                    .padding(.vertical, 2)
                                }
                                Divider()
                            }
                            // AI 訊號解釋區塊
                            if !aiStrategyExplanation.isEmpty {
                                Text("AI 策略解釋與建議".localized(langManager.locale.identifier)).font(.headline).padding(.top, 4)
                                Text(aiStrategyExplanation).font(.body).foregroundColor(.blue)
                            }
                        }
    }
}
