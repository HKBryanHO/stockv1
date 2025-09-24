import Foundation

struct PriceAlert: Codable, Identifiable, Equatable {
    let id: UUID
    let symbol: String
    let target: Double
    let above: Bool
}

class PriceAlertManager: ObservableObject {
    static let shared = PriceAlertManager()
    @Published var alerts: [PriceAlert] = []
    private let key = "PriceAlerts"
    
    init() {
        load()
    }
    
    func addAlert(symbol: String, target: Double, above: Bool) {
        let alert = PriceAlert(id: UUID(), symbol: symbol, target: target, above: above)
        alerts.append(alert)
        save()
    }
    func removeAlert(_ alert: PriceAlert) {
        alerts.removeAll { $0.id == alert.id }
        save()
    }
    func save() {
        if let data = try? JSONEncoder().encode(alerts) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
    func load() {
        if let data = UserDefaults.standard.data(forKey: key),
           let arr = try? JSONDecoder().decode([PriceAlert].self, from: data) {
            alerts = arr
        }
    }
}
