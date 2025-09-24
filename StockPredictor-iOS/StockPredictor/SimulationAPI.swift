import Foundation

struct SimulationResult: Codable {
    let quantiles: [String: Double]?
    let paths: [[Double]]?
    let mean: Double?
    let lower: Double?
    let upper: Double?
}

class SimulationAPI {
    // 支援自訂模擬路徑數
    func runJumpSimulationWithPaths(closes: [Double], days: Int = 21, paths: Int = 20, retry: Int = 2, completion: @escaping (Result<SimulationResult, Error>) -> Void) {
        let urlStr = "\(baseURL)/api/sim/jump"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["closes": closes, "days": days, "paths": paths]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.runJumpSimulationWithPaths(closes: closes, days: days, paths: paths, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
                return
            }
            guard let data = data else {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.runJumpSimulationWithPaths(closes: closes, days: days, paths: paths, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(NSError(domain: "No data", code: -2)))
                }
                return
            }
            do {
                let decoded = try JSONDecoder().decode(SimulationResult.self, from: data)
                completion(.success(decoded))
            } catch {
                if retry > 0 {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.runJumpSimulationWithPaths(closes: closes, days: days, paths: paths, retry: retry-1, completion: completion)
                    }
                } else {
                    completion(.failure(error))
                }
            }
        }
        task.resume()
    }
    static let shared = SimulationAPI()
    private let baseURL = "https://www.bma-hk.com"

    func runJumpSimulation(closes: [Double], days: Int = 21, completion: @escaping (Result<SimulationResult, Error>) -> Void) {
        let urlStr = "\(baseURL)/api/sim/jump"
        guard let url = URL(string: urlStr) else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["closes": closes, "days": days]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: -2)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(SimulationResult.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
