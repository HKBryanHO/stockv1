import SwiftUI

struct SplashScreenView: View {
    var body: some View {
        ZStack {
            Color("BrandPrimary").edgesIgnoringSafeArea(.all)
            VStack {
                Image("SplashLogo")
                    .resizable()
                    .frame(width: 120, height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .shadow(radius: 8)
                Text("Stock Predictor")
                    .font(.largeTitle).bold()
                    .foregroundColor(.white)
                Text("專業量化分析平台")
                    .font(.headline)
                    .foregroundColor(.white.opacity(0.8))
            }
        }
    }
}
