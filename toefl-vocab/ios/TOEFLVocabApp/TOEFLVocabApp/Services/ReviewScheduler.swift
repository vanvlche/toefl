import Foundation

enum ReviewScheduler {
    static let intervalLadder = [1, 3, 7, 14, 30]

    static func apply(
        result: GradingResult,
        to state: ReviewState,
        today: Date = Date(),
        calendar: Calendar = .current
    ) {
        let startOfDay = calendar.startOfDay(for: today)
        state.lastSeen = startOfDay
        state.lastVerdict = result.verdict

        switch GradingVerdict(rawValue: result.verdict) {
        case .correct:
            state.consecutiveCorrect += 1
            state.intervalDays = nextInterval(after: state.intervalDays)
            state.nextReviewDate = calendar.date(byAdding: .day, value: state.intervalDays, to: startOfDay) ?? startOfDay
            state.priority = max(1, state.priority - 1)
        case .partial:
            state.consecutiveCorrect = 0
            state.intervalDays = 1
            state.totalWrong += 1
            state.priority += 1
            state.nextReviewDate = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? startOfDay
        case .wrong, .blank, .none:
            state.consecutiveCorrect = 0
            state.intervalDays = 0
            state.totalWrong += 1
            state.priority += 1
            state.nextReviewDate = startOfDay
        }
    }

    static func nextInterval(after currentInterval: Int) -> Int {
        intervalLadder.first { $0 > currentInterval } ?? intervalLadder.last ?? 30
    }
}
