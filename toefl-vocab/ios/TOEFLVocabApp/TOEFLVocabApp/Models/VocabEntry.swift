import Foundation
import SwiftData

@Model
final class VocabEntry {
    @Attribute(.unique) var word: String
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
    var createdAt: Date
    var updatedAt: Date

    init(
        word: String,
        pos: String = "",
        core_meaning_ko: String = "",
        alt_meanings_ko: String = "",
        example_en: String = "",
        example_ko: String = "",
        source_session: String = "",
        status: String = "active",
        notes: String = "",
        entry_type: String = "word",
        deck_tags: String = "",
        source_files: String = "",
        accepted_paraphrases_ko: String = "",
        grading_notes: String = "",
        common_confusions_ko: String = "",
        evidence_hint: String = "",
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.word = word
        self.pos = pos
        self.core_meaning_ko = core_meaning_ko
        self.alt_meanings_ko = alt_meanings_ko
        self.example_en = example_en
        self.example_ko = example_ko
        self.source_session = source_session
        self.status = status
        self.notes = notes
        self.entry_type = entry_type
        self.deck_tags = deck_tags
        self.source_files = source_files
        self.accepted_paraphrases_ko = accepted_paraphrases_ko
        self.grading_notes = grading_notes
        self.common_confusions_ko = common_confusions_ko
        self.evidence_hint = evidence_hint
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var canonicalMeaning: String {
        [core_meaning_ko, alt_meanings_ko]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: "; ")
    }

    var acceptedMeaningCandidates: [String] {
        [core_meaning_ko, alt_meanings_ko, accepted_paraphrases_ko]
            .flatMap(Self.splitMeanings)
            .removingDuplicates()
    }

    static func splitMeanings(_ value: String) -> [String] {
        value
            .components(separatedBy: CharacterSet(charactersIn: ";/,|\n"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

private extension Array where Element == String {
    func removingDuplicates() -> [String] {
        var seen: Set<String> = []
        return filter { seen.insert($0).inserted }
    }
}
