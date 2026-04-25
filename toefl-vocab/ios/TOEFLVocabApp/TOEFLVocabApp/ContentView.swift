import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var importError: String?

    var body: some View {
        TabView {
            NavigationStack {
                TodayReviewView()
            }
            .tabItem {
                Label("Today", systemImage: "calendar")
            }

            NavigationStack {
                WrongAnswersView()
            }
            .tabItem {
                Label("Wrong", systemImage: "exclamationmark.triangle")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
        }
        .task {
            do {
                _ = try SeedImporter.importIfNeeded(modelContext: modelContext)
            } catch {
                importError = error.localizedDescription
            }
        }
        .alert("Seed Import Failed", isPresented: Binding(get: {
            importError != nil
        }, set: { newValue in
            if !newValue {
                importError = nil
            }
        })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(importError ?? "")
        }
    }
}

#Preview {
    ContentView()
}
