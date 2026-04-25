import SwiftData
import SwiftUI

struct TodayReviewView: View {
    @Query(sort: \VocabEntry.word) private var entries: [VocabEntry]
    @Query(sort: \ReviewState.nextReviewDate) private var reviewStates: [ReviewState]

    private var dueEntries: [VocabEntry] {
        let today = Calendar.current.startOfDay(for: Date())
        let dueWords = Set(reviewStates.filter { $0.nextReviewDate <= today }.map(\.word))
        return entries
            .filter { dueWords.contains($0.word) }
            .sorted { lhs, rhs in
                let lhsState = state(for: lhs.word)
                let rhsState = state(for: rhs.word)
                if lhsState?.priority != rhsState?.priority {
                    return (lhsState?.priority ?? 0) > (rhsState?.priority ?? 0)
                }
                if lhsState?.totalWrong != rhsState?.totalWrong {
                    return (lhsState?.totalWrong ?? 0) > (rhsState?.totalWrong ?? 0)
                }
                return lhs.word < rhs.word
            }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(dueEntries.count)")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    Text("오늘 복습할 단어")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    NavigationLink {
                        QuizView(entries: dueEntries)
                    } label: {
                        Label("퀴즈 시작", systemImage: "play.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(dueEntries.isEmpty)
                    .padding(.top, 6)
                }
                .padding(.vertical, 8)
            }

            Section("Due Words") {
                if dueEntries.isEmpty {
                    ContentUnavailableView("복습할 단어가 없습니다", systemImage: "checkmark.circle")
                } else {
                    ForEach(dueEntries, id: \.word) { entry in
                        NavigationLink {
                            WordDetailView(entry: entry)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.word)
                                    .font(.headline)
                                Text(entry.core_meaning_ko)
                                    .foregroundStyle(.secondary)
                                if let state = state(for: entry.word) {
                                    Text("priority \(state.priority) · wrong \(state.totalWrong)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Today Review")
    }

    private func state(for word: String) -> ReviewState? {
        reviewStates.first { $0.word == word }
    }
}
