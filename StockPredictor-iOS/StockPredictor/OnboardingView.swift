import SwiftUI

struct OnboardingView: View {
    @State private var currentPage = 0

    var body: some View {
        TabView(selection: $currentPage) {
            ForEach(0..<onboardingSteps.count, id: \ .self) { index in
                VStack {
                    Image(onboardingSteps[index].imageName)
                        .resizable()
                        .scaledToFit()
                        .frame(height: 200)

                    Text(onboardingSteps[index].title)
                        .font(.title)
                        .padding()

                    Text(onboardingSteps[index].description)
                        .font(.body)
                        .multilineTextAlignment(.center)
                        .padding()
                }
                .tag(index)
            }
        }
        .tabViewStyle(PageTabViewStyle())
        .indexViewStyle(PageIndexViewStyle(backgroundDisplayMode: .always))
        .padding()
        .navigationBarItems(trailing: Button(action: {
            if currentPage < onboardingSteps.count - 1 {
                currentPage += 1
            } else {
                // Navigate to main app
            }
        }) {
            Text(currentPage == onboardingSteps.count - 1 ? "Get Started" : "Next")
        })
    }
}

struct OnboardingStep {
    let imageName: String
    let title: String
    let description: String
}

let onboardingSteps = [
    OnboardingStep(imageName: "step1", title: "Welcome to StockPredictor", description: "Learn how to create and backtest strategies easily."),
    OnboardingStep(imageName: "step2", title: "AI-Powered Insights", description: "Get AI-powered suggestions for better strategies."),
    OnboardingStep(imageName: "step3", title: "Real-Time Data", description: "Monitor your strategies with real-time market data.")
]

struct OnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        OnboardingView()
    }
}