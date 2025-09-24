import SwiftUI
import Charts

struct AdvancedChartView: View {
    @State private var selectedSymbol = "AAPL"
    @State private var selectedTimeframe = TimeFrame.daily
    @State private var selectedIndicators: Set<TechnicalIndicator> = [.movingAverage, .rsi]
    @State private var chartData: [ChartDataPoint] = []
    @State private var isLoading = false
    @State private var showingIndicatorSettings = false
    @State private var showingChartSettings = false
    
    // 指標設定
    @State private var maShort = 10
    @State private var maLong = 20
    @State private var rsiPeriod = 14
    @State private var macdFast = 12
    @State private var macdSlow = 26
    @State private var macdSignal = 9
    @State private var bbPeriod = 20
    @State private var bbStdDev = 2.0
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 工具欄
                toolbarView
                
                // 圖表區域
                chartView
                
                // 指標面板
                indicatorPanelsView
            }
            .navigationTitle("技術分析")
            .navigationBarItems(
                leading: Button("設定") {
                    showingChartSettings = true
                },
                trailing: Button("指標") {
                    showingIndicatorSettings = true
                }
            )
        }
        .sheet(isPresented: $showingIndicatorSettings) {
            indicatorSettingsSheet
        }
        .sheet(isPresented: $showingChartSettings) {
            chartSettingsSheet
        }
        .onAppear {
            loadChartData()
        }
    }
    
    // 工具欄
    private var toolbarView: some View {
        VStack(spacing: 12) {
            // 股票選擇和時間框架
            HStack {
                // 股票選擇器
                Menu {
                    ForEach(popularStocks, id: \.self) { stock in
                        Button(stock) {
                            selectedSymbol = stock
                            loadChartData()
                        }
                    }
                } label: {
                    HStack {
                        Text(selectedSymbol)
                            .font(.headline)
                            .fontWeight(.bold)
                        Image(systemName: "chevron.down")
                            .font(.caption)
                    }
                    .foregroundColor(.primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                
                Spacer()
                
                // 時間框架選擇器
                Picker("時間框架", selection: $selectedTimeframe) {
                    ForEach(TimeFrame.allCases, id: \.self) { timeframe in
                        Text(timeframe.rawValue).tag(timeframe)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(width: 200)
                .onChange(of: selectedTimeframe) { _ in
                    loadChartData()
                }
            }
            
            // 快速指標選擇
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TechnicalIndicator.allCases, id: \.self) { indicator in
                        indicatorToggleButton(indicator)
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .shadow(radius: 1)
    }
    
    // 指標切換按鈕
    private func indicatorToggleButton(_ indicator: TechnicalIndicator) -> some View {
        Button(action: {
            if selectedIndicators.contains(indicator) {
                selectedIndicators.remove(indicator)
            } else {
                selectedIndicators.insert(indicator)
            }
            loadChartData()
        }) {
            HStack(spacing: 4) {
                Image(systemName: indicator.icon)
                    .font(.caption)
                Text(indicator.shortName)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(selectedIndicators.contains(indicator) ? .white : indicator.color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                selectedIndicators.contains(indicator) ? 
                indicator.color : indicator.color.opacity(0.1)
            )
            .cornerRadius(6)
        }
    }
    
    // 主圖表視圖
    private var chartView: some View {
        VStack(spacing: 0) {
            if isLoading {
                VStack {
                    ProgressView()
                    Text("載入圖表數據...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                }
                .frame(height: 300)
            } else {
                // 價格圖表
                priceChartView
                    .frame(height: 300)
                
                // 成交量圖表
                if selectedIndicators.contains(.volume) {
                    volumeChartView
                        .frame(height: 100)
                }
            }
        }
        .background(Color(.systemBackground))
    }
    
    // 價格圖表
    private var priceChartView: some View {
        Chart {
            // K線圖
            ForEach(chartData) { dataPoint in
                RectangleMark(
                    x: .value("日期", dataPoint.date),
                    yStart: .value("最低", min(dataPoint.open, dataPoint.close)),
                    yEnd: .value("最高", max(dataPoint.open, dataPoint.close))
                )
                .foregroundStyle(dataPoint.close >= dataPoint.open ? .green : .red)
                .opacity(0.8)
                
                RuleMark(
                    x: .value("日期", dataPoint.date),
                    yStart: .value("最低", dataPoint.low),
                    yEnd: .value("最高", dataPoint.high)
                )
                .foregroundStyle(dataPoint.close >= dataPoint.open ? .green : .red)
                .lineStyle(StrokeStyle(lineWidth: 1))
            }
            
            // 移動平均線
            if selectedIndicators.contains(.movingAverage) {
                ForEach(chartData.filter { $0.maShort != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("MA短", dataPoint.maShort!)
                    )
                    .foregroundStyle(.blue)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }
                
                ForEach(chartData.filter { $0.maLong != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("MA長", dataPoint.maLong!)
                    )
                    .foregroundStyle(.orange)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }
            }
            
            // 布林帶
            if selectedIndicators.contains(.bollingerBands) {
                ForEach(chartData.filter { $0.bbUpper != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("BB上", dataPoint.bbUpper!)
                    )
                    .foregroundStyle(.purple)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                    
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("BB中", dataPoint.bbMiddle!)
                    )
                    .foregroundStyle(.purple)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("BB下", dataPoint.bbLower!)
                    )
                    .foregroundStyle(.purple)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { value in
                AxisGridLine()
                AxisValueLabel() {
                    if let price = value.as(Double.self) {
                        Text("$\(String(format: "%.2f", price))")
                            .font(.caption2)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine()
                AxisValueLabel() {
                    if let date = value.as(Date.self) {
                        Text(formatAxisDate(date))
                            .font(.caption2)
                    }
                }
            }
        }
        .padding()
    }
    
    // 成交量圖表
    private var volumeChartView: some View {
        Chart {
            ForEach(chartData) { dataPoint in
                BarMark(
                    x: .value("日期", dataPoint.date),
                    y: .value("成交量", dataPoint.volume)
                )
                .foregroundStyle(dataPoint.close >= dataPoint.open ? .green.opacity(0.6) : .red.opacity(0.6))
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { value in
                AxisGridLine()
                AxisValueLabel() {
                    if let volume = value.as(Double.self) {
                        Text(formatVolume(volume))
                            .font(.caption2)
                    }
                }
            }
        }
        .chartXAxis(.hidden)
        .padding(.horizontal)
    }
    
    // 指標面板
    private var indicatorPanelsView: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                if selectedIndicators.contains(.rsi) {
                    rsiPanelView
                }
                
                if selectedIndicators.contains(.macd) {
                    macdPanelView
                }
                
                if selectedIndicators.contains(.stochastic) {
                    stochasticPanelView
                }
            }
            .padding()
        }
        .frame(maxHeight: 300)
        .background(Color(.systemGray6))
    }
    
    // RSI 面板
    private var rsiPanelView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("RSI (\(rsiPeriod))")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
                if let lastRSI = chartData.last?.rsi {
                    Text(String(format: "%.1f", lastRSI))
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(rsiColor(lastRSI))
                }
            }
            
            Chart {
                ForEach(chartData.filter { $0.rsi != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("RSI", dataPoint.rsi!)
                    )
                    .foregroundStyle(.purple)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }
                
                // RSI 基準線
                RuleMark(y: .value("超買", 70))
                    .foregroundStyle(.red.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                
                RuleMark(y: .value("超賣", 30))
                    .foregroundStyle(.green.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
            }
            .frame(height: 80)
            .chartYScale(domain: 0...100)
            .chartXAxis(.hidden)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
    
    // MACD 面板
    private var macdPanelView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("MACD (\(macdFast),\(macdSlow),\(macdSignal))")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            Chart {
                ForEach(chartData.filter { $0.macd != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("MACD", dataPoint.macd!)
                    )
                    .foregroundStyle(.blue)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    
                    if let signal = dataPoint.macdSignal {
                        LineMark(
                            x: .value("日期", dataPoint.date),
                            y: .value("信號線", signal)
                        )
                        .foregroundStyle(.red)
                        .lineStyle(StrokeStyle(lineWidth: 1))
                    }
                    
                    if let histogram = dataPoint.macdHistogram {
                        BarMark(
                            x: .value("日期", dataPoint.date),
                            y: .value("柱狀圖", histogram)
                        )
                        .foregroundStyle(histogram >= 0 ? .green.opacity(0.6) : .red.opacity(0.6))
                    }
                }
                
                RuleMark(y: .value("零軸", 0))
                    .foregroundStyle(.gray.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1))
            }
            .frame(height: 80)
            .chartXAxis(.hidden)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
    
    // KD 面板
    private var stochasticPanelView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("KD 隨機指標")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            Chart {
                ForEach(chartData.filter { $0.stochK != nil }) { dataPoint in
                    LineMark(
                        x: .value("日期", dataPoint.date),
                        y: .value("%K", dataPoint.stochK!)
                    )
                    .foregroundStyle(.blue)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    
                    if let stochD = dataPoint.stochD {
                        LineMark(
                            x: .value("日期", dataPoint.date),
                            y: .value("%D", stochD)
                        )
                        .foregroundStyle(.red)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    }
                }
                
                RuleMark(y: .value("超買", 80))
                    .foregroundStyle(.red.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                
                RuleMark(y: .value("超賣", 20))
                    .foregroundStyle(.green.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
            }
            .frame(height: 80)
            .chartYScale(domain: 0...100)
            .chartXAxis(.hidden)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
    
    // 指標設定視圖
    private var indicatorSettingsSheet: some View {
        NavigationView {
            Form {
                Section(header: Text("移動平均線")) {
                    HStack {
                        Text("短期週期")
                        Spacer()
                        Stepper("\(maShort)", value: $maShort, in: 5...50)
                    }
                    HStack {
                        Text("長期週期")
                        Spacer()
                        Stepper("\(maLong)", value: $maLong, in: 10...100)
                    }
                }
                
                Section(header: Text("RSI")) {
                    HStack {
                        Text("週期")
                        Spacer()
                        Stepper("\(rsiPeriod)", value: $rsiPeriod, in: 7...21)
                    }
                }
                
                Section(header: Text("MACD")) {
                    HStack {
                        Text("快線週期")
                        Spacer()
                        Stepper("\(macdFast)", value: $macdFast, in: 8...20)
                    }
                    HStack {
                        Text("慢線週期")
                        Spacer()
                        Stepper("\(macdSlow)", value: $macdSlow, in: 20...35)
                    }
                    HStack {
                        Text("信號線週期")
                        Spacer()
                        Stepper("\(macdSignal)", value: $macdSignal, in: 7...15)
                    }
                }
                
                Section(header: Text("布林帶")) {
                    HStack {
                        Text("週期")
                        Spacer()
                        Stepper("\(bbPeriod)", value: $bbPeriod, in: 10...30)
                    }
                    HStack {
                        Text("標準差")
                        Spacer()
                        Stepper(String(format: "%.1f", bbStdDev), value: $bbStdDev, in: 1.0...3.0, step: 0.1)
                    }
                }
            }
            .navigationTitle("指標設定")
            .navigationBarItems(
                leading: Button("取消") {
                    showingIndicatorSettings = false
                },
                trailing: Button("確定") {
                    showingIndicatorSettings = false
                    loadChartData()
                }
            )
        }
    }
    
    // 圖表設定視圖
    private var chartSettingsSheet: some View {
        NavigationView {
            Form {
                Section(header: Text("圖表類型")) {
                    // 這裡可以添加圖表類型選擇
                }
                
                Section(header: Text("顯示選項")) {
                    Toggle("顯示成交量", isOn: .constant(true))
                    Toggle("顯示格線", isOn: .constant(true))
                    Toggle("顯示十字線", isOn: .constant(false))
                }
            }
            .navigationTitle("圖表設定")
            .navigationBarItems(
                trailing: Button("完成") {
                    showingChartSettings = false
                }
            )
        }
    }
    
    // 輔助函數
    private func loadChartData() {
        isLoading = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.chartData = generateMockChartData()
            self.isLoading = false
        }
    }
    
    private func generateMockChartData() -> [ChartDataPoint] {
        var data: [ChartDataPoint] = []
        var basePrice = 150.0
        let calendar = Calendar.current
        let startDate = calendar.date(byAdding: .day, value: -100, to: Date()) ?? Date()
        
        for i in 0..<100 {
            let date = calendar.date(byAdding: .day, value: i, to: startDate) ?? Date()
            let change = Double.random(in: -0.05...0.05)
            basePrice *= (1 + change)
            
            let open = basePrice
            let high = basePrice * Double.random(in: 1.0...1.03)
            let low = basePrice * Double.random(in: 0.97...1.0)
            let close = Double.random(in: low...high)
            let volume = Double.random(in: 1000000...5000000)
            
            var dataPoint = ChartDataPoint(
                date: date,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume
            )
            
            // 計算技術指標
            if selectedIndicators.contains(.movingAverage) && data.count >= maLong {
                let shortMA = data.suffix(maShort).map { $0.close }.reduce(0, +) / Double(maShort)
                let longMA = data.suffix(maLong).map { $0.close }.reduce(0, +) / Double(maLong)
                dataPoint.maShort = shortMA
                dataPoint.maLong = longMA
            }
            
            if selectedIndicators.contains(.rsi) && data.count >= rsiPeriod {
                dataPoint.rsi = calculateRSI(data: data.suffix(rsiPeriod + 1).map { $0.close }, period: rsiPeriod)
            }
            
            if selectedIndicators.contains(.bollingerBands) && data.count >= bbPeriod {
                let prices = data.suffix(bbPeriod).map { $0.close }
                let sma = prices.reduce(0, +) / Double(bbPeriod)
                let stdDev = sqrt(prices.map { pow($0 - sma, 2) }.reduce(0, +) / Double(bbPeriod))
                
                dataPoint.bbMiddle = sma
                dataPoint.bbUpper = sma + (stdDev * bbStdDev)
                dataPoint.bbLower = sma - (stdDev * bbStdDev)
            }
            
            basePrice = close
            data.append(dataPoint)
        }
        
        return data
    }
    
    private func calculateRSI(data: [Double], period: Int) -> Double {
        guard data.count > period else { return 50 }
        
        var gains: [Double] = []
        var losses: [Double] = []
        
        for i in 1..<data.count {
            let change = data[i] - data[i-1]
            if change > 0 {
                gains.append(change)
                losses.append(0)
            } else {
                gains.append(0)
                losses.append(-change)
            }
        }
        
        let avgGain = gains.suffix(period).reduce(0, +) / Double(period)
        let avgLoss = losses.suffix(period).reduce(0, +) / Double(period)
        
        guard avgLoss != 0 else { return 100 }
        
        let rs = avgGain / avgLoss
        return 100 - (100 / (1 + rs))
    }
    
    private func formatAxisDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd"
        return formatter.string(from: date)
    }
    
    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1_000_000 {
            return String(format: "%.1fM", volume / 1_000_000)
        } else if volume >= 1_000 {
            return String(format: "%.1fK", volume / 1_000)
        } else {
            return String(format: "%.0f", volume)
        }
    }
    
    private func rsiColor(_ rsi: Double) -> Color {
        if rsi >= 70 {
            return .red
        } else if rsi <= 30 {
            return .green
        } else {
            return .blue
        }
    }
}

// 數據模型
struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Double
    
    // 技術指標
    var maShort: Double?
    var maLong: Double?
    var rsi: Double?
    var macd: Double?
    var macdSignal: Double?
    var macdHistogram: Double?
    var bbUpper: Double?
    var bbMiddle: Double?
    var bbLower: Double?
    var stochK: Double?
    var stochD: Double?
}

enum TimeFrame: String, CaseIterable {
    case minute1 = "1分"
    case minute5 = "5分"
    case minute15 = "15分"
    case hourly = "1小時"
    case daily = "日線"
    case weekly = "週線"
    case monthly = "月線"
}

enum TechnicalIndicator: String, CaseIterable {
    case movingAverage = "移動平均線"
    case rsi = "RSI"
    case macd = "MACD"
    case bollingerBands = "布林帶"
    case stochastic = "KD指標"
    case volume = "成交量"
    
    var shortName: String {
        switch self {
        case .movingAverage: return "MA"
        case .rsi: return "RSI"
        case .macd: return "MACD"
        case .bollingerBands: return "BB"
        case .stochastic: return "KD"
        case .volume: return "VOL"
        }
    }
    
    var icon: String {
        switch self {
        case .movingAverage: return "chart.line.uptrend.xyaxis"
        case .rsi: return "waveform.path.ecg"
        case .macd: return "chart.bar.xaxis"
        case .bollingerBands: return "arrow.up.and.down.and.arrow.left.and.right"
        case .stochastic: return "waveform.path"
        case .volume: return "chart.bar.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .movingAverage: return .blue
        case .rsi: return .purple
        case .macd: return .green
        case .bollingerBands: return .orange
        case .stochastic: return .red
        case .volume: return .gray
        }
    }
}

private let popularStocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"]

struct AdvancedChartView_Previews: PreviewProvider {
    static var previews: some View {
        AdvancedChartView()
    }
}