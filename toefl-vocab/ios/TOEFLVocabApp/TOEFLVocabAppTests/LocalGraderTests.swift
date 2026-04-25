import XCTest
@testable import TOEFLVocabApp

final class LocalGraderTests: XCTestCase {
    func testExactAcceptedMeaningIsCorrect() {
        let entry = VocabEntry(
            word: "constrain",
            pos: "v",
            core_meaning_ko: "제약하다",
            alt_meanings_ko: "제한하다",
            accepted_paraphrases_ko: "속박하다"
        )

        let result = LocalGrader.grade(answer: "제한하다", for: entry)

        XCTAssertEqual(result.verdict, "correct")
        XCTAssertTrue(result.error_types.isEmpty)
        XCTAssertEqual(result.confidence, "high")
    }

    func testBlankAnswerUsesDetailedFields() {
        let entry = VocabEntry(word: "peril", pos: "n", core_meaning_ko: "위험", alt_meanings_ko: "위험한 상황")

        let result = LocalGrader.grade(answer: "   ", for: entry)

        XCTAssertEqual(result.verdict, "blank")
        XCTAssertEqual(result.error_types, ["blank"])
        XCTAssertFalse(result.reason_ko.isEmpty)
        XCTAssertFalse(result.evidence_ko.isEmpty)
        XCTAssertFalse(result.accepted_range_ko.isEmpty)
        XCTAssertFalse(result.correction_ko.isEmpty)
    }

    func testImpreciseOverlapIsPartial() {
        let entry = VocabEntry(word: "intricate", pos: "adj", core_meaning_ko: "복잡하게 얽힌", alt_meanings_ko: "정교한")

        let result = LocalGrader.grade(answer: "복잡한", for: entry)

        XCTAssertEqual(result.verdict, "partial")
        XCTAssertEqual(result.error_types, ["accepted_but_imprecise"])
    }
}
