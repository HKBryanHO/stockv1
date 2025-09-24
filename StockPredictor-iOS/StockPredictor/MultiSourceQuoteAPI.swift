import Foundation

struct QuoteAPIProvider {
    let name: String
    let urlBuilder: (String) -> URL?
    let parse: (Data) throws -> QuoteResponse
}

class MultiSourceQuoteAPI {
    static let shared = MultiSourceQuoteAPI()
    private let providers: [QuoteAPIProvider]
    private var memoryCache: [String: (QuoteResponse, Date)] = [:]
    private let cacheTTL: TimeInterval = 3600 // 1小時

    init() {
        providers = [
            QuoteAPIProvider(
                name: "Yahoo",
                urlBuilder: { symbol in
                    URL(string: "https://www.bma-hk.com/api/quote/enhanced?symbol=\(symbol)")
                },
                parse: { data in try JSONDecoder().decode(QuoteResponse.self, from: data) }
            ),
            QuoteAPIProvider(
                name: "Finnhub",
                urlBuilder: { symbol in
                    URL(string: "https://finnhub.io/api/v1/quote?symbol=\(symbol)&token=YOUR_API_KEY")
                },
                parse: { data in
                    let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                    guard let c = obj?["c"] as? Double else { throw NSError(domain: "FinnhubParse", code: 0) }
                    return QuoteResponse(symbol: obj?["symbol"] as? String ?? "", price: c, source: "Finnhub")
                }
            ),
            QuoteAPIProvider(
                name: "Polygon",
                urlBuilder: { symbol in
                    URL(string: "https://api.polygon.io/v2/last/trade/\(symbol)?apiKey=YOUR_API_KEY")
                },
                parse: { data in
                    let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                    let price = ((obj?["results"] as? [String: Any])?["p"] as? Double) ?? 0
                    return QuoteResponse(symbol: obj?["symbol"] as? String ?? "", price: price, source: "Polygon")
                }
            ),
            QuoteAPIProvider(
                name: "FMP",
                urlBuilder: { symbol in
                    URL(string: "https://financialmodelingprep.com/api/v3/quote/\(symbol)?apikey=YOUR_API_KEY")
                },
                parse: { data in
                    let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
                    guard let obj = arr?.first, let price = obj["price"] as? Double else { throw NSError(domain: "FMPParse", code: 0) }
                    return QuoteResponse(symbol: obj["symbol"] as? String ?? "", price: price, source: "FMP")
                }
            )
        ]
    }

    func fetchQuote(symbol: String, completion: @escaping (Result<QuoteResponse, Error>) -> Void) {
        let cacheKey = symbol.uppercased()
        if let (cached, ts) = memoryCache[cacheKey], Date().timeIntervalSince(ts) < cacheTTL {
            completion(.success(cached))
            return
        }
        fetchFromProviders(symbol: symbol, index: 0, completion: completion)
    }

    private func fetchFromProviders(symbol: String, index: Int, completion: @escaping (Result<QuoteResponse, Error>) -> Void) {
        guard index < providers.count else {
            completion(.failure(NSError(domain: "AllProvidersFailed", code: 0)))
            return
        }
        let provider = providers[index]
        guard let url = provider.urlBuilder(symbol) else {
            fetchFromProviders(symbol: symbol, index: index+1, completion: completion)
            return
        }
        let task = URLSession.shared.dataTask(with: url) { data, _, error in
            if let error = error {
                self.fetchFromProviders(symbol: symbol, index: index+1, completion: completion)
                return
            }
            guard let data = data else {
                self.fetchFromProviders(symbol: symbol, index: index+1, completion: completion)
                return
            }
            do {
                let quote = try provider.parse(data)
                self.memoryCache[symbol.uppercased()] = (quote, Date())
                completion(.success(quote))
            } catch {
                self.fetchFromProviders(symbol: symbol, index: index+1, completion: completion)
            }
        }
        task.resume()
    }
}
