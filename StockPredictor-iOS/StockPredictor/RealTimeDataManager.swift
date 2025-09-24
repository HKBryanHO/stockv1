import Foundation
import Combine

// 實時數據管理器
class RealTimeDataManager: ObservableObject {
    static let shared = RealTimeDataManager()
    
    // 發布的數據
    @Published var stockQuotes: [String: StockQuote] = [:]
    @Published var marketData: MarketData?
    @Published var isConnected = false
    @Published var lastUpdateTime: Date?
    
    // 訂閱的股票列表
    private var subscribedSymbols: Set<String> = []
    private var dataUpdateTimer: Timer?
    private var reconnectionTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    
    // 配置參數
    private let updateInterval: TimeInterval = 5.0 // 5秒更新一次
    private let maxRetryAttempts = 3
    private var currentRetryCount = 0
    
    private init() {
        setupDataConnection()
        startPeriodicUpdates()
    }
    
    // MARK: - 公共方法
    
    /// 訂閱股票數據
    func subscribe(to symbols: [String]) {
        subscribedSymbols.formUnion(symbols)
        fetchStockData(for: Array(subscribedSymbols))
    }
    
    /// 取消訂閱股票數據
    func unsubscribe(from symbols: [String]) {
        subscribedSymbols.subtract(symbols)
    }
    
    /// 獲取特定股票的即時報價
    func getQuote(for symbol: String) -> StockQuote? {
        return stockQuotes[symbol]
    }
    
    /// 手動刷新數據
    func refreshData() {
        fetchStockData(for: Array(subscribedSymbols))
        fetchMarketData()
    }
    
    /// 獲取股票歷史數據
    func getHistoricalData(symbol: String, period: String, completion: @escaping (Result<[HistoricalDataPoint], DataError>) -> Void) {
        // 模擬歷史數據獲取
        DispatchQueue.global(qos: .userInitiated).async {
            let historicalData = self.generateMockHistoricalData(symbol: symbol, period: period)
            
            DispatchQueue.main.async {
                completion(.success(historicalData))
            }
        }
    }
    
    // MARK: - 私有方法
    
    private func setupDataConnection() {
        isConnected = true
        currentRetryCount = 0
        
        // 這裡應該建立與數據提供商的連接
        // 例如：WebSocket 連接、API 連接等
        print("數據連接已建立")
    }
    
    private func startPeriodicUpdates() {
        dataUpdateTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { [weak self] _ in
            self?.performPeriodicUpdate()
        }
    }
    
    private func performPeriodicUpdate() {
        guard isConnected else {
            attemptReconnection()
            return
        }
        
        if !subscribedSymbols.isEmpty {
            fetchStockData(for: Array(subscribedSymbols))
        }
        
        fetchMarketData()
    }
    
    private func fetchStockData(for symbols: [String]) {
        // 模擬數據獲取
        DispatchQueue.global(qos: .background).async { [weak self] in
            var quotes: [String: StockQuote] = [:]
            
            for symbol in symbols {
                // 生成模擬數據
                let quote = self?.generateMockQuote(for: symbol) ?? StockQuote.mock(symbol: symbol)
                quotes[symbol] = quote
            }
            
            DispatchQueue.main.async {
                self?.stockQuotes.merge(quotes) { _, new in new }
                self?.lastUpdateTime = Date()
                self?.currentRetryCount = 0
            }
        }
    }
    
    private func fetchMarketData() {
        // 模擬市場數據獲取
        DispatchQueue.global(qos: .background).async { [weak self] in
            let marketData = MarketData.mock()
            
            DispatchQueue.main.async {
                self?.marketData = marketData
            }
        }
    }
    
    private func generateMockQuote(for symbol: String) -> StockQuote {
        // 基於之前的數據生成模擬變化
        let previousQuote = stockQuotes[symbol]
        let basePrice = previousQuote?.price ?? Double.random(in: 50...500)
        
        // 模擬價格變化（-2% 到 +2%）
        let changePercent = Double.random(in: -0.02...0.02)
        let newPrice = basePrice * (1 + changePercent)
        let change = newPrice - basePrice
        
        return StockQuote(
            symbol: symbol,
            price: newPrice,
            change: change,
            changePercent: changePercent * 100,
            volume: Int.random(in: 100000...10000000),
            marketCap: newPrice * Double.random(in: 1000000...10000000000),
            pe: Double.random(in: 5...50),
            dayLow: newPrice * Double.random(in: 0.95...0.99),
            dayHigh: newPrice * Double.random(in: 1.01...1.05),
            week52Low: newPrice * Double.random(in: 0.7...0.9),
            week52High: newPrice * Double.random(in: 1.1...1.5),
            lastUpdate: Date()
        )
    }
    
    private func generateMockHistoricalData(symbol: String, period: String) -> [HistoricalDataPoint] {
        let calendar = Calendar.current
        let daysBack: Int
        
        switch period {
        case "1D": daysBack = 1
        case "5D": daysBack = 5
        case "1M": daysBack = 30
        case "3M": daysBack = 90
        case "6M": daysBack = 180
        case "1Y": daysBack = 365
        case "5Y": daysBack = 365 * 5
        default: daysBack = 30
        }
        
        var data: [HistoricalDataPoint] = []
        var basePrice = Double.random(in: 50...500)
        
        for i in 0..<daysBack {
            let date = calendar.date(byAdding: .day, value: -daysBack + i, to: Date()) ?? Date()
            
            // 只在工作日生成數據
            let weekday = calendar.component(.weekday, from: date)
            guard weekday != 1 && weekday != 7 else { continue } // 跳過週末
            
            let change = Double.random(in: -0.05...0.05) // 日變化 -5% 到 +5%
            basePrice *= (1 + change)
            
            let open = basePrice
            let high = basePrice * Double.random(in: 1.0...1.03)
            let low = basePrice * Double.random(in: 0.97...1.0)
            let close = Double.random(in: low...high)
            let volume = Int.random(in: 500000...5000000)
            
            data.append(HistoricalDataPoint(
                date: date,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume
            ))
            
            basePrice = close
        }
        
        return data
    }
    
    private func attemptReconnection() {
        guard currentRetryCount < maxRetryAttempts else {
            print("達到最大重試次數，停止重連")
            return
        }
        
        currentRetryCount += 1
        isConnected = false
        
        print("嘗試第 \(currentRetryCount) 次重連...")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(currentRetryCount) * 2.0) { [weak self] in
            self?.setupDataConnection()
        }
    }
    
    deinit {
        dataUpdateTimer?.invalidate()
        reconnectionTimer?.invalidate()
    }
}

// MARK: - 數據模型

struct StockQuote: Identifiable, Codable {
    let id = UUID()
    let symbol: String
    let price: Double
    let change: Double
    let changePercent: Double
    let volume: Int
    let marketCap: Double
    let pe: Double
    let dayLow: Double
    let dayHigh: Double
    let week52Low: Double
    let week52High: Double
    let lastUpdate: Date
    
    var isPositive: Bool {
        return change >= 0
    }
    
    var formattedPrice: String {
        return String(format: "%.2f", price)
    }
    
    var formattedChange: String {
        let sign = change >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", change))"
    }
    
    var formattedChangePercent: String {
        let sign = changePercent >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", changePercent))%"
    }
    
    var formattedVolume: String {
        if volume >= 1_000_000 {
            return String(format: "%.1fM", Double(volume) / 1_000_000)
        } else if volume >= 1_000 {
            return String(format: "%.1fK", Double(volume) / 1_000)
        } else {
            return "\(volume)"
        }
    }
    
    var formattedMarketCap: String {
        if marketCap >= 1_000_000_000_000 {
            return String(format: "%.2fT", marketCap / 1_000_000_000_000)
        } else if marketCap >= 1_000_000_000 {
            return String(format: "%.2fB", marketCap / 1_000_000_000)
        } else if marketCap >= 1_000_000 {
            return String(format: "%.2fM", marketCap / 1_000_000)
        } else {
            return String(format: "%.0f", marketCap)
        }
    }
    
    static func mock(symbol: String) -> StockQuote {
        let price = Double.random(in: 50...500)
        let change = Double.random(in: -10...10)
        
        return StockQuote(
            symbol: symbol,
            price: price,
            change: change,
            changePercent: (change / price) * 100,
            volume: Int.random(in: 100000...10000000),
            marketCap: price * Double.random(in: 1000000...10000000000),
            pe: Double.random(in: 5...50),
            dayLow: price * 0.95,
            dayHigh: price * 1.05,
            week52Low: price * 0.7,
            week52High: price * 1.4,
            lastUpdate: Date()
        )
    }
}

struct MarketData: Codable {
    let sp500: IndexData
    let nasdaq: IndexData
    let dowJones: IndexData
    let vix: IndexData
    
    static func mock() -> MarketData {
        return MarketData(
            sp500: IndexData(
                name: "S&P 500",
                value: 4500 + Double.random(in: -50...50),
                change: Double.random(in: -30...30),
                changePercent: Double.random(in: -1...1)
            ),
            nasdaq: IndexData(
                name: "NASDAQ",
                value: 14000 + Double.random(in: -100...100),
                change: Double.random(in: -80...80),
                changePercent: Double.random(in: -1.5...1.5)
            ),
            dowJones: IndexData(
                name: "道瓊指數",
                value: 35000 + Double.random(in: -200...200),
                change: Double.random(in: -150...150),
                changePercent: Double.random(in: -0.8...0.8)
            ),
            vix: IndexData(
                name: "恐懼指數",
                value: 20 + Double.random(in: -5...5),
                change: Double.random(in: -2...2),
                changePercent: Double.random(in: -10...10)
            )
        )
    }
}

struct IndexData: Codable {
    let name: String
    let value: Double
    let change: Double
    let changePercent: Double
    
    var isPositive: Bool {
        return change >= 0
    }
    
    var formattedValue: String {
        return String(format: "%.2f", value)
    }
    
    var formattedChange: String {
        let sign = change >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", change))"
    }
    
    var formattedChangePercent: String {
        let sign = changePercent >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", changePercent))%"
    }
}

struct HistoricalDataPoint: Identifiable, Codable {
    let id = UUID()
    let date: Date
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Int
    
    var change: Double {
        return close - open
    }
    
    var changePercent: Double {
        return ((close - open) / open) * 100
    }
    
    var isPositive: Bool {
        return close >= open
    }
}

// MARK: - 錯誤類型
enum DataError: Error, LocalizedError {
    case networkError(String)
    case parseError(String)
    case noData
    case invalidSymbol(String)
    case rateLimitExceeded
    case serverError(Int)
    
    var errorDescription: String? {
        switch self {
        case .networkError(let message):
            return "網路錯誤: \(message)"
        case .parseError(let message):
            return "數據解析錯誤: \(message)"
        case .noData:
            return "沒有可用數據"
        case .invalidSymbol(let symbol):
            return "無效股票代號: \(symbol)"
        case .rateLimitExceeded:
            return "請求次數超限，請稍後再試"
        case .serverError(let code):
            return "服務器錯誤: \(code)"
        }
    }
}

// MARK: - 數據緩存管理器
class DataCacheManager {
    static let shared = DataCacheManager()
    
    private let cache = NSCache<NSString, NSData>()
    private let cacheDirectory: URL
    
    private init() {
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        cacheDirectory = documentsPath.appendingPathComponent("DataCache")
        
        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
    
    func cacheData<T: Codable>(_ data: T, forKey key: String, duration: TimeInterval = 300) {
        let cacheKey = NSString(string: key)
        
        do {
            let jsonData = try JSONEncoder().encode(data)
            cache.setObject(jsonData as NSData, forKey: cacheKey)
            
            // 同時存儲到磁盤
            let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
            try jsonData.write(to: fileURL)
            
            // 設置過期時間
            let expirationTime = Date().addingTimeInterval(duration)
            UserDefaults.standard.set(expirationTime, forKey: "cache_expiry_\(key)")
        } catch {
            print("緩存數據失敗: \(error)")
        }
    }
    
    func getCachedData<T: Codable>(_ type: T.Type, forKey key: String) -> T? {
        // 檢查過期時間
        if let expirationTime = UserDefaults.standard.object(forKey: "cache_expiry_\(key)") as? Date,
           expirationTime < Date() {
            removeCachedData(forKey: key)
            return nil
        }
        
        let cacheKey = NSString(string: key)
        
        // 首先嘗試從內存緩存獲取
        if let cachedData = cache.object(forKey: cacheKey) as Data? {
            do {
                return try JSONDecoder().decode(type, from: cachedData)
            } catch {
                print("從內存緩存解析數據失敗: \(error)")
            }
        }
        
        // 然後嘗試從磁盤獲取
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
        do {
            let data = try Data(contentsOf: fileURL)
            let result = try JSONDecoder().decode(type, from: data)
            
            // 重新加載到內存緩存
            cache.setObject(data as NSData, forKey: cacheKey)
            
            return result
        } catch {
            print("從磁盤緩存解析數據失敗: \(error)")
            return nil
        }
    }
    
    func removeCachedData(forKey key: String) {
        let cacheKey = NSString(string: key)
        cache.removeObject(forKey: cacheKey)
        
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
        try? FileManager.default.removeItem(at: fileURL)
        
        UserDefaults.standard.removeObject(forKey: "cache_expiry_\(key)")
    }
    
    func clearAllCache() {
        cache.removeAllObjects()
        
        do {
            let contents = try FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for fileURL in contents {
                try FileManager.default.removeItem(at: fileURL)
            }
        } catch {
            print("清除磁盤緩存失敗: \(error)")
        }
        
        // 清除過期時間記錄
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys {
            if key.hasPrefix("cache_expiry_") {
                defaults.removeObject(forKey: key)
            }
        }
    }
}