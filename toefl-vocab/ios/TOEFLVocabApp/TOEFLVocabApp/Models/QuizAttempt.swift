import Foundation
import SwiftData

@Model
final class QuizAttempt {
    @Attribute(.unique) var id: UUID
    var timestamp: Date
    var sessionID: String
    var word: String
    var user_answer: String
    var canonical_meaning: String
    var verdict: String
    var reason_ko: String
    var evidence_ko: String
    var accepted_range_ko: String
    var correction_ko: String
    var error_types: [String]
    var confidence: String

    init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        sessionID: String = "ios-local",
        word: String,
        user_answer: String,
        canonical_meaning: String,
        verdict: String,
        reason_ko: String,
        evidence_ko: String,
        accepted_range_ko: String,
        correction_ko: String,
        error_types: [String],
        confidence: String
    ) {
        self.id = id
        self.timestamp = timestamp
        self.sessionID = sessionID
        self.word = word
        self.user_answer = user_answer
        self.canonical_meaning = canonical_meaning
        self.verdict = verdict
        self.reason_ko = reason_ko
        self.evidence_ko = evidence_ko
        self.accepted_range_ko = accepted_range_ko
        self.correction_ko = correction_ko
        self.error_types = error_types
        self.confidence = confidence
    }

    convenience init(result: GradingResult, timestamp: Date = Date(), sessionID: String = "ios-local") {
        self.init(
            timestamp: timestamp,
            sessionID: sessionID,
            word: result.word,
            user_answer: result.user_answer,
            canonical_meaning: result.canonical_meaning,
            verdict: result.verdict,
            reason_ko: result.reason_ko,
            evidence_ko: result.evidence_ko,
            accepted_range_ko: result.accepted_range_ko,
            correction_ko: result.correction_ko,
            error_types: result.error_types,
            confidence: result.confidence
        )
    }
}
