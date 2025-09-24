import SwiftUI

struct MultiStockCompareView: View {
    @State private var symbols: [String] = ["AAPL", "TSLA"]
    @State private var closesDict: [String: [Double]] = [:]
    @State private var loading: Bool = false
    @State private var error: String?
    @State private var newSymbol: String = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                TextField("新增股票代號", text: $newSymbol)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 120)
                Button("加入") {
                    let s = newSymbol.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !s.isEmpty, !symbols.contains(s) else { return }
                    symbols.append(s)
                    fetchCloses(for: s)
                    newSymbol = ""
                }.buttonStyle(.bordered)
            }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(symbols, id: \.self) { s in
                        HStack(spacing: 4) {
                            Text(s).bold()
                            Button(action: { symbols.removeAll { $0 == s }; closesDict[s] = nil }) {
                                Image(systemName: "xmark.circle.fill").foregroundColor(.red)
                            }
                        }
                    }
                }
            }
            if loading {
                ProgressView("載入中...")
            } else if let error = error {
                Text("錯誤：\(error)").foregroundColor(.red)
            } else {
                ChartZoomScrollView(height: 180) {
                    MultiLineChart(dataDict: closesDict, height: 180)
                }
            }
        }
        .padding()
        .onAppear {
            for s in symbols { fetchCloses(for: s) }
        }
    }
    func fetchCloses(for symbol: String) {
        loading = true
        error = nil
        TechnicalAPI.shared.fetchHistory(symbol: symbol) { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let arr):
                    closesDict[symbol] = arr
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }
}

struct MultiLineChart: View {
    let dataDict: [String: [Double]]
    let height: CGFloat
    let colors: [Color] = [.blue, .red, .green, .orange, .purple, .pink, .teal, .indigo, .yellow, .gray]
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let allValues = dataDict.values.flatMap { $0 }
            let minY = allValues.min() ?? 0
            let maxY = allValues.max() ?? 1
            let scaleY = maxY - minY > 0 ? maxY - minY : 1
            ZStack {
                ForEach(Array(dataDict.keys.enumerated()), id: \.1) { (idx, key) in
                    if let arr = dataDict[key], arr.count > 1 {
                        let points = arr.enumerated().map { (i, v) in
                            CGPoint(x: w * CGFloat(i) / CGFloat(max(arr.count-1,1)), y: h - (CGFloat(v-minY)/CGFloat(scaleY))*h)
                        }
                        Path { path in
                            if let first = points.first {
                                path.move(to: first)
                                for p in points.dropFirst() { path.addLine(to: p) }
                            }
                        }
                        .stroke(colors[idx % colors.count], lineWidth: 2)
                    }
                }
            }
        }
        .frame(height: height)
    }
}
