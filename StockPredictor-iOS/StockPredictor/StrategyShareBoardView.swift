import SwiftUI

struct StrategyShareBoardView: View {
    @ObservedObject var shareManager = StrategyShareManager.shared
    @ObservedObject var userAuth = StrategyUserAuth.shared
    @State private var commentText: String = ""
    @State private var selectedStrategy: SharedStrategy? = nil
    @State private var showImport = false
    @State private var importName: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("策略排行榜/社群").font(.largeTitle).bold()
            Button("重新整理") { fetchAll() }
            List(shareManager.sharedStrategies) { s in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(s.name).font(.headline)
                        Spacer()
                        Text("by \(s.userId.prefix(8))...").font(.caption).foregroundColor(.gray)
                        Text(s.created, style: .date).font(.caption2)
                    }
                    Text(s.formula).font(.caption).foregroundColor(.secondary)
                    HStack(spacing: 16) {
                        Button("👍 \(s.likes)") { like(s) }
                        Button("留言") { selectedStrategy = s }
                        Button("匯入") { importName = s.name; showImport = true; selectedStrategy = s }
                    }
                    if !s.comments.isEmpty {
                        Text("留言：").font(.caption2)
                        ForEach(s.comments, id: \ .self) { c in Text(c).font(.caption2) }
                    }
                }.padding(6)
            }
            .listStyle(.plain)
            .frame(height: 400)
            if let s = selectedStrategy {
                VStack(alignment: .leading, spacing: 8) {
                    Text("留言給 \(s.name)").font(.headline)
                    TextField("留言內容", text: $commentText)
                    Button("送出") {
                        comment(s, text: commentText)
                        commentText = ""
                        selectedStrategy = nil
                    }.disabled(commentText.isEmpty)
                    Button("取消") { selectedStrategy = nil; commentText = "" }
                }.padding().background(Color(.systemGray6)).cornerRadius(8)
            }
        }
        .padding()
        .onAppear(perform: fetchAll)
        .sheet(isPresented: $showImport) {
            VStack(spacing: 16) {
                Text("匯入策略：\(importName)").font(.headline)
                Button("儲存為自訂策略") {
                    if let s = selectedStrategy {
                        let cs = CustomStrategy(id: UUID(), name: s.name, formula: s.formula)
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
            if case .success(let arr) = res { shareManager.sharedStrategies = arr }
        }
    }
    func like(_ s: SharedStrategy) {
        shareManager.like(strategyId: s.id) { _ in fetchAll() }
    }
    func comment(_ s: SharedStrategy, text: String) {
        shareManager.comment(strategyId: s.id, text: text) { _ in fetchAll() }
    }
}
