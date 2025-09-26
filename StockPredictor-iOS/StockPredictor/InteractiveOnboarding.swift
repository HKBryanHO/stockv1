import SwiftUI

struct OnboardingView: View {
    @State private var currentPage = 0
    @State private var showInteractiveDemo = false
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ZStack {
                // 背景漸變
                LinearGradient(
                    gradient: Gradient(colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                TabView(selection: $currentPage) {
                    ForEach(0..<onboardingPages.count, id: \.self) { index in
                        onboardingPageView(onboardingPages[index], index: index)
                            .tag(index)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                
                VStack {
                    Spacer()
                    
                    // 自定義頁面指示器
                    HStack(spacing: 8) {
                        ForEach(0..<onboardingPages.count, id: \.self) { index in
                            Circle()
                                .fill(currentPage == index ? Color.blue : Color.gray.opacity(0.4))
                                .frame(width: 8, height: 8)
                                .scaleEffect(currentPage == index ? 1.2 : 1.0)
                                .animation(.spring(response: 0.3), value: currentPage)
                        }
                    }
                    .padding(.bottom, 30)
                    
                    // 操作按鈕
                    HStack(spacing: 20) {
                        if currentPage > 0 {
                            Button("上一步") {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    currentPage -= 1
                                }
                            }
                            .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            if currentPage < onboardingPages.count - 1 {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    currentPage += 1
                                }
                            } else {
                                showInteractiveDemo = true
                            }
                        }) {
                            HStack {
                                Text(currentPage == onboardingPages.count - 1 ? "開始體驗" : "下一步")
                                if currentPage == onboardingPages.count - 1 {
                                    Image(systemName: "play.circle.fill")
                                } else {
                                    Image(systemName: "arrow.right")
                                }
                            }
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .padding()
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [.blue, .purple]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(25)
                        }
                    }
                    .padding(.horizontal, 30)
                    .padding(.bottom, 30)
                }
            }
            .navigationBarItems(
                trailing: Button("跳過") {
                    presentationMode.wrappedValue.dismiss()
                }
                .foregroundColor(.secondary)
            )
        }
        .sheet(isPresented: $showInteractiveDemo) {
            InteractiveDemoView()
        }
    }
    
    private func onboardingPageView(_ page: OnboardingPage, index: Int) -> some View {
        ScrollView {
            VStack(spacing: 30) {
                Spacer(minLength: 50)
                
                // 動畫圖標
                ZStack {
                    Circle()
                        .fill(page.iconBackgroundColor.opacity(0.1))
                        .frame(width: 120, height: 120)
                    
                    Image(systemName: page.iconName)
                        .font(.system(size: 50))
                        .foregroundColor(page.iconBackgroundColor)
                        .scaleEffect(currentPage == index ? 1.2 : 1.0)
                        .animation(.spring(response: 0.5, dampingFraction: 0.6), value: currentPage)
                }
                
                // 標題和描述
                VStack(spacing: 16) {
                    Text(page.title)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.primary)
                    
                    Text(page.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                        .padding(.horizontal, 40)
                }
                
                // 功能亮點
                if !page.features.isEmpty {
                    VStack(spacing: 12) {
                        ForEach(page.features, id: \.self) { feature in
                            HStack(spacing: 12) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                    .font(.title3)
                                
                                Text(feature)
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                                
                                Spacer()
                            }
                            .padding(.horizontal, 40)
                        }
                    }
                    .padding(.top, 20)
                }
                
                // 互動示例
                if let demoView = page.demoView {
                    VStack(spacing: 16) {
                        Text("試試看")
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)
                        
                        demoView
                            .padding()
                            .background(Color(.systemBackground))
                            .cornerRadius(12)
                            .shadow(radius: 4)
                            .padding(.horizontal, 20)
                    }
                    .padding(.top, 20)
                }
                
                Spacer(minLength: 150)
            }
        }
    }
}

// 互動式演示視圖
struct InteractiveDemoView: View {
    @State private var demoStep = 0
    @State private var selectedStock = "AAPL"
    @State private var selectedStrategy = "MA交叉"
    @State private var isRunningBacktest = false
    @State private var backtestProgress: Double = 0.0
    @Environment(\.presentationMode) var presentationMode
    
    private let demoSteps = [
        "歡迎來到互動演示！我們將一步步展示如何使用應用程式。",
        "首先，讓我們選擇一隻股票進行分析。",
        "接下來，選擇一個交易策略。",
        "現在開始運行回測，看看策略的表現如何。",
        "太棒了！您已經完成了第一次策略回測。現在可以開始使用應用程式了！"
    ]
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                // 進度指示器
                HStack {
                    ForEach(0..<demoSteps.count, id: \.self) { index in
                        Circle()
                            .fill(index <= demoStep ? Color.blue : Color.gray.opacity(0.3))
                            .frame(width: 12, height: 12)
                        
                        if index < demoSteps.count - 1 {
                            Rectangle()
                                .fill(index < demoStep ? Color.blue : Color.gray.opacity(0.3))
                                .frame(height: 2)
                        }
                    }
                }
                .padding(.horizontal)
                
                // 當前步驟說明
                VStack(spacing: 16) {
                    Text("步驟 \(demoStep + 1) / \(demoSteps.count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(demoSteps[demoStep])
                        .font(.headline)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .padding(.horizontal)
                
                // 演示內容
                Spacer()
                
                Group {
                    switch demoStep {
                    case 0:
                        welcomeDemoView
                    case 1:
                        stockSelectionDemoView
                    case 2:
                        strategySelectionDemoView
                    case 3:
                        backtestDemoView
                    case 4:
                        completionDemoView
                    default:
                        EmptyView()
                    }
                }
                
                Spacer()
                
                // 操作按鈕
                HStack(spacing: 20) {
                    if demoStep > 0 && demoStep < demoSteps.count - 1 {
                        Button("上一步") {
                            withAnimation(.easeInOut) {
                                demoStep -= 1
                            }
                        }
                        .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        if demoStep < demoSteps.count - 1 {
                            withAnimation(.easeInOut) {
                                demoStep += 1
                            }
                        } else {
                            presentationMode.wrappedValue.dismiss()
                        }
                    }) {
                        HStack {
                            Text(demoStep == demoSteps.count - 1 ? "開始使用" : "下一步")
                            Image(systemName: demoStep == demoSteps.count - 1 ? "checkmark.circle" : "arrow.right")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .navigationTitle("互動演示")
            .navigationBarItems(
                trailing: Button("跳過") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private var welcomeDemoView: some View {
        VStack(spacing: 20) {
            Image(systemName: "hand.wave.fill")
                .font(.system(size: 60))
                .foregroundColor(.blue)
            
            Text("準備好開始您的投資之旅了嗎？")
                .fontWeight(.semibold)
        }
    }
    
    private var stockSelectionDemoView: some View {
        VStack(spacing: 16) {
            Text("選擇股票")
                .font(.headline)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(["AAPL", "TSLA", "MSFT", "GOOGL"], id: \.self) { stock in
                        Button(action: {
                            selectedStock = stock
                        }) {
                            Text(stock)
                                .font(.headline)
                                .foregroundColor(selectedStock == stock ? .white : .blue)
                                .padding()
                                .background(selectedStock == stock ? Color.blue : Color.blue.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }
                .padding(.horizontal)
            }
            
            if !selectedStock.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("已選擇 \(selectedStock)")
                        .fontWeight(.semibold)
                }
            }
        }
    }
    
    private var strategySelectionDemoView: some View {
        VStack(spacing: 16) {
            Text("選擇交易策略")
                .font(.headline)
            
            VStack(spacing: 8) {
                ForEach(["MA交叉", "RSI策略", "MACD策略"], id: \.self) { strategy in
                    Button(action: {
                        selectedStrategy = strategy
                    }) {
                        HStack {
                            Text(strategy)
                                .fontWeight(.semibold)
                            Spacer()
                            if selectedStrategy == strategy {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                            }
                        }
                        .foregroundColor(selectedStrategy == strategy ? .white : .primary)
                        .padding()
                        .background(selectedStrategy == strategy ? Color.blue : Color(.systemGray6))
                        .cornerRadius(8)
                    }
                }
            }
            .padding(.horizontal)
        }
    }
    
    private var backtestDemoView: some View {
        VStack(spacing: 20) {
            Text("運行回測")
                .font(.headline)
            
            VStack(spacing: 12) {
                Text("股票: \(selectedStock)")
                Text("策略: \(selectedStrategy)")
            }
            .font(.subheadline)
            .foregroundColor(.secondary)
            
            if isRunningBacktest {
                VStack(spacing: 12) {
                    ProgressView(value: backtestProgress)
                        .progressViewStyle(LinearProgressViewStyle())
                        .scaleEffect(y: 2)
                    
                    Text("分析中... \(Int(backtestProgress * 100))%")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            } else {
                Button("開始回測") {
                    startDemoBacktest()
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .background(Color.green)
                .cornerRadius(12)
            }
            
            if backtestProgress >= 1.0 {
                VStack(spacing: 8) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("回測完成！")
                            .fontWeight(.semibold)
                    }
                    
                    Text("年化報酬率: 15.2%")
                        .foregroundColor(.green)
                    Text("Sharpe比率: 1.85")
                        .foregroundColor(.blue)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
        }
        .padding()
    }
    
    private var completionDemoView: some View {
        VStack(spacing: 20) {
            Image(systemName: "star.fill")
                .font(.system(size: 60))
                .foregroundColor(.yellow)
            
            Text("恭喜！")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("您已經學會了如何使用股票預測應用程式的基本功能。現在可以開始探索更多高級功能了！")
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
    
    private func startDemoBacktest() {
        isRunningBacktest = true
        backtestProgress = 0.0
        
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            backtestProgress += 0.05
            if backtestProgress >= 1.0 {
                backtestProgress = 1.0
                timer.invalidate()
            }
        }
    }
}

// 引導頁面數據模型
struct OnboardingPage {
    let title: String
    let description: String
    let iconName: String
    let iconBackgroundColor: Color
    let features: [String]
    let demoView: AnyView?
    
    init(title: String, description: String, iconName: String, iconBackgroundColor: Color, features: [String] = [], demoView: AnyView? = nil) {
        self.title = title
        self.description = description
        self.iconName = iconName
        self.iconBackgroundColor = iconBackgroundColor
        self.features = features
        self.demoView = demoView
    }
}

// 引導頁面數據
let onboardingPages = [
    OnboardingPage(
        title: "歡迎使用智慧股票分析",
        description: "專業級的投資分析工具，幫助您做出更明智的投資決策",
        iconName: "brain.head.profile",
        iconBackgroundColor: .blue,
        features: [
            "AI 驅動的股票分析",
            "專業級回測引擎",
            "智能投資組合優化",
            "實時市場數據"
        ]
    ),
    OnboardingPage(
        title: "AI 智能分析",
        description: "運用先進的人工智能技術，為您提供深度的股票分析和投資建議",
        iconName: "cpu",
        iconBackgroundColor: .green,
        features: [
            "技術面分析",
            "基本面評估",
            "市場情緒分析",
            "風險評估"
        ],
        demoView: AnyView(
            VStack {
                HStack {
                    Text("AAPL")
                        .font(.headline)
                        .fontWeight(.bold)
                    Spacer()
                    Text("買入")
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green)
                        .cornerRadius(6)
                }
                
                HStack {
                    Text("AI 信心度")
                    Spacer()
                    HStack(spacing: 2) {
                        ForEach(0..<5) { _ in
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                                .font(.caption)
                        }
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
        )
    ),
    OnboardingPage(
        title: "策略回測",
        description: "使用歷史數據驗證您的交易策略，評估策略的可行性和風險",
        iconName: "chart.bar.xaxis",
        iconBackgroundColor: .purple,
        features: [
            "多種技術指標策略",
            "詳細績效分析",
            "風險指標計算",
            "視覺化結果展示"
        ],
        demoView: AnyView(
            VStack(spacing: 8) {
                HStack {
                    Text("年化報酬率")
                    Spacer()
                    Text("15.2%")
                        .foregroundColor(.green)
                        .fontWeight(.semibold)
                }
                
                HStack {
                    Text("Sharpe 比率")
                    Spacer()
                    Text("1.85")
                        .foregroundColor(.blue)
                        .fontWeight(.semibold)
                }
                
                HStack {
                    Text("最大回撤")
                    Spacer()
                    Text("-8.5%")
                        .foregroundColor(.red)
                        .fontWeight(.semibold)
                }
            }
            .font(.caption)
        )
    ),
    OnboardingPage(
        title: "投資組合優化",
        description: "基於現代投資組合理論，為您創建最優的資產配置方案",
        iconName: "chart.pie.fill",
        iconBackgroundColor: .orange,
        features: [
            "風險與報酬平衡",
            "相關性分析",
            "再平衡建議",
            "多種優化策略"
        ],
        demoView: AnyView(
            VStack(spacing: 6) {
                HStack {
                    Text("AAPL")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Rectangle()
                        .fill(Color.blue)
                        .frame(height: 8)
                        .cornerRadius(4)
                    Text("35%")
                        .font(.caption2)
                }
                
                HStack {
                    Text("MSFT")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Rectangle()
                        .fill(Color.green)
                        .frame(height: 8)
                        .cornerRadius(4)
                    Text("25%")
                        .font(.caption2)
                }
                
                HStack {
                    Text("GOOGL")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Rectangle()
                        .fill(Color.purple)
                        .frame(height: 8)
                        .cornerRadius(4)
                    Text("40%")
                        .font(.caption2)
                }
            }
        )
    )
]

struct OnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        OnboardingView()
    }
}