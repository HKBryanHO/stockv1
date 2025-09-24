import SwiftUI

struct StockSelectorView: View {
    @State private var input: String = "KO"
    @State private var selected: String = "KO"
    @State private var showAnalysis = false
    @State private var formatHint: String = ""
    @State private var favorites: [String] = UserDefaults.standard.stringArray(forKey: "favorites") ?? []
    let hotStocks = ["KO", "AAPL", "TSLA", "0700.HK", "9988.HK", "600519.SS"]
    
    var body: some View {
        NavigationView {
            VStack(spacing: 18) {
                TextField("輸入股票代號（如 KO, AAPL, 0700.HK, 600519.SS）", text: $input)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding(.horizontal)
                    .onChange(of: input) { newValue in
                        formatHint = checkSymbolFormat(newValue)
                    }
                if !formatHint.isEmpty {
                    Text(formatHint).font(.footnote).foregroundColor(.orange)
                }
                HStack {
                    Button("分析") {
                        let formatted = autoFormatSymbol(input)
                        selected = formatted
                        input = formatted
                        showAnalysis = true
                    }
                    .buttonStyle(.borderedProminent)
                    Button(action: {
                        let formatted = autoFormatSymbol(input)
                        if !favorites.contains(formatted) && !formatted.isEmpty {
                            favorites.append(formatted)
                            UserDefaults.standard.set(favorites, forKey: "favorites")
                        }
                    }) {
                        Image(systemName: "star")
                    }
                    .help("加入自選股")
                }
                Text("熱門股票：")
                HStack(spacing: 10) {
                    ForEach(hotStocks, id: \.self) { s in
                        Button(s) {
                            let formatted = autoFormatSymbol(s)
                            input = formatted
                            selected = formatted
                            showAnalysis = true
                        }
                        .buttonStyle(.bordered)
                    }
                }
                if !favorites.isEmpty {
                    Text("自選股：")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(favorites, id: \.self) { fav in
                                HStack(spacing: 2) {
                                    Button(fav) {
                                        input = fav
                                        selected = fav
                                        showAnalysis = true
                                    }
                                    .buttonStyle(.bordered)
                                    Button(action: {
                                        if let idx = favorites.firstIndex(of: fav) {
                                            favorites.remove(at: idx)
                                            UserDefaults.standard.set(favorites, forKey: "favorites")
                                        }
                                    }) {
                                        Image(systemName: "xmark.circle.fill").font(.caption2).foregroundColor(.gray)
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer()
            }
            .navigationTitle("股票分析選擇")
            .sheet(isPresented: $showAnalysis) {
                StockAnalysisView(symbol: selected)
            }
        }
    }

    // 自動補全與格式提示
    func autoFormatSymbol(_ symbol: String) -> String {
        let s = symbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if s.range(of: "^[0-9]{4}\.HK$", options: .regularExpression) != nil {
            return s // 港股
        } else if s.range(of: "^[0-9]{6}\.SS$", options: .regularExpression) != nil {
            return s // A股
        } else if s.range(of: "^[A-Z]{1,5}$", options: .regularExpression) != nil {
            return s // 美股
        } else if s.range(of: "^[0-9]{4}$", options: .regularExpression) != nil {
            return s + ".HK" // 自動補全港股
        } else if s.range(of: "^[0-9]{6}$", options: .regularExpression) != nil {
            return s + ".SS" // 自動補全A股
        }
        return s
    }

    func checkSymbolFormat(_ symbol: String) -> String {
        let s = symbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if s.isEmpty { return "" }
        if s.range(of: "^[0-9]{4}\.HK$", options: .regularExpression) != nil {
            return "偵測到港股格式"
        } else if s.range(of: "^[0-9]{6}\.SS$", options: .regularExpression) != nil {
            return "偵測到A股格式"
        } else if s.range(of: "^[A-Z]{1,5}$", options: .regularExpression) != nil {
            return "偵測到美股格式"
        } else if s.range(of: "^[0-9]{4}$", options: .regularExpression) != nil {
            return "自動補全為港股（加 .HK）"
        } else if s.range(of: "^[0-9]{6}$", options: .regularExpression) != nil {
            return "自動補全為A股（加 .SS）"
        }
        return "格式不正確，請檢查"
    }
        }
    }
}
