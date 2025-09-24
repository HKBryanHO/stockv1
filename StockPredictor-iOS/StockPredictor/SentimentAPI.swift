import Foundation

struct SentimentResponse: Codable {
    let symbol: String?
    let sentiment: String?
    let score: Double?
    let details: String?
}

class SentimentAPI {
    static let shared = SentimentAPI()
    private let baseURL = "https://www.bma-hk.com"

    func fetchSentiment(symbol: String, completion: @escaping (Result<SentimentResponse, Error>) -> Void) {
        let urlStr = "\(baseURL)/api/x/sentiment?symbol=\(symbol)"
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
                let decoded = try JSONDecoder().decode(SentimentResponse.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
