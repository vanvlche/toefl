import SwiftData
import XCTest
@testable import TOEFLVocabApp

@MainActor
final class SeedImporterTests: XCTestCase {
    func testImportSeedCreatesWordsReviewStateAndAttempts() throws {
        let context = try makeInMemoryContext()
        let json = """
        {
          "schema_version": 1,
          "generated_at": "2026-04-24T00:00:00Z",
          "source_files": [],
          "words": [
            {
              "word": "barely",
              "pos": "adv",
              "core_meaning_ko": "간신히",
              "alt_meanings_ko": "겨우",
              "example_en": "The plant barely survived.",
              "example_ko": "그 식물은 간신히 살아남았다.",
              "source_session": "test",
              "status": "active",
              "notes": "",
              "entry_type": "word",
              "deck_tags": "D8",
              "source_files": "decks/D8_voca.txt",
              "accepted_paraphrases_ko": "가까스로",
              "grading_notes": "",
              "common_confusions_ko": "",
              "evidence_hint": "core_meaning_ko=간신히",
              "review_state": {
                "word": "barely",
                "next_review_date": "2026-04-25",
                "interval_days": 1,
                "ease": 2.5,
                "consecutive_correct": 0,
                "total_wrong": 1,
                "last_seen": "2026-04-24",
                "last_verdict": "partial",
                "priority": 2,
                "notes": "seed"
              },
              "wrong_attempts": [
                {
                  "timestamp": "2026-04-24T00:00:00Z",
                  "session_id": "test_session",
                  "word": "barely",
                  "user_answer": "거의 하지 않는",
                  "gold_meaning": "간신히",
                  "verdict": "partial",
                  "error_types": ["accepted_but_imprecise"],
                  "reason_ko": "뉘앙스가 약합니다.",
                  "evidence_ko": "core_meaning_ko=간신히",
                  "accepted_range_ko": "간신히; 가까스로",
                  "correction_ko": "간신히",
                  "confidence": "high"
                }
              ]
            }
          ],
          "confusion_pairs": []
        }
        """

        let summary = try SeedImporter.importSeed(from: Data(json.utf8), modelContext: context)

        XCTAssertEqual(summary.wordsImported, 1)
        XCTAssertEqual(summary.reviewStatesImported, 1)
        XCTAssertEqual(summary.attemptsImported, 1)
        XCTAssertEqual(try context.fetch(FetchDescriptor<VocabEntry>()).first?.word, "barely")
        XCTAssertEqual(try context.fetch(FetchDescriptor<ReviewState>()).first?.priority, 2)
        XCTAssertEqual(try context.fetch(FetchDescriptor<QuizAttempt>()).first?.reason_ko, "뉘앙스가 약합니다.")
    }

    private func makeInMemoryContext() throws -> ModelContext {
        let schema = Schema([VocabEntry.self, ReviewState.self, QuizAttempt.self, ConfusionPair.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: [configuration])
        return ModelContext(container)
    }
}
