import SwiftUI

struct Candlestick: Identifiable {
    let id = UUID()
    let date: Date
    let open: Double
    let high: Double
    let low: Double
    let close: Double
}

struct CandlestickChart: View {
    let candles: [Candlestick]
    let height: CGFloat

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let minY = candles.map { $0.low }.min() ?? 0
            let maxY = candles.map { $0.high }.max() ?? 1
            let scaleY = maxY - minY > 0 ? maxY - minY : 1
            let candleWidth = max(w / CGFloat(max(candles.count, 20)), 4)
            HStack(alignment: .bottom, spacing: 0) {
                ForEach(candles) { candle in
                    let openY = h - CGFloat((candle.open - minY) / scaleY) * h
                    let closeY = h - CGFloat((candle.close - minY) / scaleY) * h
                    let highY = h - CGFloat((candle.high - minY) / scaleY) * h
                    let lowY = h - CGFloat((candle.low - minY) / scaleY) * h
                    VStack {
                        Rectangle()
                            .fill(candle.close >= candle.open ? Color.green : Color.red)
                            .frame(width: candleWidth, height: abs(closeY - openY) == 0 ? 1 : abs(closeY - openY))
                            .offset(y: min(openY, closeY) - highY)
                        Rectangle()
                            .fill(candle.close >= candle.open ? Color.green : Color.red)
                            .frame(width: 1, height: max(1, highY - lowY))
                            .offset(y: 0)
                    }
                    .frame(width: candleWidth, height: h, alignment: .bottom)
                }
            }
        }
        .frame(height: height)
    }
}
