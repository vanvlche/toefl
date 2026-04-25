import SwiftData
import SwiftUI

struct WrongAnswersView: View {
    @Query(sort: \QuizAttempt.timestamp, order: .reverse) private var attempts: [QuizAttempt]
    @Query(sort: \VocabEntry.word) private var entries: [VocabEntry]

    private var wrongAttempts: [QuizAttempt] {
        attempts.filter { $0.verdict != GradingVerdict.correct.rawValue }
    }

    var body: some View {
        List {
            if wrongAttempts.isEmpty {
                ContentUnavailableView("오답 기록이 없습니다", systemImage: "checkmark.circle")
            } else {
                ForEach(wrongAttempts, id: \.id) { attempt in
                    if let entry = entries.first(where: { $0.word == attempt.word }) {
                        NavigationLink {
                            WordDetailView(entry: entry)
                        } label: {
                            attemptRow(attempt)
                        }
                    } else {
                        attemptRow(attempt)
                    }
                }
            }
        }
        .navigationTitle("Wrong Answers")
    }

    private func attemptRow(_ attempt: QuizAttempt) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(attempt.word)
                    .font(.headline)
                Spacer()
                Text(attempt.verdict)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(attempt.verdict == GradingVerdict.partial.rawValue ? .orange : .red)
            }
            Text(attempt.reason_ko)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Text(attempt.timestamp, style: .date)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
