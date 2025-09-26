import SwiftUI

struct LineChart: View {
    let data: [Double]
    let ma: Double?
    let height: CGFloat
    let color: Color
    let maColor: Color
    
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let minY = data.min() ?? 0
            let maxY = data.max() ?? 1
            let scaleY = maxY - minY > 0 ? maxY - minY : 1
            let points = data.enumerated().map { (i, v) in
                CGPoint(x: w * CGFloat(i) / CGFloat(max(data.count-1,1)), y: h - (CGFloat(v-minY)/CGFloat(scaleY))*h)
            }
            Path { path in
                if let first = points.first {
                    path.move(to: first)
                    for p in points.dropFirst() { path.addLine(to: p) }
                }
            }
            .stroke(color, lineWidth: 2)
            if let ma = ma {
                let maY = h - (CGFloat(ma-minY)/CGFloat(scaleY))*h
                Path { path in
                    path.move(to: CGPoint(x: 0, y: maY))
                    path.addLine(to: CGPoint(x: w, y: maY))
                }
                .stroke(maColor, style: StrokeStyle(lineWidth: 1, dash: [5,3]))
            }
        }
        .frame(height: height)
    }
}
