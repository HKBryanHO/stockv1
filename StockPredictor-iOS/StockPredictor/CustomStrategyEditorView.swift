import SwiftUI

struct CustomStrategy: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var formula: String
}

class CustomStrategyManager: ObservableObject {
    static let shared = CustomStrategyManager()
    @Published var strategies: [CustomStrategy] = []
    
    func add(_ strategy: CustomStrategy) {
        strategies.append(strategy)
    }
    func remove(_ strategy: CustomStrategy) {
        strategies.removeAll { $0.id == strategy.id }
    }
    func update(_ strategy: CustomStrategy) {
        if let idx = strategies.firstIndex(where: { $0.id == strategy.id }) {
            strategies[idx] = strategy
        }
    }
}

struct CustomStrategyEditorView: View {
    @ObservedObject var manager = CustomStrategyManager.shared
    @State private var name: String = ""
    @State private var formula: String = ""
    @State private var editing: CustomStrategy? = nil
    @State private var showAIHint = false
    @State private var showTemplateMenu = false
    @State private var aiTip: String = ""
    @State private var formulaError: String = ""
    @ObservedObject var cloudSync = CustomStrategyCloudSync.shared
    @ObservedObject var userAuth = StrategyUserAuth.shared
    @State private var isSyncing = false
    @State private var syncMessage: String = ""
    @State private var showLogin = false
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("自訂策略編輯器").font(.title2).bold()
                Spacer()
                if userAuth.isLoggedIn {
                    Text("\(userAuth.userId.prefix(8))...").font(.caption).foregroundColor(.gray)
                    Button("登出") { userAuth.logout() }
                } else {
                    Button("登入iCloud") { showLogin = true }
                }
                Button(action: {
                    guard userAuth.isLoggedIn else { syncMessage = "請先登入iCloud"; return }
                    isSyncing = true; syncMessage = ""
                    cloudSync.save(strategies: manager.strategies) { res in
                        isSyncing = false
                        switch res {
                        case .success: syncMessage = "☁️ 已同步至雲端"
                        case .failure(let e): syncMessage = "同步失敗: \(e.localizedDescription)"
                        }
                    }
                }) {
                    HStack { if isSyncing { ProgressView() } Text("雲端備份") }
                }.disabled(isSyncing)
                Button(action: {
                    guard userAuth.isLoggedIn else { syncMessage = "請先登入iCloud"; return }
                    isSyncing = true; syncMessage = ""
                    cloudSync.load { res in
                        isSyncing = false
                        switch res {
                        case .success(let arr): manager.strategies = arr; syncMessage = "☁️ 已從雲端載入"
                        case .failure(let e): syncMessage = "載入失敗: \(e.localizedDescription)"
                        }
                    }
                }) {
                    HStack { if isSyncing { ProgressView() } Text("雲端還原") }
                }.disabled(isSyncing)
            }
            if !syncMessage.isEmpty {
                Text(syncMessage).font(.caption).foregroundColor(syncMessage.contains("失敗") || syncMessage.contains("請先登入") ? .red : .blue)
            }
        }
        .sheet(isPresented: $showLogin) {
            VStack(spacing: 16) {
                Text("iCloud 登入").font(.headline)
                Text("請確認已開啟iCloud並允許本App使用CloudKit。").font(.caption)
                Button("登入") {
                    userAuth.login { ok in showLogin = false }
                }.buttonStyle(.borderedProminent)
                Button("取消") { showLogin = false }
            }.padding().frame(width: 300)
        }
            TextField("策略名稱", text: $name).textFieldStyle(RoundedBorderTextFieldStyle())
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    TextEditor(text: $formula)
                        .frame(height: 80)
                        .border(formulaError.isEmpty ? Color.gray : Color.red)
                        .onChange(of: formula) { newVal in
                            aiTip = StrategyAISuggester.aiTip(for: newVal)
                            formulaError = validateFormula(newVal)
                        }
                    if !aiTip.isEmpty {
                        Text(aiTip).font(.caption).foregroundColor(.blue)
                    }
                    if !formulaError.isEmpty {
                        Text(formulaError).font(.caption).foregroundColor(.red)
                    }
                }
                Menu {
                    ForEach(StrategyAISuggester.templates, id: \ .self) { t in
                        Button(t) { formula = t; aiTip = StrategyAISuggester.aiTip(for: t); formulaError = validateFormula(t) }
                    }
                } label: {
                    Image(systemName: "lightbulb").padding(6)
                }
            }
            HStack {
                Button(editing == nil ? "新增策略" : "更新策略") {
                    let s = CustomStrategy(id: editing?.id ?? UUID(), name: name, formula: formula)
                    if editing == nil { manager.add(s) } else { manager.update(s) }
                    name = ""; formula = ""; editing = nil; aiTip = ""; formulaError = ""
                }.disabled(name.isEmpty || formula.isEmpty || !formulaError.isEmpty)
                if editing != nil {
                    Button("取消編輯") { name = ""; formula = ""; editing = nil; aiTip = ""; formulaError = "" }
                }
                Button("AI 範例/提示") { showAIHint = true }
            }
            Divider()
            Text("已儲存策略").font(.headline)
            List {
                ForEach(manager.strategies) { s in
                    VStack(alignment: .leading) {
                        Text(s.name).bold()
                        Text(s.formula).font(.caption).foregroundColor(.secondary)
                    }.onTapGesture {
                        name = s.name; formula = s.formula; editing = s; aiTip = StrategyAISuggester.aiTip(for: s.formula)
                    }
                }.onDelete { idx in manager.strategies.remove(atOffsets: idx) }
            }.frame(height: 180)
        }
        .padding()
        .sheet(isPresented: $showAIHint) {
            VStack(alignment: .leading, spacing: 8) {
                Text("AI 策略範例/提示").font(.headline)
                ForEach(StrategyAISuggester.templates, id: \ .self) { t in
                    Text(t).font(.caption)
                }
                Divider()
                Text("可用函數: " + StrategyAISuggester.functions.joined(separator: ", "))
                Button("關閉") { showAIHint = false }
            }.padding().frame(width: 350)
        }
    }
    // 基本公式驗證：括號配對、允許函數/欄位
    func validateFormula(_ formula: String) -> String {
        var stack: [Character] = []
        for c in formula {
            if c == "(" { stack.append(c) }
            if c == ")" {
                if stack.isEmpty { return "括號不匹配" }
                stack.removeLast()
            }
        }
        if !stack.isEmpty { return "括號不匹配" }
        // 允許的函數/欄位
        let allowed = ["MA", "RSI", "MACD", "open", "close", "high", "low", "volume", ">", "<", ">=", "<=", "==", "!=", "+", "-", "*", "/", "and", "or", "not", "[", "]", " "]
        let tokens = formula.replacingOccurrences(of: "(", with: " ").replacingOccurrences(of: ")", with: " ").components(separatedBy: .whitespaces)
        for t in tokens where !t.isEmpty {
            if t.rangeOfCharacter(from: CharacterSet.decimalDigits) != nil { continue }
            if allowed.contains(where: { t.uppercased().hasPrefix($0) }) { continue }
        }
        return ""
    }
}
