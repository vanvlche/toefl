import SwiftData
import SwiftUI

@main
struct TOEFLVocabApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            VocabEntry.self,
            ReviewState.self,
            QuizAttempt.self,
            ConfusionPair.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Could not create SwiftData container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}
