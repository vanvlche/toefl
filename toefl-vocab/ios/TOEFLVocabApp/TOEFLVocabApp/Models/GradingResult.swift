import Foundation

enum GradingVerdict: String, Codable, CaseIterable {
    case correct
    case partial
    case wrong
    case blank
}

enum GradingConfidence: String, Codable, CaseIterable {
    case high
    case medium
    case low
}

struct GradingResult: Codable, Equatable, Identifiable {
    var id = UUID()
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

    enum CodingKeys: String, CodingKey {
        case word
        case user_answer
        case canonical_meaning
        case verdict
        case reason_ko
        case evidence_ko
        case accepted_range_ko
        case correction_ko
        case error_types
        case confidence
    }
}
