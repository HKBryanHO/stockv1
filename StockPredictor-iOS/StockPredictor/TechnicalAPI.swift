import Foundation

struct YahooChartResponse: Codable {
    struct Chart: Codable {
        struct Result: Codable {
            struct Meta: Codable {
                let symbol: String
            }
            let meta: Meta
            let timestamp: [Int]?
            struct Indicators: Codable {
                struct Quote: Codable {
                    let close: [Double]?
                }
                let quote: [Quote]?
            }
            let indicators: Indicators
        }
        let result: [Result]?
    }
    let chart: Chart
}

class TechnicalAPI {
    static let shared = TechnicalAPI()
    private let baseURL = "https://www.bma-hk.com"

    func fetchHistory(symbol: String, range: String = "6mo", interval: String = "1d", retry: Int = 2, completion: @escaping (Result<[Double], Error>) -> Void) {
        let urlStr = "\(baseURL)/api/yahoo/chart?symbol=\(symbol)&range=\(range)&interval=\(interval)"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchHistory(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
                return
            }
            guard let data = data else {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchHistory(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(NSError(domain: "No data", code: -2)))
                }
                return
            }
            do {
                let decoded = try JSONDecoder().decode(YahooChartResponse.self, from: data)
                let closes = decoded.chart.result?.first?.indicators.quote?.first?.close?.compactMap { $0 } ?? []
                completion(.success(closes))
            } catch {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchHistory(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
            }
        }
        task.resume()
    }

    // 取得K線資料（open, high, low, close）
    func fetchCandles(symbol: String, range: String = "6mo", interval: String = "1d", retry: Int = 2, completion: @escaping (Result<[Candlestick], Error>) -> Void) {
        let urlStr = "\(baseURL)/api/yahoo/chart?symbol=\(symbol)&range=\(range)&interval=\(interval)"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchCandles(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
                return
            }
            guard let data = data else {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchCandles(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(NSError(domain: "No data", code: -2)))
                }
                return
            }
            do {
                let decoded = try JSONDecoder().decode(YahooChartResponse.self, from: data)
                guard let result = decoded.chart.result?.first,
                      let timestamps = result.timestamp,
                      let quote = result.indicators.quote?.first,
                      let opens = quote.open,
                      let highs = quote.high,
                      let lows = quote.low,
                      let closes = quote.close else {
                    completion(.failure(NSError(domain: "Missing candle data", code: -3)))
                    return
                }
                var candles: [Candlestick] = []
                for i in 0..<min(timestamps.count, opens.count, highs.count, lows.count, closes.count) {
                    if let o = opens[i], let h = highs[i], let l = lows[i], let c = closes[i] {
                        let date = Date(timeIntervalSince1970: TimeInterval(timestamps[i]))
                        candles.append(Candlestick(date: date, open: o, high: h, low: l, close: c))
                    }
                }
                completion(.success(candles))
            } catch {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchCandles(symbol: symbol, range: range, interval: interval, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
            }
        }
        task.resume()
    }

    // 取得K線資料（open, high, low, close）
    func fetchCandles(symbol: String, range: String = "6mo", interval: String = "1d", completion: @escaping (Result<[Candlestick], Error>) -> Void) {
        let urlStr = "\(baseURL)/api/yahoo/chart?symbol=\(symbol)&range=\(range)&interval=\(interval)"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: -2)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(YahooChartResponse.self, from: data)
                guard let result = decoded.chart.result?.first,
                      let timestamps = result.timestamp,
                      let quote = result.indicators.quote?.first,
                      let opens = quote.open,
                      let highs = quote.high,
                      let lows = quote.low,
                      let closes = quote.close else {
                    completion(.failure(NSError(domain: "Missing candle data", code: -3)))
                    return
                }
                var candles: [Candlestick] = []
                for i in 0..<min(timestamps.count, opens.count, highs.count, lows.count, closes.count) {
                    if let o = opens[i], let h = highs[i], let l = lows[i], let c = closes[i] {
                        let date = Date(timeIntervalSince1970: TimeInterval(timestamps[i]))
                        candles.append(Candlestick(date: date, open: o, high: h, low: l, close: c))
                    }
                }
                completion(.success(candles))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }

    // 計算 MA
    func movingAverage(_ data: [Double], period: Int) -> Double? {
        guard data.count >= period else { return nil }
        let slice = data.suffix(period)
        return slice.reduce(0, +) / Double(period)
    }
    // 計算 RSI
    func rsi(_ data: [Double], period: Int = 14) -> Double? {
        guard data.count > period else { return nil }
        var gains = 0.0, losses = 0.0
        for i in (data.count - period)..<data.count-1 {
            let diff = data[i+1] - data[i]
            if diff > 0 { gains += diff } else { losses -= diff }
        }
        let avgGain = gains / Double(period)
        let avgLoss = losses / Double(period)
        guard avgLoss != 0 else { return 100 }
        let rs = avgGain / avgLoss
        return 100 - (100 / (1 + rs))
    }
}
