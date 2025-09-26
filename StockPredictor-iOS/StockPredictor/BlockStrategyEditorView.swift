import SwiftUI


struct Block: Identifiable, Equatable {
    let id = UUID()
    var type: BlockType
    var value: String
    var children: [Block] = []
}

enum BlockType: String, CaseIterable, Codable {
    case ifCond = "條件"
    case logic = "邏輯"
    case compare = "比較"
    case function = "函數"
    case value = "數值"
}


struct BlockStrategyEditorView: View {
    @State private var blocks: [Block] = []
    @State private var selectedType: BlockType = .ifCond
    @State private var inputValue: String = ""
    @State private var showExport = false
    @State private var exportFormula: String = ""
    @State private var selectedParent: Block.ID? = nil
    @State private var dragBlock: Block? = nil
    @State private var showSaveToCustom = false
    @State private var customName: String = ""
    @State private var showImport = false
    @State private var importFormula: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("圖形化策略編輯器 (Beta)").font(.title2).bold()
            HStack {
                Picker("區塊類型", selection: $selectedType) {
                    ForEach(BlockType.allCases, id: \ .self) { t in
                        Text(t.rawValue).tag(t)
                    }
                }.pickerStyle(.segmented)
                TextField("內容/參數", text: $inputValue).frame(width: 120)
                Button("新增區塊") {
                    if let parentId = selectedParent, let idx = blocks.firstIndex(where: { $0.id == parentId }) {
                        blocks[idx].children.append(Block(type: selectedType, value: inputValue))
                    } else {
                        blocks.append(Block(type: selectedType, value: inputValue))
                    }
                    inputValue = ""
                }.disabled(inputValue.isEmpty)
            }
            Text("點選區塊可設為父區塊，支援巢狀。拖曳可排序。")
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(blocks) { b in
                        BlockView(block: b, selected: selectedParent == b.id, onSelect: { selectedParent = b.id }, onDrag: { dragBlock = b }, onDrop: { target in moveBlock(dragBlock, to: target) })
                    }
                }
            }.frame(height: 180)
            HStack {
                Button("匯出為公式") {
                    exportFormula = blocks.map { exportBlock($0) }.joined(separator: " ")
                    showExport = true
                }.disabled(blocks.isEmpty)
                Button("儲存為自訂策略") {
                    exportFormula = blocks.map { exportBlock($0) }.joined(separator: " ")
                    showSaveToCustom = true
                }.disabled(blocks.isEmpty)
                Button("從自訂策略匯入") {
                    showImport = true
                }
            }
            if showExport {
                Text("公式：\(exportFormula)").font(.footnote).foregroundColor(.blue)
            }
            Spacer()
        }.padding()
        .sheet(isPresented: $showSaveToCustom) {
            VStack(spacing: 16) {
                Text("儲存為自訂策略").font(.headline)
                TextField("策略名稱", text: $customName).textFieldStyle(RoundedBorderTextFieldStyle())
                Text("公式：\(exportFormula)").font(.footnote).foregroundColor(.blue)
                Button("儲存") {
                    if !customName.isEmpty {
                        let s = CustomStrategy(id: UUID(), name: customName, formula: exportFormula)
                        CustomStrategyManager.shared.add(s)
                        customName = ""; showSaveToCustom = false
                    }
                }.disabled(customName.isEmpty)
                Button("取消") { showSaveToCustom = false; customName = "" }
            }.padding().frame(width: 320)
        }
        .sheet(isPresented: $showImport) {
            VStack(spacing: 16) {
                Text("從自訂策略匯入").font(.headline)
                List {
                    ForEach(CustomStrategyManager.shared.strategies) { s in
                        Button(s.name) {
                            importFormula = s.formula
                            blocks = parseFormulaToBlocks(importFormula)
                            showImport = false
                        }
                    }
                }.frame(height: 200)
                Button("取消") { showImport = false }
            }.padding().frame(width: 320)
        }

    // 公式字串簡易解析為區塊（僅支援單層與括號分割，進階可擴充）
    func parseFormulaToBlocks(_ formula: String) -> [Block] {
        var result: [Block] = []
        let tokens = formula.components(separatedBy: ") ")
        for t in tokens {
            let trimmed = t.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            if let openIdx = trimmed.firstIndex(of: "(") {
                let val = String(trimmed[..<openIdx]).trimmingCharacters(in: .whitespaces)
                let inner = String(trimmed[trimmed.index(after: openIdx)...]).trimmingCharacters(in: .whitespacesAndNewlines)
                let children = inner.split(separator: " ").map { Block(type: .value, value: String($0)) }
                result.append(Block(type: .function, value: val, children: children))
            } else {
                result.append(Block(type: .value, value: trimmed))
            }
        }
        return result
    }
    }

    func exportBlock(_ block: Block) -> String {
        if block.children.isEmpty { return block.value }
        let childrenStr = block.children.map { exportBlock($0) }.joined(separator: " ")
        return "\(block.value) (\(childrenStr))"
    }

    func moveBlock(_ block: Block?, to target: Block) {
        guard let block = block, let fromIdx = blocks.firstIndex(of: block), let toIdx = blocks.firstIndex(of: target) else { return }
        var arr = blocks
        arr.remove(at: fromIdx)
        arr.insert(block, at: toIdx)
        blocks = arr
    }
}

struct BlockView: View {
    var block: Block
    var selected: Bool
    var onSelect: () -> Void
    var onDrag: () -> Void
    var onDrop: (Block) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(block.type.rawValue).font(.caption).bold()
                Text(block.value).font(.caption2)
            }
            .padding(8)
            .background(selected ? Color.blue.opacity(0.2) : Color(.systemGray5))
            .cornerRadius(8)
            .onTapGesture { onSelect() }
            .onDrag { onDrag(); return NSItemProvider(object: NSString(string: block.value)) }
            .onDrop(of: ["public.text"], isTargeted: nil) { _ in onDrop(block); return true }
            if !block.children.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(block.children) { c in
                        BlockView(block: c, selected: false, onSelect: {}, onDrag: {}, onDrop: { _ in })
                    }
                }.padding(.leading, 16)
            }
        }
    }
}
