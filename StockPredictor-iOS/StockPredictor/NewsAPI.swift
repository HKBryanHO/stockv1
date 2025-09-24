import Foundation

struct NewsItem: Codable, Identifiable {
    let id = UUID()
    let title: String
    let summary: String
    let url: String
    let date: String
}

class NewsAPI {
    static let shared = NewsAPI()
    func fetchNews(symbol: String, completion: @escaping ([NewsItem]?) -> Void) {
        guard let url = URL(string: "https://www.bma-hk.com/api/news?symbol=\(symbol)") else { completion(nil); return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data,
                  let arr = try? JSONDecoder().decode([NewsItem].self, from: data) else {
                completion(nil)
                return
            }
            completion(arr)
        }.resume()
    }
}
