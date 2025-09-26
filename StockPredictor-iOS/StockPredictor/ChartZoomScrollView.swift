import SwiftUI

struct ChartZoomScrollView<Content: View>: View {
    @State private var scale: CGFloat = 1.0
    @State private var offset: CGFloat = 0.0
    let minScale: CGFloat = 1.0
    let maxScale: CGFloat = 4.0
    let content: () -> Content
    let height: CGFloat
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            content()
                .frame(width: UIScreen.main.bounds.width * scale, height: height)
                .scaleEffect(x: scale, y: 1, anchor: .leading)
                .offset(x: offset)
                .gesture(
                    MagnificationGesture()
                        .onChanged { value in
                            let newScale = min(maxScale, max(minScale, value * scale))
                            scale = newScale
                        }
                )
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            offset = value.translation.width + offset
                        }
                        .onEnded { _ in }
                )
                .animation(.easeInOut(duration: 0.15), value: scale)
        }
        .frame(height: height)
    }
}
