import SwiftUI

struct AIStockRecommendationView: View {
    @State private var recommendations: [StockRecommendation] = []
    @State private var isLoading = false
    @State private var selectedStrategy = AIStrategy.balanced
    @State private var riskTolerance = RiskLevel.moderate
    @State private var investmentHorizon = TimeHorizon.mediumTerm
    @State private var showingFilters = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // 策略選擇
                    strategySelectionView
                    
                    // 推薦結果
                    if isLoading {
                        loadingView
                    } else if recommendations.isEmpty {
                        emptyStateView
                    } else {
                        recommendationsView
                    }
                }
                .padding()
            }
            .navigationTitle("AI 股票推薦")
            .navigationBarItems(
                leading: Button("篩選") {
                    showingFilters = true
                },
                trailing: Button("刷新") {
                    refreshRecommendations()
                }
            )
        }
        .sheet(isPresented: $showingFilters) {
            filtersSheet
        }
        .onAppear {
            if recommendations.isEmpty {
                refreshRecommendations()
            }
        }
    }
    
    // 策略選擇視圖
    private var strategySelectionView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("投資策略")
                .font(.headline)
                .fontWeight(.semibold)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(AIStrategy.allCases, id: \.self) { strategy in
                        strategyCard(strategy)
                    }
                }
                .padding(.horizontal, 4)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // 策略卡片
    private func strategyCard(_ strategy: AIStrategy) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: strategy.icon)
                    .foregroundColor(selectedStrategy == strategy ? .white : strategy.color)
                    .font(.title2)
                Spacer()
                if selectedStrategy == strategy {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                        .font(.caption)
                }
            }
            
            Text(strategy.rawValue)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(selectedStrategy == strategy ? .white : .primary)
            
            Text(strategy.description)
                .font(.caption)
                .foregroundColor(selectedStrategy == strategy ? .white.opacity(0.8) : .secondary)
                .lineLimit(2)
        }
        .padding()
        .frame(width: 140, height: 100)
        .background(
            selectedStrategy == strategy ?
            LinearGradient(gradient: Gradient(colors: [strategy.color, strategy.color.opacity(0.8)]), startPoint: .topLeading, endPoint: .bottomTrailing) :
            Color(.systemBackground)
        )
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(selectedStrategy == strategy ? Color.clear : Color(.systemGray4), lineWidth: 1)
        )
        .onTapGesture {
            selectedStrategy = strategy
            refreshRecommendations()
        }
    }
    
    // 載入視圖
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
            Text("AI 正在分析市場...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // 空狀態視圖
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text("開始 AI 分析")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("點擊刷新按鈕開始獲取個人化股票推薦")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Button("立即分析") {
                refreshRecommendations()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // 推薦結果視圖
    private var recommendationsView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("推薦結果")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text("更新於 \(formattedUpdateTime)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            ForEach(recommendations, id: \.symbol) { recommendation in
                recommendationCard(recommendation)
            }
        }
    }
    
    // 推薦卡片
    private func recommendationCard(_ recommendation: StockRecommendation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // 頭部信息
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(recommendation.symbol)
                        .font(.headline)
                        .fontWeight(.bold)
                    Text(recommendation.companyName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    RecommendationBadge(recommendation: recommendation.recommendation)
                    
                    HStack(spacing: 4) {
                        ForEach(0..<5) { index in
                            Image(systemName: index < recommendation.confidenceStars ? "star.fill" : "star")
                                .foregroundColor(.yellow)
                                .font(.caption2)
                        }
                        Text("\(Int(recommendation.confidence * 100))%")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            // 價格信息
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("當前價格")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("$\(String(format: "%.2f", recommendation.currentPrice))")
                        .font(.title3)
                        .fontWeight(.semibold)
                }
                
                Spacer()
                
                VStack(alignment: .center, spacing: 2) {
                    Text("目標價格")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("$\(String(format: "%.2f", recommendation.targetPrice))")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("潛在收益")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.1f", recommendation.potentialReturn * 100))%")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(recommendation.potentialReturn >= 0 ? .green : .red)
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(.systemGray6))
            .cornerRadius(8)
            
            // 分析要點
            VStack(alignment: .leading, spacing: 6) {
                Text("分析要點")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                ForEach(recommendation.keyPoints.prefix(3), id: \.self) { point in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                            .padding(.top, 2)
                        
                        Text(point)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
            }
            
            // 風險提示
            if !recommendation.risks.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("風險提示")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.orange)
                    
                    ForEach(recommendation.risks.prefix(2), id: \.self) { risk in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                                .font(.caption)
                                .padding(.top, 2)
                            
                            Text(risk)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
            
            // 行動按鈕
            HStack(spacing: 12) {
                NavigationLink(destination: StockAnalysisView(symbol: recommendation.symbol)) {
                    HStack {
                        Image(systemName: "chart.xyaxis.line")
                        Text("詳細分析")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
                }
                
                Button(action: {
                    // 添加到觀察清單
                }) {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("加入觀察")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }
    
    // 篩選器視圖
    private var filtersSheet: some View {
        NavigationView {
            Form {
                Section(header: Text("風險偏好")) {
                    Picker("風險等級", selection: $riskTolerance) {
                        ForEach(RiskLevel.allCases, id: \.self) { level in
                            Text(level.rawValue).tag(level)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                Section(header: Text("投資期間")) {
                    Picker("時間範圍", selection: $investmentHorizon) {
                        ForEach(TimeHorizon.allCases, id: \.self) { horizon in
                            Text(horizon.rawValue).tag(horizon)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                Section(header: Text("篩選條件")) {
                    Toggle("只顯示買入推薦", isOn: .constant(false))
                    Toggle("排除高風險股票", isOn: .constant(true))
                    Toggle("包含股息股票", isOn: .constant(false))
                }
            }
            .navigationTitle("篩選設定")
            .navigationBarItems(
                leading: Button("取消") {
                    showingFilters = false
                },
                trailing: Button("確定") {
                    showingFilters = false
                    refreshRecommendations()
                }
            )
        }
    }
    
    private var formattedUpdateTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: Date())
    }
    
    private func refreshRecommendations() {
        isLoading = true
        
        // 模擬 AI 分析過程
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.recommendations = generateMockRecommendations()
            self.isLoading = false
        }
    }
    
    private func generateMockRecommendations() -> [StockRecommendation] {
        let mockData = [
            StockRecommendation(
                symbol: "AAPL",
                companyName: "Apple Inc.",
                recommendation: .buy,
                confidence: 0.92,
                currentPrice: 178.25,
                targetPrice: 195.00,
                potentialReturn: 0.094,
                keyPoints: [
                    "iPhone 15 系列銷售強勁，市場份額持續擴大",
                    "服務業務收入穩定增長，毛利率提升",
                    "AI 技術整合帶來新的增長動力",
                    "現金流充沛，股東回報政策優異"
                ],
                risks: [
                    "中國市場競爭激烈，銷售可能受影響",
                    "全球經濟放緩可能影響消費電子需求"
                ]
            ),
            StockRecommendation(
                symbol: "MSFT",
                companyName: "Microsoft Corporation",
                recommendation: .buy,
                confidence: 0.89,
                currentPrice: 378.85,
                targetPrice: 420.00,
                potentialReturn: 0.109,
                keyPoints: [
                    "雲計算業務 Azure 增長強勁",
                    "AI 和機器學習領域領先地位",
                    "企業軟體訂閱模式穩定",
                    "財務表現優異，現金流穩定"
                ],
                risks: [
                    "雲計算市場競爭加劇",
                    "監管風險增加"
                ]
            ),
            StockRecommendation(
                symbol: "NVDA",
                companyName: "NVIDIA Corporation",
                recommendation: .hold,
                confidence: 0.75,
                currentPrice: 495.50,
                targetPrice: 510.00,
                potentialReturn: 0.029,
                keyPoints: [
                    "AI 芯片需求持續旺盛",
                    "數據中心業務快速成長",
                    "遊戲和專業視覺化市場穩定"
                ],
                risks: [
                    "估值偏高，調整風險較大",
                    "地緣政治風險影響供應鏈",
                    "競爭對手加大投入"
                ]
            )
        ]
        
        return mockData.filter { recommendation in
            switch selectedStrategy {
            case .growth:
                return recommendation.potentialReturn > 0.05
            case .value:
                return recommendation.currentPrice < 200
            case .dividend:
                return ["AAPL", "MSFT"].contains(recommendation.symbol)
            case .balanced:
                return true
            case .momentum:
                return recommendation.recommendation == .buy
            }
        }
    }
}

// 推薦徽章
struct RecommendationBadge: View {
    let recommendation: RecommendationType
    
    var body: some View {
        Text(recommendation.rawValue)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(recommendation.color)
            .cornerRadius(6)
    }
}

// 數據模型
struct StockRecommendation {
    let symbol: String
    let companyName: String
    let recommendation: RecommendationType
    let confidence: Double
    let currentPrice: Double
    let targetPrice: Double
    let potentialReturn: Double
    let keyPoints: [String]
    let risks: [String]
    
    var confidenceStars: Int {
        Int(confidence * 5)
    }
}

enum RecommendationType: String, CaseIterable {
    case buy = "買入"
    case hold = "持有"
    case sell = "賣出"
    
    var color: Color {
        switch self {
        case .buy: return .green
        case .hold: return .orange
        case .sell: return .red
        }
    }
}

enum AIStrategy: String, CaseIterable {
    case growth = "成長型"
    case value = "價值型"
    case dividend = "股息型"
    case balanced = "平衡型"
    case momentum = "動量型"
    
    var description: String {
        switch self {
        case .growth: return "關注高成長潛力股票"
        case .value: return "尋找被低估的價值股"
        case .dividend: return "專注穩定股息收入"
        case .balanced: return "成長與價值並重"
        case .momentum: return "追蹤市場動量趨勢"
        }
    }
    
    var icon: String {
        switch self {
        case .growth: return "chart.line.uptrend.xyaxis"
        case .value: return "dollarsign.circle"
        case .dividend: return "percent"
        case .balanced: return "scale.3d"
        case .momentum: return "arrow.up.right"
        }
    }
    
    var color: Color {
        switch self {
        case .growth: return .green
        case .value: return .blue
        case .dividend: return .purple
        case .balanced: return .orange
        case .momentum: return .red
        }
    }
}

enum RiskLevel: String, CaseIterable {
    case conservative = "保守"
    case moderate = "穩健"
    case aggressive = "積極"
}

enum TimeHorizon: String, CaseIterable {
    case shortTerm = "短期"
    case mediumTerm = "中期"
    case longTerm = "長期"
}

struct AIStockRecommendationView_Previews: PreviewProvider {
    static var previews: some View {
        AIStockRecommendationView()
    }
}