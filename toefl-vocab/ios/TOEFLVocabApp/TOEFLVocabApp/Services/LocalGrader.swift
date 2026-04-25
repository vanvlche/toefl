import Foundation

enum LocalGrader {
    static func grade(answer: String, for entry: VocabEntry) -> GradingResult {
        let trimmedAnswer = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        let canonicalMeaning = entry.canonicalMeaning
        let acceptedCandidates = entry.acceptedMeaningCandidates
        let acceptedRange = acceptedCandidates.isEmpty ? canonicalMeaning : acceptedCandidates.joined(separator: "; ")
        let evidence = evidenceDescription(for: entry)

        guard !trimmedAnswer.isEmpty else {
            return GradingResult(
                word: entry.word,
                user_answer: answer,
                canonical_meaning: canonicalMeaning,
                verdict: GradingVerdict.blank.rawValue,
                reason_ko: "답안이 비어 있어 미응답으로 처리했습니다.",
                evidence_ko: evidence,
                accepted_range_ko: acceptedRange,
                correction_ko: "핵심 답안은 \(entry.core_meaning_ko)입니다.",
                error_types: ["blank"],
                confidence: GradingConfidence.high.rawValue
            )
        }

        if exactMatch(answer: trimmedAnswer, candidates: acceptedCandidates) {
            return GradingResult(
                word: entry.word,
                user_answer: answer,
                canonical_meaning: canonicalMeaning,
                verdict: GradingVerdict.correct.rawValue,
                reason_ko: "제출 답안이 허용 답안 범위의 핵심 의미와 일치합니다.",
                evidence_ko: evidence,
                accepted_range_ko: acceptedRange,
                correction_ko: "현재 답안을 그대로 인정할 수 있습니다.",
                error_types: [],
                confidence: GradingConfidence.high.rawValue
            )
        }

        if isKnownConfusion(answer: trimmedAnswer, entry: entry) {
            return GradingResult(
                word: entry.word,
                user_answer: answer,
                canonical_meaning: canonicalMeaning,
                verdict: GradingVerdict.wrong.rawValue,
                reason_ko: "제출 답안이 기준 의미보다 common_confusions_ko에 기록된 혼동 표현에 더 가깝습니다.",
                evidence_ko: evidence,
                accepted_range_ko: acceptedRange,
                correction_ko: "\(entry.word)는 \(entry.core_meaning_ko) 쪽으로 기억해야 합니다.",
                error_types: ["meaning_confusion"],
                confidence: GradingConfidence.medium.rawValue
            )
        }

        if partialMatch(answer: trimmedAnswer, candidates: acceptedCandidates) {
            return GradingResult(
                word: entry.word,
                user_answer: answer,
                canonical_meaning: canonicalMeaning,
                verdict: GradingVerdict.partial.rawValue,
                reason_ko: "방향은 일부 맞지만 기준 의미 전체를 충분히 특정하지 못해 부분 정답으로 처리했습니다.",
                evidence_ko: evidence,
                accepted_range_ko: acceptedRange,
                correction_ko: "더 정확히는 \(entry.core_meaning_ko)라고 답하는 것이 안전합니다.",
                error_types: ["accepted_but_imprecise"],
                confidence: GradingConfidence.medium.rawValue
            )
        }

        return GradingResult(
            word: entry.word,
            user_answer: answer,
            canonical_meaning: canonicalMeaning,
            verdict: GradingVerdict.wrong.rawValue,
            reason_ko: "제출 답안이 기준 의미 또는 허용 paraphrase와 충분히 연결되지 않습니다.",
            evidence_ko: evidence,
            accepted_range_ko: acceptedRange,
            correction_ko: "\(entry.word)의 핵심 의미는 \(entry.core_meaning_ko)입니다.",
            error_types: ["meaning_confusion"],
            confidence: GradingConfidence.medium.rawValue
        )
    }

    private static func exactMatch(answer: String, candidates: [String]) -> Bool {
        let normalizedAnswer = normalize(answer)
        guard !normalizedAnswer.isEmpty else { return false }

        return candidates.contains { candidate in
            let normalizedCandidate = normalize(candidate)
            return normalizedAnswer == normalizedCandidate || normalizedAnswer.contains(normalizedCandidate)
        }
    }

    private static func partialMatch(answer: String, candidates: [String]) -> Bool {
        let answerStem = stem(answer)
        guard answerStem.count >= 2 else { return false }

        return candidates.contains { candidate in
            let candidateStem = stem(candidate)
            guard candidateStem.count >= 2 else { return false }
            return candidateStem.contains(answerStem)
                || answerStem.contains(candidateStem)
                || bigramOverlap(answerStem, candidateStem) >= 0.55
        }
    }

    private static func isKnownConfusion(answer: String, entry: VocabEntry) -> Bool {
        let normalizedAnswer = normalize(answer)
        guard !normalizedAnswer.isEmpty else { return false }
        let normalizedConfusions = normalize(entry.common_confusions_ko)
        return !normalizedConfusions.isEmpty && normalizedConfusions.contains(normalizedAnswer)
    }

    private static func evidenceDescription(for entry: VocabEntry) -> String {
        var fields = ["core_meaning_ko=\(entry.core_meaning_ko)"]
        if !entry.alt_meanings_ko.isEmpty {
            fields.append("alt_meanings_ko=\(entry.alt_meanings_ko)")
        }
        if !entry.accepted_paraphrases_ko.isEmpty {
            fields.append("accepted_paraphrases_ko=\(entry.accepted_paraphrases_ko)")
        }
        if !entry.grading_notes.isEmpty {
            fields.append("grading_notes=\(entry.grading_notes)")
        }
        if !entry.common_confusions_ko.isEmpty {
            fields.append("common_confusions_ko=\(entry.common_confusions_ko)")
        }
        if !entry.evidence_hint.isEmpty {
            fields.append("evidence_hint=\(entry.evidence_hint)")
        }
        return fields.joined(separator: "; ")
    }

    private static func normalize(_ value: String) -> String {
        value
            .lowercased()
            .unicodeScalars
            .filter { scalar in
                !CharacterSet.whitespacesAndNewlines.contains(scalar)
                    && !CharacterSet.punctuationCharacters.contains(scalar)
                    && !CharacterSet.symbols.contains(scalar)
            }
            .map(String.init)
            .joined()
    }

    private static func stem(_ value: String) -> String {
        var normalized = normalize(value)
        for suffix in ["하게", "하는", "한다", "하다", "되다", "되는", "된다", "적인", "으로", "에서", "에게", "처럼", "같은", "한", "된", "적", "의", "을", "를", "은", "는", "이", "가"] {
            if normalized.hasSuffix(suffix), normalized.count > suffix.count + 1 {
                normalized.removeLast(suffix.count)
                break
            }
        }
        return normalized
    }

    private static func bigramOverlap(_ lhs: String, _ rhs: String) -> Double {
        let lhsBigrams = Set(bigrams(lhs))
        let rhsBigrams = Set(bigrams(rhs))
        guard !lhsBigrams.isEmpty, !rhsBigrams.isEmpty else { return 0 }

        let intersection = lhsBigrams.intersection(rhsBigrams).count
        let denominator = min(lhsBigrams.count, rhsBigrams.count)
        return Double(intersection) / Double(denominator)
    }

    private static func bigrams(_ value: String) -> [String] {
        let characters = Array(value)
        guard characters.count >= 2 else { return [] }
        return (0..<(characters.count - 1)).map { index in
            String(characters[index]) + String(characters[index + 1])
        }
    }
}
