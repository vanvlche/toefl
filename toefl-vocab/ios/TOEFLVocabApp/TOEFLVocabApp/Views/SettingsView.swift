import SwiftData
import SwiftUI

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [VocabEntry]
    @Query private var reviewStates: [ReviewState]
    @Query private var attempts: [QuizAttempt]
    @State private var importMessage: String?

    var body: some View {
        List {
            Section("Library") {
                LabeledContent("Words", value: "\(entries.count)")
                LabeledContent("Review States", value: "\(reviewStates.count)")
                LabeledContent("Attempts", value: "\(attempts.count)")
            }

            Section("Seed") {
                Button {
                    importSeed()
                } label: {
                    Label("Seed Import 확인", systemImage: "square.and.arrow.down")
                }

                if let importMessage {
                    Text(importMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Grading") {
                Text("현재 버전은 로컬 rule-based grading만 사용합니다.")
                Text("OpenAI API 호출은 Phase 1에 포함하지 않았습니다.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Settings")
    }

    private func importSeed() {
        do {
            let summary = try SeedImporter.importIfNeeded(modelContext: modelContext)
            if summary.skipped {
                importMessage = "이미 seed가 import되어 건너뛰었습니다."
            } else {
                importMessage = "단어 \(summary.wordsImported)개, 복습 상태 \(summary.reviewStatesImported)개를 import했습니다."
            }
        } catch {
            importMessage = error.localizedDescription
        }
    }
}
