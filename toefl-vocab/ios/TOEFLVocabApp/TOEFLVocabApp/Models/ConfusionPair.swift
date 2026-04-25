import Foundation
import SwiftData

@Model
final class ConfusionPair {
    @Attribute(.unique) var id: String
    var word_a: String
    var word_b: String
    var reason: String
    var count: Int
    var lastSeen: Date?
    var example_hint: String

    init(
        word_a: String,
        word_b: String,
        reason: String = "",
        count: Int = 0,
        lastSeen: Date? = nil,
        example_hint: String = ""
    ) {
        self.id = "\(word_a.lowercased())|\(word_b.lowercased())"
        self.word_a = word_a
        self.word_b = word_b
        self.reason = reason
        self.count = count
        self.lastSeen = lastSeen
        self.example_hint = example_hint
    }
}
