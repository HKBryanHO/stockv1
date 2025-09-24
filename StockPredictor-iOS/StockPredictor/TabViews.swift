struct TabViews: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("首頁", systemImage: "house") }
            PredictView()
                .tabItem { Label("預測", systemImage: "sparkle.magnifyingglass") }
            MarketView()
                .tabItem { Label("行情", systemImage: "chart.bar") }
            MultiStockCompareView()
                .tabItem { Label("多檔比較", systemImage: "line.3.horizontal.decrease") }
        }
    }
}
import SwiftUI

struct HomeView: View {
    @ObservedObject var auth = AuthManager.shared
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var loginError: String?
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("歡迎使用股票預測 App")
                    .font(.title2)
                Text("快速進入預測、行情、圖表等功能。")
                    .foregroundColor(.secondary)
                Divider()
                if auth.isLoggedIn, let user = auth.user {
                    Text("已登入：\(user.email)").foregroundColor(.green)
                    HStack(spacing: 12) {
                        Button("上傳自選股到雲端") {
                            CloudSyncManager.shared.syncFavorites(MarketListManager.shared.symbols, token: user.id) { ok in }
                        }.buttonStyle(.bordered)
                        Button("下載雲端自選股") {
                            CloudSyncManager.shared.fetchFavorites(token: user.id) { arr in
                                if let arr = arr {
                                    DispatchQueue.main.async {
                                        MarketListManager.shared.symbols = arr
                                        MarketListManager.shared.save()
                                    }
                                }
                            }
                        }.buttonStyle(.bordered)
                    }
                    Button("登出") { auth.logout() }
                        .buttonStyle(.borderedProminent)
                } else {
                    VStack(spacing: 8) {
                        TextField("Email", text: $email).textFieldStyle(.roundedBorder)
                        SecureField("Password", text: $password).textFieldStyle(.roundedBorder)
                        if let err = loginError { Text(err).foregroundColor(.red).font(.caption) }
                        Button("登入") {
                            loginError = nil
                            auth.login(email: email, password: password) { success in
                                if !success { loginError = "登入失敗，請檢查帳密" }
                            }
                        }.buttonStyle(.borderedProminent)
                    }.frame(width: 220)
                }
            }
            .navigationTitle("首頁")
        }
    }
}

struct PredictView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("預測功能 (假資料)")
                Button("開始預測") {}
            }
            .navigationTitle("預測")
        }
    }
}

struct MarketView: View {
    @State private var quotes: [String: QuoteResponse] = [:]
    @State private var loading: [String: Bool] = [:]
    @ObservedObject var marketList = MarketListManager.shared
    @State private var newSymbol: String = ""

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                HStack {
                    TextField("新增股票代號 (如AAPL/0700.HK)", text: $newSymbol)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 180)
                    Button("加入") {
                        let s = newSymbol.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !s.isEmpty else { return }
                        marketList.addSymbol(s)
                        fetchQuote(symbol: s)
                        newSymbol = ""
                    }.buttonStyle(.borderedProminent)
                }.padding([.top, .horizontal])
                List {
                    Section(header: Text("自訂股票列表")) {
                        ForEach(marketList.symbols, id: \.self) { symbol in
                            HStack {
                                Text(symbol)
                                Spacer()
                                if let quote = quotes[symbol] {
                                    Text(String(format: "$%.2f", quote.price))
                                        .foregroundColor(.green)
                                } else if loading[symbol] == true {
                                    ProgressView()
                                } else {
                                    Button("載入") {
                                        fetchQuote(symbol: symbol)
                                    }
                                    .buttonStyle(.bordered)
                                }
                                Button(role: .destructive) {
                                    marketList.removeSymbol(symbol)
                                } label: {
                                    Image(systemName: "trash")
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .navigationTitle("行情")
                .onAppear {
                    for symbol in marketList.symbols {
                        fetchQuote(symbol: symbol)
                    }
                }
            }
        }
    }

    func fetchQuote(symbol: String) {
        loading[symbol] = true
        MultiSourceQuoteAPI.shared.fetchQuote(symbol: symbol) { result in
            DispatchQueue.main.async {
                loading[symbol] = false
                switch result {
                case .success(let quote):
                    quotes[symbol] = quote
                case .failure:
                    break
                }
            }
        }
    }
}

struct ChartView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("圖表功能 (假資料)")
                Rectangle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(height: 200)
                    .overlay(Text("K 線圖/技術指標"))
            }
            .navigationTitle("圖表")
        }
    }
}

struct SettingsView: View {
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("帳號")) {
                    Text("用戶：DemoUser")
                }
                Section(header: Text("主題")) {
                    Toggle("深色模式", isOn: .constant(true))
                }
            }
            .navigationTitle("設定")
        }
    }
}
