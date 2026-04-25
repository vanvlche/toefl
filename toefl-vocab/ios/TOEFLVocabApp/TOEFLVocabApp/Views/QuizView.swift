import SwiftData
import SwiftUI

struct QuizView: View {
    @Environment(\.modelContext) private var modelContext
    let entries: [VocabEntry]

    @State private var currentIndex = 0
    @State private var answer = ""
    @State private var latestResult: GradingResult?
    @State private var saveError: String?

    private var currentEntry: VocabEntry? {
        guard entries.indices.contains(currentIndex) else { return nil }
        return entries[currentIndex]
    }

    var body: some View {
        Group {
            if entries.isEmpty {
                ContentUnavailableView("퀴즈 항목이 없습니다", systemImage: "tray")
            } else if let result = latestResult, let entry = currentEntry {
                GradingResultView(result: result, entry: entry) {
                    moveToNextCard()
                }
            } else if let entry = currentEntry {
                Form {
                    Section {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("\(currentIndex + 1) / \(entries.count)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(entry.word)
                                .font(.largeTitle.bold())
                            Text(entry.pos)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)
                    }

                    Section("답안") {
                        TextField("한국어 뜻 입력", text: $answer, axis: .vertical)
                            .lineLimit(3, reservesSpace: true)
                    }

                    if !entry.example_en.isEmpty {
                        Section("Example") {
                            Text(entry.example_en)
                            if !entry.example_ko.isEmpty {
                                Text(entry.example_ko)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section {
                        Button {
                            submit(entry)
                        } label: {
                            Label("채점", systemImage: "checkmark.circle")
                        }
                        .disabled(saveError != nil)
                    }
                }
            } else {
                ContentUnavailableView("퀴즈 완료", systemImage: "checkmark.seal")
            }
        }
        .navigationTitle("Quiz")
        .alert("저장 실패", isPresented: Binding(get: {
            saveError != nil
        }, set: { newValue in
            if !newValue {
                saveError = nil
            }
        })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(saveError ?? "")
        }
    }

    private func submit(_ entry: VocabEntry) {
        let result = LocalGrader.grade(answer: answer, for: entry)

        do {
            let state = try reviewState(for: entry.word)
            ReviewScheduler.apply(result: result, to: state)
            modelContext.insert(QuizAttempt(result: result))
            try modelContext.save()
            latestResult = result
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func reviewState(for word: String) throws -> ReviewState {
        var descriptor = FetchDescriptor<ReviewState>(predicate: #Predicate { $0.word == word })
        descriptor.fetchLimit = 1

        if let state = try modelContext.fetch(descriptor).first {
            return state
        }

        let state = ReviewState(word: word)
        modelContext.insert(state)
        return state
    }

    private func moveToNextCard() {
        answer = ""
        latestResult = nil
        currentIndex += 1
    }
}
