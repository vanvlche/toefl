import Foundation
import SwiftData

struct SeedImportSummary: Equatable {
    var wordsImported: Int = 0
    var reviewStatesImported: Int = 0
    var attemptsImported: Int = 0
    var confusionPairsImported: Int = 0
    var skipped: Bool = false
}

enum SeedImporter {
    static func importIfNeeded(modelContext: ModelContext, bundle: Bundle = .main) throws -> SeedImportSummary {
        var descriptor = FetchDescriptor<VocabEntry>()
        descriptor.fetchLimit = 1

        if try !modelContext.fetch(descriptor).isEmpty {
            return SeedImportSummary(skipped: true)
        }

        guard let url = bundle.url(forResource: "seed_words", withExtension: "json") else {
            throw SeedImportError.seedFileMissing
        }

        let data = try Data(contentsOf: url)
        return try importSeed(from: data, modelContext: modelContext)
    }

    @discardableResult
    static func importSeed(from data: Data, modelContext: ModelContext) throws -> SeedImportSummary {
        let payload = try JSONDecoder().decode(SeedPayload.self, from: data)
        var summary = SeedImportSummary()

        for seedWord in payload.words {
            let word = seedWord.word.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !word.isEmpty else { continue }

            if try findEntry(word: word, in: modelContext) == nil {
                modelContext.insert(seedWord.makeVocabEntry())
                summary.wordsImported += 1
            }

            if let reviewState = seedWord.review_state, try findReviewState(word: word, in: modelContext) == nil {
                modelContext.insert(reviewState.makeReviewState(fallbackWord: word))
                summary.reviewStatesImported += 1
            }

            for attempt in seedWord.wrong_attempts {
                modelContext.insert(attempt.makeQuizAttempt())
                summary.attemptsImported += 1
            }
        }

        for pair in payload.confusion_pairs {
            if try findConfusionPair(id: pair.id, in: modelContext) == nil {
                modelContext.insert(pair.makeConfusionPair())
                summary.confusionPairsImported += 1
            }
        }

        try modelContext.save()
        return summary
    }

    private static func findEntry(word: String, in modelContext: ModelContext) throws -> VocabEntry? {
        var descriptor = FetchDescriptor<VocabEntry>(predicate: #Predicate { $0.word == word })
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }

    private static func findReviewState(word: String, in modelContext: ModelContext) throws -> ReviewState? {
        var descriptor = FetchDescriptor<ReviewState>(predicate: #Predicate { $0.word == word })
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }

    private static func findConfusionPair(id: String, in modelContext: ModelContext) throws -> ConfusionPair? {
        var descriptor = FetchDescriptor<ConfusionPair>(predicate: #Predicate { $0.id == id })
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }
}

enum SeedImportError: LocalizedError {
    case seedFileMissing

    var errorDescription: String? {
        switch self {
        case .seedFileMissing:
            return "seed_words.json 파일을 앱 번들에서 찾을 수 없습니다."
        }
    }
}

private struct SeedPayload: Decodable {
    var schema_version: Int
    var generated_at: String
    var source_files: [String]
    var words: [SeedWord]
    var confusion_pairs: [SeedConfusionPair]
}

private struct SeedWord: Decodable {
    var word: String
    var pos: String
    var core_meaning_ko: String
    var alt_meanings_ko: String
    var example_en: String
    var example_ko: String
    var source_session: String
    var status: String
    var notes: String
    var entry_type: String
    var deck_tags: String
    var source_files: String
    var accepted_paraphrases_ko: String
    var grading_notes: String
    var common_confusions_ko: String
    var evidence_hint: String
    var review_state: SeedReviewState?
    var wrong_attempts: [SeedAttempt]

    func makeVocabEntry() -> VocabEntry {
        VocabEntry(
            word: word,
            pos: pos,
            core_meaning_ko: core_meaning_ko,
            alt_meanings_ko: alt_meanings_ko,
            example_en: example_en,
            example_ko: example_ko,
            source_session: source_session,
            status: status,
            notes: notes,
            entry_type: entry_type,
            deck_tags: deck_tags,
            source_files: source_files,
            accepted_paraphrases_ko: accepted_paraphrases_ko,
            grading_notes: grading_notes,
            common_confusions_ko: common_confusions_ko,
            evidence_hint: evidence_hint
        )
    }
}

private struct SeedReviewState: Decodable {
    var word: String
    var next_review_date: String
    var interval_days: Int
    var ease: Double
    var consecutive_correct: Int
    var total_wrong: Int
    var last_seen: String
    var last_verdict: String
    var priority: Int
    var notes: String

    func makeReviewState(fallbackWord: String) -> ReviewState {
        ReviewState(
            word: word.isEmpty ? fallbackWord : word,
            nextReviewDate: DateParsing.parse(next_review_date) ?? Date(),
            intervalDays: interval_days,
            ease: ease,
            consecutiveCorrect: consecutive_correct,
            totalWrong: total_wrong,
            lastSeen: DateParsing.parse(last_seen),
            lastVerdict: last_verdict,
            priority: priority,
            notes: notes
        )
    }
}

private struct SeedAttempt: Decodable {
    var timestamp: String
    var session_id: String
    var word: String
    var user_answer: String
    var gold_meaning: String
    var verdict: String
    var error_types: [String]
    var reason_ko: String
    var evidence_ko: String
    var accepted_range_ko: String
    var correction_ko: String
    var confidence: String

    func makeQuizAttempt() -> QuizAttempt {
        let result = GradingResult(
            word: word,
            user_answer: user_answer,
            canonical_meaning: gold_meaning,
            verdict: verdict,
            reason_ko: reason_ko,
            evidence_ko: evidence_ko,
            accepted_range_ko: accepted_range_ko,
            correction_ko: correction_ko,
            error_types: error_types,
            confidence: confidence
        )
        return QuizAttempt(result: result, timestamp: DateParsing.parse(timestamp) ?? Date(), sessionID: session_id)
    }
}

private struct SeedConfusionPair: Decodable {
    var word_a: String
    var word_b: String
    var reason: String
    var count: Int
    var last_seen: String
    var example_hint: String

    var id: String {
        "\(word_a.lowercased())|\(word_b.lowercased())"
    }

    func makeConfusionPair() -> ConfusionPair {
        ConfusionPair(
            word_a: word_a,
            word_b: word_b,
            reason: reason,
            count: count,
            lastSeen: DateParsing.parse(last_seen),
            example_hint: example_hint
        )
    }
}

enum DateParsing {
    static func parse(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: trimmed) {
            return date
        }

        let internet = ISO8601DateFormatter()
        internet.formatOptions = [.withInternetDateTime]
        if let date = internet.date(from: trimmed) {
            return date
        }

        let dateOnly = DateFormatter()
        dateOnly.calendar = Calendar(identifier: .gregorian)
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: trimmed)
    }
}
