import SwiftUI

@main
struct StockPredictorApp: App {
    @State private var showSplash = true
    var body: some Scene {
        WindowGroup {
            ZStack {
                MainTabView()
                if showSplash {
                    SplashScreenView()
                        .transition(.opacity)
                        .zIndex(1)
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                withAnimation { showSplash = false }
                            }
                        }
                }
            }
            .accentColor(Color("BrandPrimary"))
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("首頁")
                }
            StockSelectorView()
                .tabItem {
                    Image(systemName: "chart.xyaxis.line")
                    Text("分析")
                }
            MultiStockBacktestView()
                .tabItem {
                    Image(systemName: "chart.bar.xaxis")
                    Text("回測")
                }
            PortfolioOptimizationView()
                .tabItem {
                    Image(systemName: "chart.pie.fill")
                    Text("投組優化")
                }
            MarketView()
                .tabItem {
                    Image(systemName: "globe")
                    Text("行情")
                }
            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape.fill")
                    Text("設定")
                }
        }
    }
}

// 首頁分頁
struct HomeView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // 歡迎區域
                    VStack(spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("智慧股票分析")
                                    .font(.title)
                                    .fontWeight(.bold)
                                Text("專業級投資決策工具")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 40))
                                .foregroundColor(.blue)
                        }
                        
                        HStack(spacing: 16) {
                            StatCard(title: "AI 分析", value: "95%", subtitle: "準確率", color: .blue)
                            StatCard(title: "回測策略", value: "12+", subtitle: "種類", color: .green)
                            StatCard(title: "投組優化", value: "智能", subtitle: "配置", color: .purple)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)
                    
                    // 功能快捷入口
                    VStack(alignment: .leading, spacing: 16) {
                        Text("主要功能")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 16) {
                            NavigationLink(destination: StockSelectorView()) {
                                FeatureCard(
                                    icon: "chart.xyaxis.line",
                                    title: "股票分析",
                                    subtitle: "AI 驅動的深度分析",
                                    color: .blue
                                )
                            }
                            
                            NavigationLink(destination: MultiStockBacktestView()) {
                                FeatureCard(
                                    icon: "chart.bar.xaxis",
                                    title: "策略回測",
                                    subtitle: "多種交易策略驗證",
                                    color: .green
                                )
                            }
                            
                            NavigationLink(destination: PortfolioOptimizationView()) {
                                FeatureCard(
                                    icon: "chart.pie.fill",
                                    title: "投組優化",
                                    subtitle: "智能資產配置",
                                    color: .purple
                                )
                            }
                            
                            NavigationLink(destination: AIStockRecommendationView()) {
                                FeatureCard(
                                    icon: "brain.head.profile",
                                    title: "AI 推薦",
                                    subtitle: "智能選股建議",
                                    color: .orange
                                )
                            }
                            
                            NavigationLink(destination: AdvancedChartView()) {
                                FeatureCard(
                                    icon: "chart.xyaxis.line",
                                    title: "技術分析",
                                    subtitle: "專業圖表工具",
                                    color: .red
                                )
                            }
                        }
                    }
                    
                    // 最近活動
                    VStack(alignment: .leading, spacing: 12) {
                        Text("最近活動")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        VStack(spacing: 8) {
                            ActivityRow(
                                icon: "chart.line.uptrend.xyaxis",
                                title: "AAPL 分析完成",
                                subtitle: "建議: 買入",
                                time: "2 小時前",
                                color: .green
                            )
                            
                            ActivityRow(
                                icon: "chart.bar.xaxis",
                                title: "MA 策略回測",
                                subtitle: "年化報酬: 15.2%",
                                time: "4 小時前",
                                color: .blue
                            )
                            
                            ActivityRow(
                                icon: "chart.pie",
                                title: "投資組合優化",
                                subtitle: "Sharpe 比率: 1.85",
                                time: "1 天前",
                                color: .purple
                            )
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                }
                .padding()
            }
            .navigationTitle("首頁")
        }
    }
}

// 統計卡片
struct StatCard: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(subtitle)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

// 功能卡片
struct FeatureCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .frame(height: 100)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}

// 活動行
struct ActivityRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let time: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(color)
            }
            
            Spacer()
            
            Text(time)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

// 行情分頁
struct MarketView: View {
    @State private var marketData: [MarketStock] = [
        MarketStock(symbol: "AAPL", name: "Apple Inc.", price: 178.25, change: 2.15, changePercent: 1.22),
        MarketStock(symbol: "TSLA", name: "Tesla Inc.", price: 248.50, change: -5.30, changePercent: -2.09),
        MarketStock(symbol: "MSFT", name: "Microsoft Corp.", price: 378.85, change: 8.45, changePercent: 2.28),
        MarketStock(symbol: "GOOGL", name: "Alphabet Inc.", price: 138.75, change: -1.25, changePercent: -0.89),
        MarketStock(symbol: "AMZN", name: "Amazon Inc.", price: 151.20, change: 3.80, changePercent: 2.58),
        MarketStock(symbol: "NVDA", name: "NVIDIA Corp.", price: 495.50, change: 12.30, changePercent: 2.55)
    ]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // 市場概覽
                    VStack(alignment: .leading, spacing: 12) {
                        Text("市場概覽")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        HStack(spacing: 16) {
                            MarketIndexCard(name: "S&P 500", value: "4,515.85", change: "+28.50", changePercent: "+0.63%", color: .green)
                            MarketIndexCard(name: "NASDAQ", value: "14,125.25", change: "-45.20", changePercent: "-0.32%", color: .red)
                        }
                        
                        HStack(spacing: 16) {
                            MarketIndexCard(name: "道瓊指數", value: "35,215.10", change: "+125.80", changePercent: "+0.36%", color: .green)
                            MarketIndexCard(name: "恐懼指數", value: "18.25", change: "-2.10", changePercent: "-10.3%", color: .green)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    
                    // 熱門股票
                    VStack(alignment: .leading, spacing: 12) {
                        Text("熱門股票")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        ForEach(marketData, id: \.symbol) { stock in
                            MarketStockRow(stock: stock)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                }
                .padding()
            }
            .navigationTitle("市場行情")
            .refreshable {
                // 刷新市場數據
                await refreshMarketData()
            }
        }
    }
    
    private func refreshMarketData() async {
        // 模擬數據刷新
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        // 更新數據...
    }
}

struct MarketStock {
    let symbol: String
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double
}

struct MarketIndexCard: View {
    let name: String
    let value: String
    let change: String
    let changePercent: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.headline)
                .fontWeight(.semibold)
            HStack(spacing: 4) {
                Text(change)
                    .font(.caption)
                    .foregroundColor(color)
                Text(changePercent)
                    .font(.caption)
                    .foregroundColor(color)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

struct MarketStockRow: View {
    let stock: MarketStock
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(stock.symbol)
                    .font(.headline)
                    .fontWeight(.semibold)
                Text(stock.name)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("$\(String(format: "%.2f", stock.price))")
                    .font(.headline)
                    .fontWeight(.semibold)
                HStack(spacing: 4) {
                    Text(stock.change >= 0 ? "+\(String(format: "%.2f", stock.change))" : "\(String(format: "%.2f", stock.change))")
                        .font(.caption)
                        .foregroundColor(stock.change >= 0 ? .green : .red)
                    Text("(\(stock.changePercent >= 0 ? "+\(String(format: "%.2f", stock.changePercent))" : "\(String(format: "%.2f", stock.changePercent))")%)")
                        .font(.caption)
                        .foregroundColor(stock.change >= 0 ? .green : .red)
                }
            }
        }
        .padding(.vertical, 8)
    }
}

// 設定分頁
struct SettingsView: View {
    @State private var isDarkMode = false
    @State private var enableNotifications = true
    @State private var enablePriceAlerts = true
    @State private var autoRefresh = true
    @State private var refreshInterval = 30
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("用戶設定")) {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.blue)
                            .font(.title2)
                        VStack(alignment: .leading) {
                            Text("專業投資者")
                                .font(.headline)
                            Text("demo@stockpredictor.app")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button("編輯") {}
                            .font(.caption)
                    }
                    .padding(.vertical, 4)
                }
                
                Section(header: Text("顯示設定")) {
                    Toggle("深色模式", isOn: $isDarkMode)
                    Toggle("自動刷新", isOn: $autoRefresh)
                    
                    if autoRefresh {
                        HStack {
                            Text("刷新間隔")
                            Spacer()
                            Picker("刷新間隔", selection: $refreshInterval) {
                                Text("10 秒").tag(10)
                                Text("30 秒").tag(30)
                                Text("1 分鐘").tag(60)
                                Text("5 分鐘").tag(300)
                            }
                            .pickerStyle(MenuPickerStyle())
                        }
                    }
                }
                
                Section(header: Text("通知設定")) {
                    Toggle("推送通知", isOn: $enableNotifications)
                    Toggle("價格警報", isOn: $enablePriceAlerts)
                }
                
                Section(header: Text("數據與隱私")) {
                    NavigationLink("數據使用") {
                        Text("數據使用政策")
                    }
                    NavigationLink("隱私政策") {
                        Text("隱私政策詳情")
                    }
                    Button("清除緩存") {
                        // 清除緩存邏輯
                    }
                    .foregroundColor(.red)
                }
                
                Section(header: Text("關於")) {
                    HStack {
                        Text("版本")
                        Spacer()
                        Text("2.1.0")
                            .foregroundColor(.secondary)
                    }
                    NavigationLink("使用教學") {
                        OnboardingView()
                    }
                    NavigationLink("意見回饋") {
                        Text("意見回饋表單")
                    }
                }
                
                Section {
                    Button("登出") {
                        // 登出邏輯
                    }
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, alignment: .center)
                }
            }
            .navigationTitle("設定")
        }
    }
}
