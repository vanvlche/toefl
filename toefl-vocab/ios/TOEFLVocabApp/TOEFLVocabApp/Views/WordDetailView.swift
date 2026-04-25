import SwiftData
import SwiftUI

struct WordDetailView: View {
    let entry: VocabEntry

    @Query(sort: \ReviewState.word) private var reviewStates: [ReviewState]
    @Query(sort: \QuizAttempt.timestamp, order: .reverse) private var attempts: [QuizAttempt]

    private var state: ReviewState? {
        reviewStates.first { $0.word == entry.word }
    }

    private var wordAttempts: [QuizAttempt] {
        attempts.filter { $0.word == entry.word }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.word)
                        .font(.largeTitle.bold())
                    Text(entry.pos)
                        .foregroundStyle(.secondary)
                    Text(entry.core_meaning_ko)
                        .font(.title3.weight(.semibold))
                }
                .padding(.vertical, 8)
            }

            Section("Meanings") {
                if !entry.alt_meanings_ko.isEmpty {
                    LabeledContent("Alt", value: entry.alt_meanings_ko)
                }
                if !entry.accepted_paraphrases_ko.isEmpty {
                    LabeledContent("Accepted", value: entry.accepted_paraphrases_ko)
                }
            }

            if !entry.example_en.isEmpty || !entry.example_ko.isEmpty {
                Section("Example") {
                    if !entry.example_en.isEmpty {
                        Text(entry.example_en)
                    }
                    if !entry.example_ko.isEmpty {
                        Text(entry.example_ko)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let state {
                Section("Review") {
                    LabeledContent("Next", value: state.nextReviewDate.formatted(date: .abbreviated, time: .omitted))
                    LabeledContent("Interval", value: "\(state.intervalDays)d")
                    LabeledContent("Priority", value: "\(state.priority)")
                    LabeledContent("Wrong", value: "\(state.totalWrong)")
                    if !state.lastVerdict.isEmpty {
                        LabeledContent("Last", value: state.lastVerdict)
                    }
                }
            }

            Section("Grading Notes") {
                if entry.grading_notes.isEmpty && entry.common_confusions_ko.isEmpty && entry.evidence_hint.isEmpty {
                    Text("없음")
                        .foregroundStyle(.secondary)
                }
                if !entry.grading_notes.isEmpty {
                    Text(entry.grading_notes)
                }
                if !entry.common_confusions_ko.isEmpty {
                    Text(entry.common_confusions_ko)
                        .foregroundStyle(.secondary)
                }
                if !entry.evidence_hint.isEmpty {
                    Text(entry.evidence_hint)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Attempts") {
                if wordAttempts.isEmpty {
                    Text("기록 없음")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(wordAttempts, id: \.id) { attempt in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(attempt.verdict)
                                .font(.headline)
                            Text(attempt.user_answer.isEmpty ? "미응답" : attempt.user_answer)
                            Text(attempt.reason_ko)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(entry.word)
    }
}
