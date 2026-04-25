import Foundation
import SwiftData

@Model
final class ReviewState {
    @Attribute(.unique) var word: String
    var nextReviewDate: Date
    var intervalDays: Int
    var ease: Double
    var consecutiveCorrect: Int
    var totalWrong: Int
    var lastSeen: Date?
    var lastVerdict: String
    var priority: Int
    var notes: String

    init(
        word: String,
        nextReviewDate: Date = Date(),
        intervalDays: Int = 1,
        ease: Double = 2.5,
        consecutiveCorrect: Int = 0,
        totalWrong: Int = 0,
        lastSeen: Date? = nil,
        lastVerdict: String = "",
        priority: Int = 1,
        notes: String = ""
    ) {
        self.word = word
        self.nextReviewDate = nextReviewDate
        self.intervalDays = intervalDays
        self.ease = ease
        self.consecutiveCorrect = consecutiveCorrect
        self.totalWrong = totalWrong
        self.lastSeen = lastSeen
        self.lastVerdict = lastVerdict
        self.priority = priority
        self.notes = notes
    }
}
