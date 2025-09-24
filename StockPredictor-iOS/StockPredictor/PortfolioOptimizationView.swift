import SwiftUI

struct PortfolioOptimizationView: View {
    @State private var selectedSymbols: [String] = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    @State private var riskTolerance: RiskTolerance = .moderate
    @State private var investmentHorizon: InvestmentHorizon = .mediumTerm
    @State private var optimizedPortfolio: OptimizedPortfolio?
    @State private var isOptimizing = false
    @State private var showingSymbolPicker = false
    @State private var newSymbol = ""
    @State private var showingResults = false
    @State private var showingRebalancingAdvice = false
    
    private let availableSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX", "JNJ", "PG", "KO", "WMT", "UNH", "HD", "V", "MA", "JPM", "BAC", "XOM", "CVX"]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // 標題區域
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "chart.pie.fill")
                                .foregroundColor(.blue)
                                .font(.title2)
                            Text("AI 投資組合優化器")
                                .font(.title2)
                                .fontWeight(.bold)
                            Spacer()
                        }
                        
                        Text("使用現代投資組合理論和 AI 分析，為您創建最佳投資組合配置")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    
                    // 股票選擇區域
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("選擇股票")
                                .font(.headline)
                            Spacer()
                            Button(action: {
                                showingSymbolPicker = true
                            }) {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(.blue)
                                    .font(.title3)
                            }
                        }
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 8) {
                            ForEach(selectedSymbols, id: \.self) { symbol in
                                HStack {
                                    Text(symbol)
                                        .font(.system(.body, design: .monospaced))
                                        .fontWeight(.semibold)
                                    
                                    Spacer()
                                    
                                    Button(action: {
                                        selectedSymbols.removeAll { $0 == symbol }
                                    }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.red)
                                            .font(.caption)
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(8)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                    
                    // 風險偏好設定
                    VStack(alignment: .leading, spacing: 12) {
                        Text("風險偏好")
                            .font(.headline)
                        
                        Picker("風險偏好", selection: $riskTolerance) {
                            ForEach(RiskTolerance.allCases, id: \.self) { risk in
                                VStack(alignment: .leading) {
                                    Text(risk.rawValue)
                                        .font(.body)
                                    Text("目標報酬率: \(String(format: "%.1f", risk.returnTarget * 100))%")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .tag(risk)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("目標波動率")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("\(String(format: "%.1f", riskTolerance.volatilityTarget * 100))%")
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.blue)
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("預期報酬率")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("\(String(format: "%.1f", riskTolerance.returnTarget * 100))%")
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.green)
                            }
                        }
                        .padding(.top, 8)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                    
                    // 投資期間設定
                    VStack(alignment: .leading, spacing: 12) {
                        Text("投資期間")
                            .font(.headline)
                        
                        Picker("投資期間", selection: $investmentHorizon) {
                            ForEach(InvestmentHorizon.allCases, id: \.self) { horizon in
                                Text(horizon.rawValue).tag(horizon)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        
                        Text("再平衡頻率: 每 \(investmentHorizon.rebalancingFrequency) 天")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                    
                    // 優化按鈕
                    Button(action: optimizePortfolio) {
                        HStack {
                            if isOptimizing {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                Text("優化中...")
                            } else {
                                Image(systemName: "brain.head.profile")
                                Text("開始 AI 優化")
                            }
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [.blue, .purple]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                    }
                    .disabled(isOptimizing || selectedSymbols.count < 2)
                    
                    // 優化結果
                    if let portfolio = optimizedPortfolio {
                        portfolioResultsView(portfolio)
                    }
                }
                .padding()
            }
            .navigationTitle("投資組合優化")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showingSymbolPicker) {
            symbolPickerSheet
        }
        .sheet(isPresented: $showingResults) {
            if let portfolio = optimizedPortfolio {
                detailedResultsSheet(portfolio)
            }
        }
        .sheet(isPresented: $showingRebalancingAdvice) {
            if let portfolio = optimizedPortfolio {
                rebalancingAdviceSheet(portfolio)
            }
        }
    }
    
    // 股票選擇器
    private var symbolPickerSheet: some View {
        NavigationView {
            List {
                Section(header: Text("新增股票代號")) {
                    HStack {
                        TextField("輸入股票代號", text: $newSymbol)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.allCharacters)
                        
                        Button("添加") {
                            let symbol = newSymbol.uppercased().trimmingCharacters(in: .whitespaces)
                            if !symbol.isEmpty && !selectedSymbols.contains(symbol) {
                                selectedSymbols.append(symbol)
                                newSymbol = ""
                            }
                        }
                        .disabled(newSymbol.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                
                Section(header: Text("推薦股票")) {
                    ForEach(availableSymbols.filter { !selectedSymbols.contains($0) }, id: \.self) { symbol in
                        Button(action: {
                            selectedSymbols.append(symbol)
                        }) {
                            Text(symbol)
                                .foregroundColor(.primary)
                        }
                    }
                }
            }
            .navigationTitle("選擇股票")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("完成") {
                    showingSymbolPicker = false
                }
            )
        }
    }
    
    // 投資組合結果視圖
    private func portfolioResultsView(_ portfolio: OptimizedPortfolio) -> some View {
        VStack(spacing: 16) {
            // 績效概覽
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("預期報酬率")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.2f", portfolio.expectedReturn * 100))%")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                }
                
                Spacer()
                
                VStack(alignment: .center, spacing: 4) {
                    Text("波動率")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.2f", portfolio.expectedVolatility * 100))%")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.orange)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Sharpe 比率")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.2f", portfolio.sharpeRatio))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
            
            // 權重分布
            VStack(alignment: .leading, spacing: 12) {
                Text("最佳權重配置")
                    .font(.headline)
                
                ForEach(portfolio.weights.sorted(by: { $0.value > $1.value }), id: \.key) { symbol, weight in
                    HStack {
                        Text(symbol)
                            .font(.system(.body, design: .monospaced))
                            .fontWeight(.semibold)
                            .frame(width: 60, alignment: .leading)
                        
                        GeometryReader { geometry in
                            HStack(spacing: 0) {
                                Rectangle()
                                    .fill(LinearGradient(
                                        gradient: Gradient(colors: [.blue, .purple]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ))
                                    .frame(width: geometry.size.width * CGFloat(weight))
                                
                                Rectangle()
                                    .fill(Color.clear)
                            }
                        }
                        .frame(height: 20)
                        .background(Color(.systemGray5))
                        .cornerRadius(10)
                        
                        Text("\(String(format: "%.1f", weight * 100))%")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .frame(width: 50, alignment: .trailing)
                    }
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 2)
            
            // 行動按鈕
            HStack(spacing: 12) {
                Button(action: {
                    showingResults = true
                }) {
                    HStack {
                        Image(systemName: "doc.text.magnifyingglass")
                        Text("詳細分析")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(10)
                }
                
                Button(action: {
                    showingRebalancingAdvice = true
                }) {
                    HStack {
                        Image(systemName: "slider.horizontal.3")
                        Text("再平衡建議")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.purple.opacity(0.1))
                    .cornerRadius(10)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
    
    // 詳細結果視圖
    private func detailedResultsSheet(_ portfolio: OptimizedPortfolio) -> some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // 風險指標
                    VStack(alignment: .leading, spacing: 12) {
                        Text("風險分析")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            riskMetricCard("最大回撤", "\(String(format: "%.2f", portfolio.maxDrawdown * 100))%", .red)
                            riskMetricCard("95% VaR", "\(String(format: "%.2f", portfolio.riskMetrics.var95 * 100))%", .orange)
                            riskMetricCard("95% CVaR", "\(String(format: "%.2f", portfolio.riskMetrics.cvar95 * 100))%", .pink)
                            riskMetricCard("Beta", String(format: "%.2f", portfolio.riskMetrics.beta), .blue)
                            riskMetricCard("Alpha", "\(String(format: "%.2f", portfolio.riskMetrics.alpha * 100))%", .green)
                            riskMetricCard("資訊比率", String(format: "%.2f", portfolio.riskMetrics.informationRatio), .purple)
                        }
                    }
                    
                    // 分散化分析
                    VStack(alignment: .leading, spacing: 12) {
                        Text("分散化分析")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        HStack {
                            VStack(alignment: .leading) {
                                Text("分散化得分")
                                    .font(.headline)
                                Text(String(format: "%.1f/100", portfolio.diversificationScore))
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(diversificationColor(portfolio.diversificationScore))
                            }
                            
                            Spacer()
                            
                            CircularProgressView(
                                progress: portfolio.diversificationScore / 100,
                                color: diversificationColor(portfolio.diversificationScore)
                            )
                            .frame(width: 80, height: 80)
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                    }
                    
                    // 績效預測
                    VStack(alignment: .leading, spacing: 12) {
                        Text("績效預測")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        performanceForecastView(portfolio)
                    }
                }
                .padding()
            }
            .navigationTitle("詳細分析")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("完成") {
                    showingResults = false
                }
            )
        }
    }
    
    // 再平衡建議視圖
    private func rebalancingAdviceSheet(_ portfolio: OptimizedPortfolio) -> some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    Text("基於當前市場條件的再平衡建議")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                    
                    ForEach(portfolio.rebalancingAdvice, id: \.symbol) { advice in
                        rebalancingAdviceCard(advice)
                    }
                }
                .padding()
            }
            .navigationTitle("再平衡建議")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("完成") {
                    showingRebalancingAdvice = false
                }
            )
        }
    }
    
    // 風險指標卡片
    private func riskMetricCard(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(10)
        .shadow(radius: 1)
    }
    
    // 再平衡建議卡片
    private func rebalancingAdviceCard(_ advice: RebalancingAdvice) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(advice.symbol)
                    .font(.headline)
                    .fontWeight(.bold)
                
                Spacer()
                
                Text(advice.action)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(actionColor(advice.action))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(actionColor(advice.action).opacity(0.1))
                    .cornerRadius(8)
            }
            
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("當前權重")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.1f", advice.currentWeight * 100))%")
                        .font(.body)
                        .fontWeight(.semibold)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(.secondary)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("目標權重")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.1f", advice.targetWeight * 100))%")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }
                
                Spacer()
            }
            
            Text(advice.reason)
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }
    
    // 績效預測視圖
    private func performanceForecastView(_ portfolio: OptimizedPortfolio) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("1年期績效預測範圍")
                .font(.headline)
            
            let worstCase = portfolio.expectedReturn - 2 * portfolio.expectedVolatility
            let bestCase = portfolio.expectedReturn + 2 * portfolio.expectedVolatility
            
            VStack(spacing: 8) {
                HStack {
                    Text("悲觀情境 (5%)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(String(format: "%.1f", worstCase * 100))%")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)
                }
                
                HStack {
                    Text("預期報酬")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(String(format: "%.1f", portfolio.expectedReturn * 100))%")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }
                
                HStack {
                    Text("樂觀情境 (95%)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(String(format: "%.1f", bestCase * 100))%")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // 輔助函數
    private func diversificationColor(_ score: Double) -> Color {
        switch score {
        case 80...100: return .green
        case 60..<80: return .blue
        case 40..<60: return .orange
        default: return .red
        }
    }
    
    private func actionColor(_ action: String) -> Color {
        switch action {
        case "增加": return .green
        case "減少": return .red
        default: return .blue
        }
    }
    
    // 優化投資組合
    private func optimizePortfolio() {
        guard selectedSymbols.count >= 2 else { return }
        
        isOptimizing = true
        
        let request = PortfolioOptimizationRequest(
            symbols: selectedSymbols,
            riskTolerance: riskTolerance,
            investmentHorizon: investmentHorizon,
            targetReturn: nil,
            constraints: PortfolioConstraints(
                maxSingleWeight: 0.4,
                minSingleWeight: 0.05,
                sectorLimits: nil,
                excludeSymbols: nil,
                includeSymbols: nil
            )
        )
        
        AIPortfolioOptimizer.shared.optimizePortfolio(request: request) { result in
            DispatchQueue.main.async {
                self.isOptimizing = false
                
                switch result {
                case .success(let portfolio):
                    self.optimizedPortfolio = portfolio
                case .failure(let error):
                    print("優化失敗: \(error)")
                }
            }
        }
    }
}

// 圓形進度視圖
struct CircularProgressView: View {
    let progress: Double
    let color: Color
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 8)
            
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 1), value: progress)
            
            Text("\(Int(progress * 100))")
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
    }
}

struct PortfolioOptimizationView_Previews: PreviewProvider {
    static var previews: some View {
        PortfolioOptimizationView()
    }
}