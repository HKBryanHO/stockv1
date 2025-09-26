import Foundation

struct StockEvent: Identifiable, Codable {
    let id = UUID()
    let date: Date
    let type: String // "dividend", "buyback", "split", etc.
    let description: String
}

class StockEventAPI {
    static let shared = StockEventAPI()
    private let baseURL = "https://www.bma-hk.com" // TODO: replace with your backend

    func fetchEvents(symbol: String, completion: @escaping (Result<[StockEvent], Error>) -> Void) {
        let urlStr = "\(baseURL)/api/event?symbol=\(symbol)"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "InvalidURL", code: 0)))
            return
        }
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let events = try decoder.decode([StockEvent].self, from: data)
                completion(.success(events))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
