import SwiftUI

struct GradingResultView: View {
    let result: GradingResult
    let entry: VocabEntry
    var onNext: (() -> Void)?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(entry.word)
                        .font(.largeTitle.bold())
                    Text(result.verdict.uppercased())
                        .font(.headline)
                        .foregroundStyle(verdictColor)
                    Text(result.reason_ko)
                        .font(.body)
                }
                .padding(.vertical, 8)
            }

            Section("제출 답안") {
                Text(result.user_answer.isEmpty ? "미응답" : result.user_answer)
            }

            Section("기준 의미") {
                Text(result.canonical_meaning)
            }

            Section("근거") {
                Text(result.evidence_ko)
            }

            Section("허용 범위") {
                Text(result.accepted_range_ko)
            }

            Section("교정") {
                Text(result.correction_ko)
            }

            Section("오류 유형") {
                if result.error_types.isEmpty {
                    Text("없음")
                } else {
                    ForEach(result.error_types, id: \.self) { errorType in
                        Text(errorType)
                    }
                }
                Text("confidence: \(result.confidence)")
                    .foregroundStyle(.secondary)
            }

            if let onNext {
                Section {
                    Button {
                        onNext()
                    } label: {
                        Label("다음 단어", systemImage: "arrow.right.circle")
                    }
                }
            }
        }
        .navigationTitle("Result")
    }

    private var verdictColor: Color {
        switch result.verdict {
        case GradingVerdict.correct.rawValue:
            return .green
        case GradingVerdict.partial.rawValue:
            return .orange
        case GradingVerdict.blank.rawValue:
            return .gray
        default:
            return .red
        }
    }
}
