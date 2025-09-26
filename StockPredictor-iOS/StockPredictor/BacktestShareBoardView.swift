import SwiftUI

struct BacktestShareBoardView: View {
    @ObservedObject var shareManager = BacktestShareManager.shared
    @ObservedObject var userAuth = StrategyUserAuth.shared
    @State private var commentText: String = ""
    @State private var selectedBacktest: SharedBacktest? = nil
    @State private var showImport = false
    @State private var importName: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("回測績效排行榜/社群").font(.largeTitle).bold()
            Button("重新整理") { fetchAll() }
            List(shareManager.sharedBacktests) { b in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(b.strategyName).font(.headline)
                        Spacer()
                        Text("by \(b.userId.prefix(8))...").font(.caption).foregroundColor(.gray)
                        Text(b.created, style: .date).font(.caption2)
                    }
                    Text(b.formula).font(.caption).foregroundColor(.secondary)
                    HStack(spacing: 12) {
                        Text("CAGR: \(String(format: "%.2f%%", b.cagr*100))  Sharpe: \(String(format: "%.2f", b.sharpe))  MDD: \(String(format: "%.2f%%", b.mdd*100))  勝率: \(String(format: "%.1f%%", b.winRate*100))")
                    }
                    if !b.aiSummary.isEmpty {
                        Text("AI摘要：\(b.aiSummary)").font(.caption2).foregroundColor(.blue)
                    }
                    HStack(spacing: 16) {
                        Button("👍 \(b.likes)") { like(b) }
                        Button("留言") { selectedBacktest = b }
                        Button("匯入策略") { importName = b.strategyName; showImport = true; selectedBacktest = b }
                    }
                    if !b.comments.isEmpty {
                        Text("留言：").font(.caption2)
                        ForEach(b.comments, id: \ .self) { c in Text(c).font(.caption2) }
                    }
                }.padding(6)
            }
            .listStyle(.plain)
            .frame(height: 400)
            if let b = selectedBacktest {
                VStack(alignment: .leading, spacing: 8) {
                    Text("留言給 \(b.strategyName)").font(.headline)
                    TextField("留言內容", text: $commentText)
                    Button("送出") {
                        comment(b, text: commentText)
                        commentText = ""
                        selectedBacktest = nil
                    }.disabled(commentText.isEmpty)
                    Button("取消") { selectedBacktest = nil; commentText = "" }
                }.padding().background(Color(.systemGray6)).cornerRadius(8)
            }
        }
        .padding()
        .onAppear(perform: fetchAll)
        .sheet(isPresented: $showImport) {
            VStack(spacing: 16) {
                Text("匯入策略：\(importName)").font(.headline)
                Button("儲存為自訂策略") {
                    if let b = selectedBacktest {
                        let cs = CustomStrategy(id: UUID(), name: b.strategyName, formula: b.formula)
                        CustomStrategyManager.shared.add(cs)
                        showImport = false
                    }
                }
                Button("取消") { showImport = false }
            }.padding().frame(width: 320)
        }
    }

    func fetchAll() {
        shareManager.fetchAll { res in
            if case .success(let arr) = res { shareManager.sharedBacktests = arr }
        }
    }
    func like(_ b: SharedBacktest) {
        shareManager.like(backtestId: b.id) { _ in fetchAll() }
    }
    func comment(_ b: SharedBacktest, text: String) {
        shareManager.comment(backtestId: b.id, text: text) { _ in fetchAll() }
    }
}
