import Foundation

class MarketListManager: ObservableObject {
    static let shared = MarketListManager()
    @Published var symbols: [String] = []
    private let key = "MarketSymbols"
    
    init() {
        load()
    }
    func addSymbol(_ symbol: String) {
        let s = symbol.uppercased()
        guard !symbols.contains(s) else { return }
        symbols.append(s)
        save()
    }
    func removeSymbol(_ symbol: String) {
        symbols.removeAll { $0.uppercased() == symbol.uppercased() }
        save()
    }
    func save() {
        UserDefaults.standard.set(symbols, forKey: key)
    }
    func load() {
        if let arr = UserDefaults.standard.stringArray(forKey: key) {
            symbols = arr
        } else {
            symbols = ["AAPL", "TSLA", "0700.HK", "9988.HK"]
        }
    }
}
