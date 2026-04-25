import XCTest
@testable import TOEFLVocabApp

final class ReviewSchedulerTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)
    private let today = Date(timeIntervalSince1970: 1_766_640_000)

    func testCorrectIncreasesInterval() {
        let state = ReviewState(word: "strew", intervalDays: 1, priority: 2)
        let result = result(verdict: "correct")

        ReviewScheduler.apply(result: result, to: state, today: today, calendar: calendar)

        XCTAssertEqual(state.intervalDays, 3)
        XCTAssertEqual(state.consecutiveCorrect, 1)
        XCTAssertEqual(state.priority, 1)
        XCTAssertEqual(state.nextReviewDate, calendar.date(byAdding: .day, value: 3, to: calendar.startOfDay(for: today)))
    }

    func testPartialReviewsTomorrow() {
        let state = ReviewState(word: "barely", intervalDays: 7, totalWrong: 1, priority: 2)
        let result = result(verdict: "partial")

        ReviewScheduler.apply(result: result, to: state, today: today, calendar: calendar)

        XCTAssertEqual(state.intervalDays, 1)
        XCTAssertEqual(state.totalWrong, 2)
        XCTAssertEqual(state.priority, 3)
        XCTAssertEqual(state.nextReviewDate, calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: today)))
    }

    func testWrongReviewsAgainToday() {
        let state = ReviewState(word: "peril", intervalDays: 3, totalWrong: 0, priority: 1)
        let result = result(verdict: "wrong")

        ReviewScheduler.apply(result: result, to: state, today: today, calendar: calendar)

        XCTAssertEqual(state.intervalDays, 0)
        XCTAssertEqual(state.totalWrong, 1)
        XCTAssertEqual(state.nextReviewDate, calendar.startOfDay(for: today))
    }

    private func result(verdict: String) -> GradingResult {
        GradingResult(
            word: "word",
            user_answer: "answer",
            canonical_meaning: "meaning",
            verdict: verdict,
            reason_ko: "reason",
            evidence_ko: "evidence",
            accepted_range_ko: "range",
            correction_ko: "correction",
            error_types: [],
            confidence: "high"
        )
    }
}
