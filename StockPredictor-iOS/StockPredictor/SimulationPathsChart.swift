import SwiftUI

struct SimulationPathsChart: View {
    let paths: [[Double]]
    let height: CGFloat
    let colors: [Color] = [.blue, .green, .orange, .purple, .pink, .red, .teal, .indigo, .yellow, .gray]
    
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let allValues = paths.flatMap { $0 }
            let minY = allValues.min() ?? 0
            let maxY = allValues.max() ?? 1
            let scaleY = maxY - minY > 0 ? maxY - minY : 1
            ZStack {
                ForEach(Array(paths.enumerated()), id: \.(0)) { (idx, path) in
                    let color = colors[idx % colors.count].opacity(0.7)
                    Path { p in
                        for (i, v) in path.enumerated() {
                            let x = w * CGFloat(i) / CGFloat(max(path.count-1,1))
                            let y = h - (CGFloat(v-minY)/CGFloat(scaleY))*h
                            if i == 0 {
                                p.move(to: CGPoint(x: x, y: y))
                            } else {
                                p.addLine(to: CGPoint(x: x, y: y))
                            }
                        }
                    }
                    .stroke(color, lineWidth: 1.2)
                }
            }
        }
        .frame(height: height)
    }
}
