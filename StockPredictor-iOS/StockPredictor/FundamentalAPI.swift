import Foundation

struct FMPProfile: Codable {
    let symbol: String
    let companyName: String?
    let marketCap: Double?
    let pe: Double?
    let dividendYield: Double?
    let sector: String?
    let industry: String?
    let description: String?
    
    enum CodingKeys: String, CodingKey {
        case symbol
        case companyName
        case marketCap
        case pe = "pe"
        case dividendYield
        case sector
        case industry
        case description
    }
}

class FundamentalAPI {
    static let shared = FundamentalAPI()
    private let baseURL = "https://www.bma-hk.com"

    func fetchProfile(symbol: String, completion: @escaping (Result<FMPProfile, Error>) -> Void) {
        let urlStr = "\(baseURL)/api/fmp/profile?symbol=\(symbol)"
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
                let arr = try JSONDecoder().decode([FMPProfile].self, from: data)
                if let profile = arr.first {
                    completion(.success(profile))
                } else {
                    completion(.failure(NSError(domain: "No profile", code: -3)))
                }
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
