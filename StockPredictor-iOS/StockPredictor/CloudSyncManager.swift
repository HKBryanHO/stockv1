import Foundation
import Combine

class CloudSyncManager: ObservableObject {
    static let shared = CloudSyncManager()
    @Published var isLoggedIn: Bool = false
    @Published var userId: String = ""
    @Published var records: [CloudBacktestRecord] = []

    // 假設API: /api/user/sync，需帶token
    func syncFavorites(_ symbols: [String], token: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "https://www.bma-hk.com/api/user/sync") else { completion(false); return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["favorites": symbols]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { data, _, _ in
            completion(data != nil)
        }.resume()
    }
    func fetchFavorites(token: String, completion: @escaping ([String]?) -> Void) {
        guard let url = URL(string: "https://www.bma-hk.com/api/user/sync") else { completion(nil); return }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let arr = dict["favorites"] as? [String] else {
                completion(nil)
                return
            }
            completion(arr)
        }.resume()
    }

    // ====== 雲端帳號與回測紀錄（本地模擬，可串接 Firebase/REST API） =====
    func login(email: String, password: String, completion: @escaping (Bool) -> Void) {
        // TODO: 串接真實雲端帳號系統
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.isLoggedIn = true
            self.userId = email
            completion(true)
        }
    }

    func saveRecord(symbols: [String], params: [String: String], results: [BatchBacktestResult], aiSummary: String, completion: @escaping (Bool) -> Void) {
        let record = CloudBacktestRecord(
            id: UUID().uuidString,
            userId: userId,
            timestamp: Date(),
            symbols: symbols,
            params: params,
            results: results,
            aiSummary: aiSummary
        )
        // TODO: 串接雲端儲存
        records.append(record)
        completion(true)
    }

    func loadRecords(completion: @escaping ([CloudBacktestRecord]) -> Void) {
        // TODO: 串接雲端讀取
        completion(records)
    }
}
