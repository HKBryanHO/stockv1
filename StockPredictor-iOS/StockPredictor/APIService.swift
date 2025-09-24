import Foundation

struct QuoteResponse: Codable {
    let symbol: String
    let price: Double
    let source: String?
}

class QuoteAPI {
    static let shared = QuoteAPI()
    private let baseURL = "https://www.bma-hk.com" // 或 http://localhost:3001
    private var memoryCache: [String: (QuoteResponse, Date)] = [:]
    private let cacheTTL: TimeInterval = 60 // 1分鐘快取

    static let apiErrorNotification = Notification.Name("APIErrorNotification")

    func fetchQuote(symbol: String, retry: Int = 2, completion: @escaping (Result<QuoteResponse, Error>) -> Void) {
        let cacheKey = symbol.uppercased()
        // 1. 先查快取
        if let (cached, ts) = memoryCache[cacheKey], Date().timeIntervalSince(ts) < cacheTTL {
            completion(.success(cached))
            return
        }
        guard let url = URL(string: "\(baseURL)/api/quote/enhanced?symbol=\(symbol)") else {
            let err = NSError(domain: "Invalid URL", code: -1)
            notifyAPIError(err)
            completion(.failure(err))
            return
        }
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchQuote(symbol: symbol, retry: retry-1, completion: completion)
                    }
                } else {
                    self.notifyAPIError(error)
                    completion(.failure(error))
                }
                return
            }
            guard let data = data else {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchQuote(symbol: symbol, retry: retry-1, completion: completion)
                    }
                } else {
                    let err = NSError(domain: "No data", code: -2)
                    self.notifyAPIError(err)
                    completion(.failure(err))
                }
                return
            }
            do {
                let quote = try JSONDecoder().decode(QuoteResponse.self, from: data)
                self.memoryCache[cacheKey] = (quote, Date())
                completion(.success(quote))
            } catch {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.fetchQuote(symbol: symbol, retry: retry-1, completion: completion)
                    }
                } else {
                    self.notifyAPIError(error)
                    completion(.failure(error))
                }
            }
        }
        task.resume()
    }

    private func notifyAPIError(_ error: Error) {
        NotificationCenter.default.post(name: QuoteAPI.apiErrorNotification, object: error)
    }
}
