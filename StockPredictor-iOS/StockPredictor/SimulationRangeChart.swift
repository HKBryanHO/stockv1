import SwiftUI

struct SimulationRangeChart: View {
    let mean: Double
    let lower: Double
    let upper: Double
    let height: CGFloat
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let minY = lower
            let maxY = upper
            let scaleY = maxY - minY > 0 ? maxY - minY : 1
            let meanY = h - (CGFloat(mean-minY)/CGFloat(scaleY))*h
            let lowerY = h - (CGFloat(lower-minY)/CGFloat(scaleY))*h
            let upperY = h - (CGFloat(upper-minY)/CGFloat(scaleY))*h
            ZStack {
                // 區間陰影
                Path { path in
                    path.move(to: CGPoint(x: 0, y: lowerY))
                    path.addLine(to: CGPoint(x: w, y: lowerY))
                    path.addLine(to: CGPoint(x: w, y: upperY))
                    path.addLine(to: CGPoint(x: 0, y: upperY))
                    path.closeSubpath()
                }
                .fill(Color.blue.opacity(0.18))
                // 均值線
                Path { path in
                    path.move(to: CGPoint(x: 0, y: meanY))
                    path.addLine(to: CGPoint(x: w, y: meanY))
                }
                .stroke(Color.orange, style: StrokeStyle(lineWidth: 2, dash: [6,3]))
            }
        }
        .frame(height: height)
    }
}
