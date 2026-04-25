(() => {
  "use strict";

  const STORAGE_KEY = "toefl-vocab-pwa-progress-v1";
  const SEED_URL = "./data/seed_words.json";
  const SEED_REFRESH_INTERVAL_MS = 60 * 1000;
  const INTERVALS = [1, 3, 7, 14, 30];

  const app = {
    seed: null,
    words: [],
    progress: null,
    route: { name: "today", params: {} },
    quiz: null,
    answerDraft: "",
    lastResult: null,
    serviceWorkerStatus: "unavailable"
  };
  let seedRefreshTimer = null;
  let seedRefreshInFlight = false;

  const screen = document.querySelector("#screen");
  const title = document.querySelector("#screen-title");
  const backButton = document.querySelector("#back-button");
  const navButtons = Array.from(document.querySelectorAll(".nav-button"));

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    wireShell();
    wireDesktopActions();
    await registerServiceWorker();

    try {
      app.seed = await fetchFreshSeed();
      app.words = app.seed.words || [];
      app.progress = loadProgress(app.seed);
      saveProgress();
      routeFromHash();
      window.addEventListener("hashchange", () => {
        routeFromHash();
        render();
      });
      render();
      startSeedAutoRefresh();
    } catch (error) {
      renderFatalError(error);
    }
  }

  function wireShell() {
    navButtons.forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });

    backButton.addEventListener("click", () => {
      if (app.route.name === "quiz" || app.route.name === "result") {
        navigate("today");
      } else {
        history.back();
      }
    });
  }

  async function registerServiceWorker() {
    if (!["http:", "https:"].includes(window.location.protocol)) {
      app.serviceWorkerStatus = "unavailable on file protocol";
      return;
    }

    if (!("serviceWorker" in navigator)) {
      app.serviceWorkerStatus = "not supported";
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      app.serviceWorkerStatus = registration.active ? "active" : "registered";
    } catch (error) {
      app.serviceWorkerStatus = `failed: ${error.message}`;
    }
  }

  async function fetchSeed(options = {}) {
    const requests = options.fresh
      ? [
          { url: `${SEED_URL}?ts=${Date.now()}`, init: { cache: "no-store" } },
          { url: SEED_URL, init: {} }
        ]
      : [{ url: SEED_URL, init: {} }];

    try {
      let lastError = null;
      for (const request of requests) {
        try {
          const response = await fetch(request.url, request.init);
          if (!response.ok) {
            throw new Error(`seed_words.json load failed (${response.status})`);
          }
          return response.json();
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("seed_words.json load failed");
    } catch (error) {
      if (isDesktop() && typeof window.toeflDesktop.readSeedJson === "function") {
        try {
          return await window.toeflDesktop.readSeedJson();
        } catch (desktopError) {
          throw new Error(`seed_words.json load failed: ${error.message}; desktop fallback failed: ${desktopError.message}`);
        }
      }
      throw error;
    }
  }

  function fetchFreshSeed() {
    return fetchSeed({ fresh: true });
  }

  function seedIdentity(seed) {
    if (!seed) return "";
    if (seed.source_hash) return `source_hash:${seed.source_hash}`;
    if (seed.generated_at) return `generated_at:${seed.generated_at}`;

    const words = Array.isArray(seed.words) ? seed.words : [];
    let serializedLength = 0;
    try {
      serializedLength = JSON.stringify(words).length;
    } catch {
      serializedLength = 0;
    }
    return `fallback:${words.length}:${serializedLength}`;
  }

  async function checkForSeedUpdate(options = {}) {
    if (seedRefreshInFlight) return false;
    seedRefreshInFlight = true;

    try {
      const freshSeed = await fetchFreshSeed();
      const currentIdentity = seedIdentity(app.seed);
      const freshIdentity = seedIdentity(freshSeed);

      if (currentIdentity && currentIdentity === freshIdentity) {
        if (options.manual) {
          showToast("이미 최신 단어 데이터입니다.");
        }
        return false;
      }

      app.seed = freshSeed;
      app.words = freshSeed.words || [];
      app.progress = reconcileProgress(app.progress || loadProgress(freshSeed), freshSeed);
      saveProgress();
      render();
      showToast("새 단어 데이터를 반영했습니다.");
      return true;
    } catch (error) {
      if (options.manual) {
        showToast(`단어 데이터 확인 실패: ${error.message}`);
      }
      return false;
    } finally {
      seedRefreshInFlight = false;
    }
  }

  function startSeedAutoRefresh() {
    if (seedRefreshTimer) return;

    seedRefreshTimer = window.setInterval(() => {
      checkForSeedUpdate();
    }, SEED_REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkForSeedUpdate();
      }
    });
  }

  function wireDesktopActions() {
    if (!isDesktop()) return;

    window.addEventListener("toefl-desktop-export-progress", () => {
      exportProgress();
    });
    window.addEventListener("toefl-desktop-import-progress", () => {
      importProgress();
    });
    window.addEventListener("toefl-desktop-reset-progress", () => {
      resetAllProgress();
    });
  }

  function isDesktop() {
    return Boolean(window.toeflDesktop && window.toeflDesktop.isDesktop);
  }

  function loadProgress(seed) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildInitialProgress(seed);
    }

    try {
      return reconcileProgress(JSON.parse(raw), seed);
    } catch {
      return buildInitialProgress(seed);
    }
  }

  function buildInitialProgress(seed) {
    const reviewStates = {};
    const attempts = [];
    const importedAttemptIds = {};

    (seed.words || []).forEach((word) => {
      reviewStates[word.word] = normalizeReviewState(word);
      (word.wrong_attempts || []).forEach((attempt) => {
        const normalized = normalizeSeedAttempt(attempt);
        attempts.push(normalized);
        importedAttemptIds[normalized.id] = true;
      });
    });

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      seedGeneratedAt: seed.generated_at || "",
      reviewStates,
      attempts,
      importedAttemptIds
    };
  }

  function reconcileProgress(progress, seed) {
    const safeProgress = {
      version: 1,
      createdAt: progress.createdAt || new Date().toISOString(),
      seedGeneratedAt: progress.seedGeneratedAt || "",
      reviewStates: progress.reviewStates || {},
      attempts: Array.isArray(progress.attempts) ? progress.attempts : [],
      importedAttemptIds: progress.importedAttemptIds || {}
    };

    (seed.words || []).forEach((word) => {
      if (!safeProgress.reviewStates[word.word]) {
        safeProgress.reviewStates[word.word] = normalizeReviewState(word);
      }

      (word.wrong_attempts || []).forEach((attempt) => {
        const normalized = normalizeSeedAttempt(attempt);
        if (!safeProgress.importedAttemptIds[normalized.id]) {
          safeProgress.attempts.push(normalized);
          safeProgress.importedAttemptIds[normalized.id] = true;
        }
      });
    });

    safeProgress.seedGeneratedAt = seed.generated_at || safeProgress.seedGeneratedAt;
    return safeProgress;
  }

  function normalizeReviewState(word) {
    const seedState = word.review_state || {};
    return {
      word: word.word,
      next_review_date: seedState.next_review_date || todayString(),
      interval_days: Number(seedState.interval_days ?? 1),
      ease: Number(seedState.ease ?? 2.5),
      consecutive_correct: Number(seedState.consecutive_correct ?? 0),
      total_wrong: Number(seedState.total_wrong ?? 0),
      last_seen: seedState.last_seen || "",
      last_verdict: seedState.last_verdict || "",
      priority: Number(seedState.priority ?? 1),
      notes: seedState.notes || ""
    };
  }

  function normalizeSeedAttempt(attempt) {
    const id = `seed-${hashText([
      attempt.timestamp,
      attempt.session_id,
      attempt.word,
      attempt.user_answer,
      attempt.verdict
    ].join("|"))}`;

    return {
      id,
      source: "seed",
      timestamp: attempt.timestamp || new Date().toISOString(),
      session_id: attempt.session_id || "seed",
      word: attempt.word || "",
      user_answer: attempt.user_answer || "",
      canonical_meaning: attempt.gold_meaning || attempt.canonical_meaning || "",
      verdict: attempt.verdict || "wrong",
      reason_ko: attempt.reason_ko || attempt.notes || "",
      evidence_ko: attempt.evidence_ko || "seed wrong_answers.jsonl 기록",
      accepted_range_ko: attempt.accepted_range_ko || attempt.gold_meaning || "",
      correction_ko: attempt.correction_ko || attempt.gold_meaning || "",
      error_types: Array.isArray(attempt.error_types) ? attempt.error_types : [],
      confidence: attempt.confidence || "medium"
    };
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.progress));
  }

  function routeFromHash() {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) {
      app.route = { name: "today", params: {} };
      return;
    }

    const [name, rawParam] = hash.split(":", 2);
    app.route = { name, params: {} };
    if (name === "word" && rawParam) {
      app.route.params.word = rawParam;
    }
  }

  function navigate(name, params = {}) {
    let nextHash = `#${encodeURIComponent(name)}`;
    if (name === "word" && params.word) {
      nextHash = `#word:${encodeURIComponent(params.word)}`;
    }

    if (window.location.hash === nextHash) {
      routeFromHash();
      render();
    } else {
      window.location.hash = nextHash;
    }
  }

  function render() {
    updateChrome();
    screen.replaceChildren();

    switch (app.route.name) {
      case "quiz":
        renderQuiz();
        break;
      case "result":
        renderResult();
        break;
      case "wrong":
        renderWrongAnswers();
        break;
      case "word":
        renderWordDetail(app.route.params.word);
        break;
      case "settings":
        renderSettings();
        break;
      case "today":
      default:
        renderTodayReview();
        break;
    }

    screen.focus({ preventScroll: true });
  }

  function updateChrome() {
    const titles = {
      today: "Today Review",
      quiz: "Quiz",
      result: "Result",
      wrong: "Wrong Answers",
      word: "Word Detail",
      settings: "Settings"
    };
    title.textContent = titles[app.route.name] || "TOEFL Vocab";
    backButton.classList.toggle("hidden", ["today", "wrong", "settings"].includes(app.route.name));

    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.route === app.route.name);
    });
  }

  function renderTodayReview() {
    const due = getDueWords();
    const attempts = app.progress.attempts || [];
    const weakCount = attempts.filter((attempt) => attempt.verdict !== "correct").length;

    screen.append(
      el("section", { className: "hero" }, [
        el("h2", {}, "오늘 복습"),
        el("p", {}, "현재 저장된 복습 큐 기준입니다."),
        el("div", { className: "hero-grid" }, [
          metric(String(due.length), "Due"),
          metric(String(app.words.length), "Words"),
          metric(String(weakCount), "Weak"),
          metric(todayString(), "Today")
        ]),
        el("div", { className: "button-row" }, [
          button("퀴즈 시작", "primary-button", () => startQuiz(due), due.length === 0),
          button("전체 단어 보기", "secondary-button", renderAllWordsToast)
        ])
      ])
    );

    const section = el("section", { className: "section" }, [el("h2", {}, "복습 목록")]);
    if (due.length === 0) {
      section.append(emptyState("오늘 예정된 복습이 없습니다."));
    } else {
      section.append(wordList(due));
    }
    screen.append(section);
  }

  function renderQuiz() {
    if (!app.quiz) {
      startQuiz(getDueWords(), true);
    }

    if (!app.quiz || app.quiz.words.length === 0) {
      screen.append(emptyState("퀴즈 항목이 없습니다."));
      return;
    }

    if (app.quiz.index >= app.quiz.words.length) {
      screen.append(
        el("section", { className: "empty-state" }, [
          el("h2", {}, "퀴즈 완료"),
          button("Today로 이동", "primary-button", () => navigate("today"))
        ])
      );
      return;
    }

    const entry = app.quiz.words[app.quiz.index];
    const textarea = el("textarea", {
      className: "answer-box",
      rows: "4",
      placeholder: "한국어 뜻 입력",
      value: app.answerDraft,
      oninput: (event) => {
        app.answerDraft = event.target.value;
      }
    });

    const body = [
      el("p", { className: "row-subtitle" }, `${app.quiz.index + 1} / ${app.quiz.words.length}`),
      el("p", { className: "quiz-pos" }, entry.pos || entry.entry_type || "word"),
      el("h2", { className: "quiz-word" }, entry.word)
    ];

    if (entry.example_en || entry.example_ko) {
      body.push(
        el("div", { className: "example" }, [
          entry.example_en ? el("p", {}, entry.example_en) : null,
          entry.example_ko ? el("p", {}, entry.example_ko) : null
        ])
      );
    }

    body.push(
      el("label", { className: "answer-label", for: "answer-box" }, "답안"),
      textarea,
      el("div", { className: "button-row" }, [
        button("채점", "primary-button", () => submitAnswer(entry)),
        button("미응답 제출", "secondary-button", () => {
          app.answerDraft = "";
          submitAnswer(entry);
        })
      ])
    );

    textarea.id = "answer-box";
    screen.append(el("section", { className: "quiz-card" }, body));
    setTimeout(() => textarea.focus(), 50);
  }

  function renderResult() {
    if (!app.lastResult) {
      screen.append(emptyState("표시할 채점 결과가 없습니다."));
      return;
    }

    const { result, entry } = app.lastResult;
    screen.append(
      el("section", { className: "result-panel" }, [
        el("div", { className: "row-title" }, [
          el("h2", {}, entry.word),
          el("span", { className: `pill ${result.verdict}` }, result.verdict)
        ]),
        fieldList([
          ["제출 답안", result.user_answer || "미응답"],
          ["기준 의미", result.canonical_meaning],
          ["판정 이유", result.reason_ko],
          ["근거", result.evidence_ko],
          ["허용 가능한 답 범위", result.accepted_range_ko],
          ["교정 답안", result.correction_ko],
          ["오류 유형", result.error_types.length ? result.error_types.join(", ") : "없음"],
          ["신뢰도", result.confidence]
        ]),
        el("div", { className: "button-row" }, [
          button("다음", "primary-button", nextQuizItem),
          button("단어 상세", "secondary-button", () => navigate("word", { word: entry.word }))
        ])
      ])
    );
  }

  function renderWrongAnswers() {
    const attempts = [...(app.progress.attempts || [])]
      .filter((attempt) => attempt.verdict !== "correct")
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

    screen.append(
      el("section", { className: "stat-grid" }, [
        stat(String(attempts.length), "오답/부분/미응답"),
        stat(String(uniqueWords(attempts).length), "단어 수")
      ])
    );

    const section = el("section", { className: "section" }, [el("h2", {}, "오답 기록")]);
    if (attempts.length === 0) {
      section.append(emptyState("오답 기록이 없습니다."));
    } else {
      const list = el("div", { className: "list" });
      attempts.forEach((attempt) => {
        list.append(
          el("button", { className: "row", type: "button", onclick: () => navigate("word", { word: attempt.word }) }, [
            el("div", { className: "row-main" }, [
              el("p", { className: "row-title" }, [
                el("span", {}, attempt.word),
                el("span", { className: `pill ${attempt.verdict}` }, attempt.verdict)
              ]),
              el("p", { className: "row-subtitle" }, attempt.reason_ko || attempt.correction_ko || "기록된 설명 없음")
            ]),
            el("span", { className: "row-meta" }, formatDate(attempt.timestamp))
          ])
        );
      });
      section.append(list);
    }
    screen.append(section);
  }

  function renderWordDetail(word) {
    const entry = findWord(word);
    if (!entry) {
      screen.append(emptyState("단어를 찾을 수 없습니다."));
      return;
    }

    const review = app.progress.reviewStates[entry.word] || normalizeReviewState(entry);
    const attempts = (app.progress.attempts || [])
      .filter((attempt) => attempt.word === entry.word)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

    screen.append(
      el("section", { className: "detail-panel" }, [
        el("p", { className: "quiz-pos" }, entry.pos || entry.entry_type || "word"),
        el("h2", { className: "quiz-word" }, entry.word),
        fieldList([
          ["핵심 의미", entry.core_meaning_ko || "없음"],
          ["추가 의미", entry.alt_meanings_ko || "없음"],
          ["허용 paraphrase", entry.accepted_paraphrases_ko || "없음"],
          ["예문", [entry.example_en, entry.example_ko].filter(Boolean).join("\n") || "없음"],
          ["채점 메모", [entry.grading_notes, entry.common_confusions_ko, entry.evidence_hint].filter(Boolean).join("\n") || "없음"],
          ["복습 상태", `next=${review.next_review_date}, interval=${review.interval_days}, priority=${review.priority}, wrong=${review.total_wrong}`]
        ]),
        el("div", { className: "button-row" }, [
          button("이 단어 퀴즈", "primary-button", () => startQuiz([entry])),
          button("Today", "secondary-button", () => navigate("today"))
        ])
      ])
    );

    const section = el("section", { className: "section" }, [el("h2", {}, "시도 기록")]);
    if (attempts.length === 0) {
      section.append(emptyState("기록이 없습니다."));
    } else {
      const list = el("div", { className: "list" });
      attempts.forEach((attempt) => {
        list.append(
          el("div", { className: "row" }, [
            el("div", { className: "row-main" }, [
              el("p", { className: "row-title" }, [
                el("span", {}, attempt.user_answer || "미응답"),
                el("span", { className: `pill ${attempt.verdict}` }, attempt.verdict)
              ]),
              el("p", { className: "row-subtitle" }, attempt.reason_ko || attempt.correction_ko)
            ]),
            el("span", { className: "row-meta" }, formatDate(attempt.timestamp))
          ])
        );
      });
      section.append(list);
    }
    screen.append(section);
  }

  function renderSettings() {
    const attempts = app.progress.attempts || [];
    const storageBytes = new Blob([JSON.stringify(app.progress)]).size;
    const sourceHash = app.seed.source_hash ? app.seed.source_hash.slice(0, 12) : "없음";

    screen.append(
      el("section", { className: "settings-panel" }, [
        el("h2", {}, "데이터"),
        fieldList([
          ["seed generated_at", app.seed.generated_at || "unknown"],
          ["seed source_hash", sourceHash],
          ["words", String(app.words.length)],
          ["attempts", String(attempts.length)],
          ["storage", `${Math.round(storageBytes / 1024)} KB`],
          ["service worker", app.serviceWorkerStatus]
        ]),
        el("div", { className: "button-row" }, [
          button("단어 데이터 업데이트 확인", "primary-button", () => checkForSeedUpdate({ manual: true })),
          button("진행 상황 내보내기", "secondary-button", exportProgress),
          button("진행 상황 가져오기", "secondary-button", importProgress),
          button("seed로 초기화", "danger-button", resetProgress)
        ])
      ])
    );

    screen.append(
      el("section", { className: "section settings-panel" }, [
        el("h2", {}, "현재 채점 방식"),
        fieldList([
          ["mode", "local rule-based"],
          ["OpenAI API", "사용하지 않음"],
          ["persistence", "localStorage"]
        ])
      ])
    );
  }

  function startQuiz(words, silent = false) {
    const quizWords = (words && words.length ? words : getDueWords()).slice();
    app.quiz = { words: quizWords, index: 0 };
    app.answerDraft = "";
    app.lastResult = null;
    if (!silent) {
      navigate("quiz");
    }
  }

  function submitAnswer(entry) {
    const result = gradeAnswer(app.answerDraft, entry);
    applySchedule(result, entry.word);
    const attempt = {
      id: `local-${Date.now()}-${hashText(`${entry.word}|${app.answerDraft}`)}`,
      source: "local",
      timestamp: new Date().toISOString(),
      session_id: "pwa-local",
      ...result
    };
    app.progress.attempts.push(attempt);
    saveProgress();
    app.lastResult = { result, entry };
    navigate("result");
  }

  function nextQuizItem() {
    if (!app.quiz) {
      navigate("today");
      return;
    }

    app.quiz.index += 1;
    app.answerDraft = "";
    app.lastResult = null;

    if (app.quiz.index >= app.quiz.words.length) {
      app.quiz = null;
      navigate("today");
    } else {
      navigate("quiz");
    }
  }

  function gradeAnswer(answer, entry) {
    const userAnswer = answer.trim();
    const canonical = [entry.core_meaning_ko, entry.alt_meanings_ko].filter(Boolean).join("; ");
    const candidates = splitMeanings([entry.core_meaning_ko, entry.alt_meanings_ko, entry.accepted_paraphrases_ko].join("; "));
    const acceptedRange = candidates.length ? candidates.join("; ") : canonical;
    const evidence = buildEvidence(entry);

    if (!userAnswer) {
      return {
        word: entry.word,
        user_answer: answer,
        canonical_meaning: canonical,
        verdict: "blank",
        reason_ko: "답안이 비어 있어 미응답으로 처리했습니다.",
        evidence_ko: evidence,
        accepted_range_ko: acceptedRange,
        correction_ko: `핵심 답안은 ${entry.core_meaning_ko}입니다.`,
        error_types: ["blank"],
        confidence: "high"
      };
    }

    if (exactMatch(userAnswer, candidates)) {
      return {
        word: entry.word,
        user_answer: answer,
        canonical_meaning: canonical,
        verdict: "correct",
        reason_ko: "제출 답안이 허용 답안 범위의 핵심 의미와 일치합니다.",
        evidence_ko: evidence,
        accepted_range_ko: acceptedRange,
        correction_ko: "현재 답안을 그대로 인정할 수 있습니다.",
        error_types: [],
        confidence: "high"
      };
    }

    if (knownConfusion(userAnswer, entry)) {
      return {
        word: entry.word,
        user_answer: answer,
        canonical_meaning: canonical,
        verdict: "wrong",
        reason_ko: "제출 답안이 기준 의미보다 common_confusions_ko에 기록된 혼동 표현에 더 가깝습니다.",
        evidence_ko: evidence,
        accepted_range_ko: acceptedRange,
        correction_ko: `${entry.word}는 ${entry.core_meaning_ko} 쪽으로 기억해야 합니다.`,
        error_types: ["meaning_confusion"],
        confidence: "medium"
      };
    }

    if (partialMatch(userAnswer, candidates)) {
      return {
        word: entry.word,
        user_answer: answer,
        canonical_meaning: canonical,
        verdict: "partial",
        reason_ko: "방향은 일부 맞지만 기준 의미 전체를 충분히 특정하지 못해 부분 정답으로 처리했습니다.",
        evidence_ko: evidence,
        accepted_range_ko: acceptedRange,
        correction_ko: `더 정확히는 ${entry.core_meaning_ko}라고 답하는 것이 안전합니다.`,
        error_types: ["accepted_but_imprecise"],
        confidence: "medium"
      };
    }

    return {
      word: entry.word,
      user_answer: answer,
      canonical_meaning: canonical,
      verdict: "wrong",
      reason_ko: "제출 답안이 기준 의미 또는 허용 paraphrase와 충분히 연결되지 않습니다.",
      evidence_ko: evidence,
      accepted_range_ko: acceptedRange,
      correction_ko: `${entry.word}의 핵심 의미는 ${entry.core_meaning_ko}입니다.`,
      error_types: ["meaning_confusion"],
      confidence: "medium"
    };
  }

  function applySchedule(result, word) {
    const review = app.progress.reviewStates[word] || normalizeReviewState(findWord(word) || { word });
    const today = todayString();
    review.last_seen = today;
    review.last_verdict = result.verdict;

    if (result.verdict === "correct") {
      review.consecutive_correct = Number(review.consecutive_correct || 0) + 1;
      review.interval_days = nextInterval(Number(review.interval_days || 0));
      review.next_review_date = addDays(today, review.interval_days);
      review.priority = Math.max(1, Number(review.priority || 1) - 1);
    } else if (result.verdict === "partial") {
      review.consecutive_correct = 0;
      review.interval_days = 1;
      review.total_wrong = Number(review.total_wrong || 0) + 1;
      review.priority = Number(review.priority || 1) + 1;
      review.next_review_date = addDays(today, 1);
    } else {
      review.consecutive_correct = 0;
      review.interval_days = 0;
      review.total_wrong = Number(review.total_wrong || 0) + 1;
      review.priority = Number(review.priority || 1) + 1;
      review.next_review_date = today;
    }

    app.progress.reviewStates[word] = review;
  }

  function nextInterval(current) {
    return INTERVALS.find((interval) => interval > current) || INTERVALS[INTERVALS.length - 1];
  }

  function getDueWords() {
    const today = todayString();
    return app.words
      .filter((word) => {
        const review = app.progress.reviewStates[word.word];
        return !review || String(review.next_review_date || today) <= today;
      })
      .sort((a, b) => {
        const left = app.progress.reviewStates[a.word] || {};
        const right = app.progress.reviewStates[b.word] || {};
        if (Number(left.priority || 0) !== Number(right.priority || 0)) {
          return Number(right.priority || 0) - Number(left.priority || 0);
        }
        if (Number(left.total_wrong || 0) !== Number(right.total_wrong || 0)) {
          return Number(right.total_wrong || 0) - Number(left.total_wrong || 0);
        }
        return a.word.localeCompare(b.word);
      });
  }

  function findWord(word) {
    return app.words.find((entry) => entry.word === word);
  }

  function splitMeanings(value) {
    return value
      .split(/[;/,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }

  function exactMatch(answer, candidates) {
    const normalizedAnswer = normalize(answer);
    return candidates.some((candidate) => {
      const normalizedCandidate = normalize(candidate);
      return normalizedAnswer === normalizedCandidate || normalizedAnswer.includes(normalizedCandidate);
    });
  }

  function partialMatch(answer, candidates) {
    const answerStem = stem(answer);
    if (answerStem.length < 2) return false;

    return candidates.some((candidate) => {
      const candidateStem = stem(candidate);
      if (candidateStem.length < 2) return false;
      return candidateStem.includes(answerStem)
        || answerStem.includes(candidateStem)
        || bigramOverlap(answerStem, candidateStem) >= 0.55;
    });
  }

  function knownConfusion(answer, entry) {
    const normalizedAnswer = normalize(answer);
    const normalizedConfusions = normalize(entry.common_confusions_ko || "");
    return normalizedAnswer && normalizedConfusions.includes(normalizedAnswer);
  }

  function buildEvidence(entry) {
    const fields = [`core_meaning_ko=${entry.core_meaning_ko || ""}`];
    if (entry.alt_meanings_ko) fields.push(`alt_meanings_ko=${entry.alt_meanings_ko}`);
    if (entry.accepted_paraphrases_ko) fields.push(`accepted_paraphrases_ko=${entry.accepted_paraphrases_ko}`);
    if (entry.grading_notes) fields.push(`grading_notes=${entry.grading_notes}`);
    if (entry.common_confusions_ko) fields.push(`common_confusions_ko=${entry.common_confusions_ko}`);
    if (entry.evidence_hint) fields.push(`evidence_hint=${entry.evidence_hint}`);
    return fields.join("; ");
  }

  function normalize(value) {
    return String(value)
      .toLowerCase()
      .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~·“”‘’]/g, "");
  }

  function stem(value) {
    let normalized = normalize(value);
    const suffixes = ["하게", "하는", "한다", "하다", "되다", "되는", "된다", "적인", "으로", "에서", "에게", "처럼", "같은", "한", "된", "적", "의", "을", "를", "은", "는", "이", "가"];
    for (const suffix of suffixes) {
      if (normalized.endsWith(suffix) && normalized.length > suffix.length + 1) {
        normalized = normalized.slice(0, -suffix.length);
        break;
      }
    }
    return normalized;
  }

  function bigramOverlap(left, right) {
    const leftSet = new Set(bigrams(left));
    const rightSet = new Set(bigrams(right));
    if (!leftSet.size || !rightSet.size) return 0;

    let intersection = 0;
    leftSet.forEach((item) => {
      if (rightSet.has(item)) intersection += 1;
    });
    return intersection / Math.min(leftSet.size, rightSet.size);
  }

  function bigrams(value) {
    const chars = Array.from(value);
    const result = [];
    for (let index = 0; index < chars.length - 1; index += 1) {
      result.push(chars[index] + chars[index + 1]);
    }
    return result;
  }

  function wordList(words) {
    const list = el("div", { className: "list" });
    words.forEach((word) => {
      const review = app.progress.reviewStates[word.word] || {};
      list.append(
        el("button", { className: "row", type: "button", onclick: () => navigate("word", { word: word.word }) }, [
          el("div", { className: "row-main" }, [
            el("p", { className: "row-title" }, [
              el("span", {}, word.word),
              word.entry_type === "phrase" ? el("span", { className: "pill" }, "phrase") : null
            ]),
            el("p", { className: "row-subtitle" }, word.core_meaning_ko || word.alt_meanings_ko || "")
          ]),
          el("span", { className: "row-meta" }, `P${review.priority || 1}`)
        ])
      );
    });
    return list;
  }

  function metric(value, label) {
    return el("div", { className: "metric" }, [
      el("strong", {}, value),
      el("span", {}, label)
    ]);
  }

  function stat(value, label) {
    return el("div", { className: "stat" }, [
      el("strong", {}, value),
      el("span", {}, label)
    ]);
  }

  function fieldList(items) {
    return el("div", { className: "field-list" }, items.map(([label, value]) => (
      el("div", { className: "field" }, [
        el("p", { className: "field-label" }, label),
        el("p", { className: "field-value" }, value || "없음")
      ])
    )));
  }

  function button(text, className, onClick, disabled = false) {
    return el("button", { className, type: "button", onclick: onClick, disabled }, text);
  }

  function emptyState(message) {
    return el("section", { className: "empty-state" }, [el("p", {}, message)]);
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "onclick") node.addEventListener("click", value);
      else if (key === "oninput") node.addEventListener("input", value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });

    const childArray = Array.isArray(children) ? children : [children];
    childArray.filter((child) => child !== null && child !== undefined).forEach((child) => {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  async function resetProgress() {
    await resetAllProgress();
  }

  async function resetAllProgress(options = {}) {
    if (!app.seed) {
      showToast("앱 로딩 후 다시 시도해 주세요.");
      return false;
    }

    if (options.confirm !== false) {
      let confirmed = false;
      try {
        confirmed = await confirmResetProgress();
      } catch (error) {
        showToast(`초기화 실패: ${error.message}`);
        return false;
      }
      if (!confirmed) {
        return false;
      }
    }

    app.progress = buildInitialProgress(app.seed);
    app.quiz = null;
    app.lastResult = null;
    saveProgress();
    showToast("초기화했습니다.");
    render();
    return true;
  }

  async function confirmResetProgress() {
    if (isDesktop() && typeof window.toeflDesktop.resetProgress === "function") {
      const result = await window.toeflDesktop.resetProgress();
      return Boolean(result && result.confirmed);
    }

    return confirm("브라우저에 저장된 진행 상황을 seed 기준으로 초기화할까요?");
  }

  async function exportProgress() {
    if (!app.progress) {
      showToast("앱 로딩 후 다시 시도해 주세요.");
      return;
    }

    const payload = exportProgressPayload();
    if (isDesktop() && typeof window.toeflDesktop.exportProgress === "function") {
      try {
        const result = await window.toeflDesktop.exportProgress(payload);
        if (result && !result.canceled) {
          showToast("진행 상황을 내보냈습니다.");
        }
      } catch (error) {
        showToast(`내보내기 실패: ${error.message}`);
      }
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `toefl-vocab-progress-${todayString()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importProgress() {
    if (!app.seed) {
      showToast("앱 로딩 후 다시 시도해 주세요.");
      return;
    }

    if (isDesktop() && typeof window.toeflDesktop.importProgress === "function") {
      try {
        const result = await window.toeflDesktop.importProgress();
        if (!result || result.canceled) return;
        importProgressPayload(result.payload);
        showToast("진행 상황을 가져왔습니다.");
      } catch (error) {
        showToast(`가져오기 실패: ${error.message}`);
      }
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const payload = JSON.parse(await file.text());
        importProgressPayload(payload);
        showToast("진행 상황을 가져왔습니다.");
      } catch (error) {
        showToast(`가져오기 실패: ${error.message}`);
      }
    });
    input.click();
  }

  function exportProgressPayload() {
    return {
      appName: "TOEFL Vocab",
      format: "toefl-vocab-progress",
      version: 1,
      exportedAt: new Date().toISOString(),
      storageKey: STORAGE_KEY,
      seedGeneratedAt: app.seed && app.seed.generated_at ? app.seed.generated_at : "",
      progress: JSON.parse(JSON.stringify(app.progress))
    };
  }

  function importProgressPayload(payload) {
    const importedProgress = extractProgress(payload);
    app.progress = reconcileProgress(importedProgress, app.seed);
    app.quiz = null;
    app.answerDraft = "";
    app.lastResult = null;
    saveProgress();
    routeFromHash();
    render();
    return exportProgressPayload();
  }

  function extractProgress(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("백업 JSON 형식이 올바르지 않습니다.");
    }

    if (payload.progress && typeof payload.progress === "object") {
      return payload.progress;
    }

    if (payload.localStorage && typeof payload.localStorage === "object" && payload.localStorage[STORAGE_KEY]) {
      const stored = payload.localStorage[STORAGE_KEY];
      return typeof stored === "string" ? JSON.parse(stored) : stored;
    }

    if (payload.reviewStates && Array.isArray(payload.attempts)) {
      return payload;
    }

    throw new Error("진행 상황 데이터를 찾을 수 없습니다.");
  }

  function renderAllWordsToast() {
    const total = app.words.length;
    const due = getDueWords().length;
    showToast(`전체 ${total}개 중 ${due}개가 오늘 복습 대상입니다.`);
  }

  function showToast(message) {
    document.querySelectorAll(".toast").forEach((toast) => toast.remove());
    const toast = el("div", { className: "toast", role: "status" }, message);
    document.body.append(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  function uniqueWords(attempts) {
    return Array.from(new Set(attempts.map((attempt) => attempt.word)));
  }

  function todayString() {
    return dateString(new Date());
  }

  function dateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(dateValue, amount) {
    const [year, month, day] = String(dateValue).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + amount);
    return dateString(date);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function renderFatalError(error) {
    title.textContent = "Load Failed";
    screen.replaceChildren(
      el("section", { className: "empty-state" }, [
        el("h2", {}, "앱을 불러오지 못했습니다."),
        el("p", {}, error.message || String(error))
      ])
    );
  }
})();
