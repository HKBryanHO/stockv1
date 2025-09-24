import Foundation

struct CloudBacktestRecord: Codable, Identifiable {
    let id: String
    let userId: String
    let timestamp: Date
    let symbols: [String]
    let params: [String: String] // e.g. ["maFast": "5", ...]
    let results: [BatchBacktestResult]
    let aiSummary: String
}
