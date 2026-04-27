(() => {
  "use strict";

  const STORAGE_KEY = "toefl-vocab-pwa-progress-v1";
  const SCHEDULER_SETTINGS_KEY = "toefl-vocab-pwa-scheduler-settings-v1";
  const SCRIPT_BASE_URL = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;
  const SEED_URL = new URL("data/seed_words.json", SCRIPT_BASE_URL).toString();
  const SEED_REFRESH_INTERVAL_MS = 60 * 1000;
  const INTERVALS = [1, 3, 7, 14, 30];
  const ALLOWED_DESIRED_RETENTIONS = [0.85, 0.9, 0.95];
  const DEFAULT_SCHEDULER_SETTINGS = {
    schedulerVersion: 2,
    desiredRetention: 0.9,
    schedulerMode: "adaptive",
    maxIntervalDays: 365,
    learningSuccessTarget: 3
  };

  const app = {
    seed: null,
    words: [],
    progress: null,
    schedulerSettings: null,
    route: { name: "today", params: {} },
    quiz: null,
    lastQuizSummary: null,
    lastQuizAnswerSheet: null,
    customQuizCount: 10,
    selectedDeckId: "all",
    deckQuizCount: 10,
    favoriteQuizCount: 10,
    lastGeneratedQuizWords: [],
    statsSort: "recommended",
    statsSearch: "",
    statsDeckId: "all",
    statsFavoritesOnly: false,
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
    app.schedulerSettings = loadSchedulerSettings();
    saveSchedulerSettings();

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
      if (app.route.name === "quiz" || app.route.name === "result" || app.route.name === "summary") {
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

  function loadSchedulerSettings() {
    const raw = localStorage.getItem(SCHEDULER_SETTINGS_KEY);
    if (!raw) {
      return normalizeSchedulerSettings(null);
    }

    try {
      return normalizeSchedulerSettings(JSON.parse(raw));
    } catch {
      return normalizeSchedulerSettings(null);
    }
  }

  function saveSchedulerSettings() {
    app.schedulerSettings = normalizeSchedulerSettings(app.schedulerSettings);
    localStorage.setItem(SCHEDULER_SETTINGS_KEY, JSON.stringify(app.schedulerSettings));
  }

  function normalizeSchedulerSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const desiredRetention = normalizeDesiredRetention(source.desiredRetention);
    const maxIntervalDays = Math.round(clampNumber(source.maxIntervalDays, 1, 3650, DEFAULT_SCHEDULER_SETTINGS.maxIntervalDays));
    const learningSuccessTarget = Math.round(clampNumber(source.learningSuccessTarget, 1, 10, DEFAULT_SCHEDULER_SETTINGS.learningSuccessTarget));

    return {
      schedulerVersion: 2,
      desiredRetention,
      schedulerMode: source.schedulerMode === "adaptive" ? "adaptive" : DEFAULT_SCHEDULER_SETTINGS.schedulerMode,
      maxIntervalDays,
      learningSuccessTarget
    };
  }

  function normalizeDesiredRetention(value) {
    const number = Number(value);
    const matched = ALLOWED_DESIRED_RETENTIONS.find((item) => Math.abs(item - number) < 0.001);
    return matched || DEFAULT_SCHEDULER_SETTINGS.desiredRetention;
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
      reviewStates[word.word] = normalizeReviewState(word, null, {
        hasAttempts: Array.isArray(word.wrong_attempts) && word.wrong_attempts.length > 0
      });
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
      importedAttemptIds,
      favorites: {}
    };
  }

  function reconcileProgress(progress, seed) {
    const safeProgress = {
      version: 1,
      createdAt: progress.createdAt || new Date().toISOString(),
      seedGeneratedAt: progress.seedGeneratedAt || "",
      reviewStates: progress.reviewStates || {},
      attempts: Array.isArray(progress.attempts) ? progress.attempts : [],
      importedAttemptIds: progress.importedAttemptIds || {},
      favorites: progress.favorites && typeof progress.favorites === "object" ? progress.favorites : {}
    };
    const seedWordsByWord = new Map();

    (seed.words || []).forEach((word) => {
      seedWordsByWord.set(word.word, word);

      (word.wrong_attempts || []).forEach((attempt) => {
        const normalized = normalizeSeedAttempt(attempt);
        if (!safeProgress.importedAttemptIds[normalized.id]) {
          safeProgress.attempts.push(normalized);
          safeProgress.importedAttemptIds[normalized.id] = true;
        }
      });
    });

    const attemptWordCounts = {};
    safeProgress.attempts.forEach((attempt) => {
      const word = attempt && attempt.word ? attempt.word : "";
      if (!word) return;
      attemptWordCounts[word] = (attemptWordCounts[word] || 0) + 1;
    });

    (seed.words || []).forEach((word) => {
      safeProgress.reviewStates[word.word] = normalizeReviewState(word, safeProgress.reviewStates[word.word], {
        hasAttempts: Boolean(attemptWordCounts[word.word])
      });
    });

    Object.keys(safeProgress.reviewStates).forEach((word) => {
      const entry = seedWordsByWord.get(word) || { word };
      safeProgress.reviewStates[word] = normalizeReviewState(entry, safeProgress.reviewStates[word], {
        hasAttempts: Boolean(attemptWordCounts[word])
      });
    });

    safeProgress.seedGeneratedAt = seed.generated_at || safeProgress.seedGeneratedAt;
    return safeProgress;
  }

  function normalizeReviewState(word, existingState = null, options = {}) {
    const seedState = word.review_state || {};
    const existing = existingState && typeof existingState === "object" ? existingState : null;
    const source = existing || seedState;
    const merged = { ...seedState, ...source };
    const wordText = merged.word || word.word || "";
    const intervalDays = Math.round(clampNumber(merged.interval_days, 0, getMaxIntervalDays(), 1));
    const lastSeen = merged.last_seen || "";
    const lastReviewedAt = merged.last_reviewed_at || lastSeen || "";
    const lastVerdict = merged.last_verdict || "";
    const hasAttempts = Boolean(options.hasAttempts);
    const hasBeenSeen = Boolean(lastSeen || lastReviewedAt || hasAttempts);
    const existingPhase = normalizeLearningPhaseValue(merged.learning_phase);
    const learningPhase = existingPhase || (hasBeenSeen ? "review" : "new");
    const desiredRetention = normalizeDesiredRetention(
      merged.desired_retention ?? (app.schedulerSettings && app.schedulerSettings.desiredRetention)
    );

    return {
      ...merged,
      word: wordText,
      next_review_date: merged.next_review_date || todayString(),
      interval_days: intervalDays,
      ease: clampNumber(merged.ease, 1.3, 3.0, 2.5),
      consecutive_correct: Math.max(0, Math.round(clampNumber(merged.consecutive_correct, 0, 1000000, 0))),
      total_wrong: Math.max(0, Math.round(clampNumber(merged.total_wrong, 0, 1000000, 0))),
      last_seen: lastSeen,
      last_verdict: lastVerdict,
      priority: Math.max(1, Math.round(clampNumber(merged.priority, 1, 1000000, 1))),
      notes: merged.notes || "",
      scheduler_version: 2,
      stability_days: clampNumber(merged.stability_days, 0.5, getMaxIntervalDays(), intervalDays > 0 ? intervalDays : 1),
      difficulty: clampNumber(merged.difficulty, 0.1, 0.95, 0.5),
      retrievability: clamp01(merged.retrievability ?? 1),
      lapses: Math.max(0, Math.round(clampNumber(merged.lapses, 0, 1000000, 0))),
      first_seen: merged.first_seen || lastSeen || "",
      last_reviewed_at: lastReviewedAt,
      last_success_at: merged.last_success_at || (lastVerdict === "correct" ? lastSeen : ""),
      initial_correct_count: Math.max(0, Math.round(clampNumber(merged.initial_correct_count, 0, 1000000, 0))),
      learning_phase: learningPhase,
      desired_retention: desiredRetention
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

  function normalizeFavoriteWord(word) {
    return String(word || "").trim();
  }

  function isFavoriteWord(word) {
    const normalized = normalizeFavoriteWord(word);
    return Boolean(normalized && app.progress && app.progress.favorites && app.progress.favorites[normalized]);
  }

  function toggleFavoriteWord(word) {
    const normalized = normalizeFavoriteWord(word);
    if (!normalized) {
      showToast("즐겨찾기할 단어를 찾을 수 없습니다.");
      return;
    }

    if (!app.progress) {
      app.progress = buildInitialProgress(app.seed || { words: app.words });
    }
    if (!app.progress.favorites || typeof app.progress.favorites !== "object") {
      app.progress.favorites = {};
    }

    const exists = Boolean(app.progress.favorites[normalized]);
    if (exists) {
      delete app.progress.favorites[normalized];
    } else {
      app.progress.favorites[normalized] = {
        word: normalized,
        createdAt: new Date().toISOString(),
        source: "user"
      };
    }

    saveProgress();
    render();
    showToast(exists ? "즐겨찾기에서 제거했습니다." : "즐겨찾기에 추가했습니다.");
  }

  function getFavoriteWords() {
    return app.words.filter((entry) => isFavoriteWord(entry.word));
  }

  function getFavoriteCount() {
    return getFavoriteWords().length;
  }

  function favoriteButton(word, options = {}) {
    const favorite = isFavoriteWord(word);
    const className = options.className || "secondary-button";
    return button(favorite ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기", className, () => toggleFavoriteWord(word));
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
    } else if (name === "deck" && rawParam) {
      app.route.params.deckId = rawParam;
    }
  }

  function navigate(name, params = {}) {
    let nextHash = `#${encodeURIComponent(name)}`;
    if (name === "word" && params.word) {
      nextHash = `#word:${encodeURIComponent(params.word)}`;
    } else if (name === "deck" && params.deckId) {
      nextHash = `#deck:${encodeURIComponent(params.deckId)}`;
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
      case "summary":
        renderQuizSummary();
        break;
      case "answer-sheet":
        renderAnswerSheet();
        break;
      case "favorites":
        renderFavorites();
        break;
      case "wrong":
        renderWrongAnswers();
        break;
      case "stats":
        renderWordStats();
        break;
      case "word":
        renderWordDetail(app.route.params.word);
        break;
      case "deck":
        renderDeckDetail(app.route.params.deckId || app.selectedDeckId || "all");
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
      summary: "퀴즈 요약",
      "answer-sheet": "답안지",
      favorites: "즐겨찾기",
      wrong: "Wrong Answers",
      stats: "단어별 통계",
      word: "Word Detail",
      deck: "Deck",
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
    const attempts = app.progress && Array.isArray(app.progress.attempts) ? app.progress.attempts : [];
    const weakCount = attempts.filter((attempt) => attempt.verdict !== "correct").length;
    const allStats = computeAllWordStats();
    const riskStats = allStats.filter((stats) => stats.isRisk);
    const learningStats = allStats.filter((stats) => ["new", "learning", "relearning"].includes(stats.learningPhase));
    const matureStats = allStats.filter((stats) => stats.learningPhase === "mature");
    const desiredRetention = getSchedulerSettings().desiredRetention;

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
          button("퀴즈 시작", "primary-button", () => startQuiz(due, false, { scopeType: "today", scopeLabel: "오늘 복습" }), due.length === 0),
          button("전체 단어 보기", "secondary-button", renderAllWordsToast)
        ])
      ])
    );

    screen.append(
      el("section", { className: "section" }, [
        el("h2", {}, "Adaptive Review"),
        el("div", { className: "stat-grid" }, [
          stat(String(riskStats.length), "위험 단어"),
          stat(String(learningStats.length), "Learning"),
          stat(String(matureStats.length), "Mature"),
          stat(formatPercent(desiredRetention), "목표 기억률")
        ]),
        el("div", { className: "button-row" }, [
          button("위험 단어 퀴즈", "secondary-button", () => startQuiz(riskStats.map((stats) => stats.entry), false, { scopeType: "risk", scopeLabel: "위험 단어" }), riskStats.length === 0),
          button("초기 학습 단어 퀴즈", "secondary-button", () => startQuiz(learningStats.map((stats) => stats.entry), false, { scopeType: "learning", scopeLabel: "초기 학습 단어" }), learningStats.length === 0)
        ])
      ])
    );

    const customCount = clampQuizCount(app.customQuizCount);
    const customCountInput = el("input", {
      className: "number-input",
      type: "number",
      min: "1",
      max: String(Math.max(1, app.words.length)),
      value: String(customCount),
      inputMode: "numeric"
    });

    screen.append(
      el("section", { className: "section" }, [
        el("h2", {}, "맞춤 퀴즈 생성"),
        el("p", { className: "row-subtitle" }, "오답률, 최근 오답, 복습 예정일, 오래 안 본 정도를 반영해 단어를 뽑습니다."),
        el("label", { className: "form-row" }, [
          el("span", {}, "퀴즈 단어 수"),
          customCountInput
        ]),
        el("div", { className: "button-row" }, [
          button("맞춤 퀴즈 시작", "primary-button", () => {
            const count = clampQuizCount(customCountInput.value);
            app.customQuizCount = count;
            const words = sampleWeightedWords(count);
            app.lastGeneratedQuizWords = words;
            showToast(`${words.length}개 단어로 맞춤 퀴즈를 만들었습니다.`);
            startQuiz(words, false, { scopeType: "weighted", scopeLabel: "맞춤 가중치 퀴즈" });
          }, app.words.length === 0),
          button("단어별 통계 보기", "secondary-button", () => navigate("stats"))
        ])
      ])
    );

    renderFavoriteLearningSection();
    renderDeckLearningSection();

    const section = el("section", { className: "section" }, [el("h2", {}, "복습 목록")]);
    if (due.length === 0) {
      section.append(emptyState("오늘 예정된 복습이 없습니다."));
    } else {
      section.append(wordList(due));
    }
    screen.append(section);
  }

  function renderFavoriteLearningSection() {
    const favoriteWords = getFavoriteWords();
    const favoriteCount = favoriteWords.length;

    screen.append(
      el("section", { className: "section" }, [
        el("h2", {}, "즐겨찾기"),
        el("p", { className: "row-subtitle" }, "중요한 단어를 따로 모아 복습할 수 있습니다."),
        el("div", { className: "stat-grid" }, [
          stat(String(favoriteCount), "즐겨찾기 단어"),
          stat(String(favoriteWords.filter((entry) => getWordAttempts(entry.word).some(isMissAttempt)).length), "Weak")
        ]),
        el("div", { className: "button-row" }, [
          button("즐겨찾기 보기", "secondary-button", () => navigate("favorites")),
          button("즐겨찾기 퀴즈", "primary-button", () => startFavoriteQuiz(), favoriteCount === 0),
          button("즐겨찾기 가중치 퀴즈", "secondary-button", () => startFavoriteQuiz({ weighted: true }), favoriteCount === 0)
        ])
      ])
    );
  }

  function renderDeckLearningSection() {
    const decks = getDecks();
    const hasDecks = decks.length > 0;
    const selectedDeckId = normalizeSelectedDeckId(app.selectedDeckId);
    app.selectedDeckId = selectedDeckId;
    const deckWords = getWordsForDeck(selectedDeckId);
    const deckDueCount = getDueWords().filter((entry) => wordBelongsToDeck(entry, selectedDeckId)).length;
    const deckWeakCount = deckWords.filter((entry) => getWordAttempts(entry.word).some(isMissAttempt)).length;
    const deckQuizCount = clampDeckQuizCount(app.deckQuizCount, selectedDeckId);
    if (deckQuizCount > 0) {
      app.deckQuizCount = deckQuizCount;
    }

    const deckSelect = el("select", {
      className: "select-input",
      value: selectedDeckId,
      onchange: (event) => {
        app.selectedDeckId = normalizeSelectedDeckId(event.target.value);
        app.deckQuizCount = clampDeckQuizCount(app.deckQuizCount, app.selectedDeckId);
        render();
      }
    }, [
      el("option", { value: "all", selected: selectedDeckId === "all" }, "전체 단어"),
      ...decks.map((deck) => (
        el("option", { value: deck.deck_id, selected: selectedDeckId === deck.deck_id }, deck.display_name || deck.deck_id)
      ))
    ]);
    const countInput = el("input", {
      className: "number-input",
      type: "number",
      min: "1",
      max: String(Math.max(1, deckWords.length)),
      value: String(deckQuizCount || 1),
      inputMode: "numeric",
      oninput: (event) => {
        app.deckQuizCount = clampDeckQuizCount(event.target.value, app.selectedDeckId);
      }
    });

    screen.append(
      el("section", { className: "section" }, [
        el("h2", {}, "Deck별 학습"),
        el("p", { className: "row-subtitle" }, "Deck을 선택해서 해당 단어만 보거나, 선택한 Deck으로 퀴즈를 만들 수 있습니다."),
        hasDecks ? el("div", {}, [
          el("label", { className: "form-row" }, [
            el("span", {}, "Deck"),
            deckSelect
          ]),
          el("label", { className: "form-row" }, [
            el("span", {}, "퀴즈 단어 수"),
            countInput
          ]),
          el("p", { className: "meta-note" }, `선택 단어 ${deckWords.length}개 · Due ${deckDueCount}개 · Weak ${deckWeakCount}개`),
          el("div", { className: "button-row" }, [
            button("선택 Deck 단어 보기", "secondary-button", () => navigate("deck", { deckId: selectedDeckId }), deckWords.length === 0),
            button("선택 Deck 퀴즈 시작", "primary-button", () => {
              const count = clampDeckQuizCount(countInput.value, selectedDeckId);
              app.deckQuizCount = count;
              startDeckQuiz(selectedDeckId, { count, weighted: false });
            }, deckWords.length === 0),
            button("선택 Deck 가중치 퀴즈", "secondary-button", () => {
              const count = clampDeckQuizCount(countInput.value, selectedDeckId);
              app.deckQuizCount = count;
              startDeckQuiz(selectedDeckId, { count, weighted: true });
            }, deckWords.length === 0)
          ])
        ]) : emptyState("아직 deck 태그가 없습니다. scripts/import_decks.py --apply 후 web seed를 다시 생성해 주세요.")
      ])
    );
  }

  function renderFavorites() {
    const favoriteWords = getFavoriteWords();
    const favoriteStats = favoriteWords.map(computeWordStats);
    const dueCount = favoriteStats.filter((stats) => stats.isDue).length;
    const weakCount = favoriteStats.filter((stats) => stats.missCount > 0).length;
    const favoriteQuizCount = clampFavoriteQuizCount(app.favoriteQuizCount);
    if (favoriteQuizCount > 0) {
      app.favoriteQuizCount = favoriteQuizCount;
    }

    const countInput = el("input", {
      className: "number-input",
      type: "number",
      min: "1",
      max: String(Math.max(1, favoriteWords.length)),
      value: String(favoriteQuizCount || 1),
      inputMode: "numeric",
      oninput: (event) => {
        app.favoriteQuizCount = clampFavoriteQuizCount(event.target.value);
      }
    });

    screen.append(
      el("section", { className: "detail-panel" }, [
        el("p", { className: "quiz-pos" }, "Favorites"),
        el("h2", { className: "quiz-word" }, "즐겨찾기"),
        el("div", { className: "stat-grid" }, [
          stat(String(favoriteWords.length), "단어 수"),
          stat(String(dueCount), "Due"),
          stat(String(weakCount), "Weak"),
          stat(String(favoriteStats.reduce((sum, stats) => sum + stats.totalAttempts, 0)), "시도")
        ]),
        el("label", { className: "form-row" }, [
          el("span", {}, "퀴즈 단어 수"),
          countInput
        ]),
        el("div", { className: "button-row" }, [
          button("즐겨찾기 퀴즈 시작", "primary-button", () => {
            const count = clampFavoriteQuizCount(countInput.value);
            app.favoriteQuizCount = count;
            startFavoriteQuiz({ count, weighted: false });
          }, favoriteWords.length === 0),
          button("즐겨찾기 가중치 퀴즈", "secondary-button", () => {
            const count = clampFavoriteQuizCount(countInput.value);
            app.favoriteQuizCount = count;
            startFavoriteQuiz({ count, weighted: true });
          }, favoriteWords.length === 0),
          button("Today", "secondary-button", () => navigate("today"))
        ])
      ])
    );

    const section = el("section", { className: "section" }, [el("h2", {}, "즐겨찾기 단어")]);
    if (favoriteWords.length === 0) {
      section.append(emptyState("아직 즐겨찾기 단어가 없습니다."));
      section.append(
        el("div", { className: "button-row" }, [
          button("Today로 이동", "primary-button", () => navigate("today")),
          button("단어별 통계 보기", "secondary-button", () => navigate("stats"))
        ])
      );
    } else {
      section.append(deckWordList(favoriteWords));
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
      },
      onkeydown: (event) => {
        handleQuizAnswerKeydown(event, entry);
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
      el("p", { className: "input-hint" }, "Enter로 채점 · Shift+Enter로 줄바꿈"),
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

  function handleQuizAnswerKeydown(event, entry) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.isComposing || event.keyCode === 229) return;
    if (event.repeat) return;

    event.preventDefault();
    app.answerDraft = event.target.value;
    submitAnswer(entry);
  }

  function renderResult() {
    if (!app.lastResult) {
      screen.append(emptyState("표시할 채점 결과가 없습니다."));
      return;
    }

    const { result, entry } = app.lastResult;
    const continueLabel = isLastQuizResult() ? "요약 보기" : "다음";
    let actionPanel = null;
    if (result.verdict === "correct") {
      actionPanel = el("div", { className: "section" }, [
        el("h2", {}, "이번 회상 난이도"),
        el("div", { className: "button-row" }, [
          button("쉬웠음", "primary-button", () => finalizeCurrentResult("easy")),
          button("보통", "secondary-button", () => finalizeCurrentResult("good")),
          button("어려웠음", "secondary-button", () => finalizeCurrentResult("hard"))
        ])
      ]);
    } else if (result.verdict === "partial") {
      actionPanel = el("div", { className: "button-row" }, [
        button("부분 정답으로 기록하고 계속", "primary-button", () => finalizeCurrentResult("hard"))
      ]);
    } else {
      actionPanel = el("div", { className: "button-row" }, [
        button(continueLabel, "primary-button", () => finalizeCurrentResult("again"))
      ]);
    }

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
        actionPanel,
        el("div", { className: "button-row" }, [
          button("단어 상세", "secondary-button", () => navigate("word", { word: entry.word }))
        ])
      ])
    );
  }

  function renderQuizSummary() {
    const summary = app.lastQuizSummary;
    if (!summary) {
      screen.append(
        el("section", { className: "empty-state" }, [
          el("p", {}, "표시할 퀴즈 요약이 없습니다."),
          el("div", { className: "button-row" }, [
            button("Today로 이동", "primary-button", () => navigate("today"))
          ])
        ])
      );
      return;
    }

    screen.append(
      el("section", { className: "result-panel" }, [
        el("h2", {}, "퀴즈 요약"),
        el("div", { className: "stat-grid" }, [
          stat(String(summary.totalAttempted), "시도한 단어"),
          stat(String(summary.correctCount), "맞은 단어"),
          stat(formatElapsedTime(summary.elapsedMs), "걸린 시간"),
          stat(`${summary.accuracyPercent}%`, "정답률")
        ]),
        fieldList([
          ["부분 정답", String(summary.partialCount)],
          ["오답", String(summary.wrongCount)],
          ["미응답", String(summary.blankCount)]
        ]),
        el("div", { className: "button-row" }, [
          button("답안지 보기", "primary-button", () => navigate("answer-sheet")),
          button("Today로 이동", "secondary-button", () => navigate("today")),
          button("오답 보기", "secondary-button", () => navigate("wrong"))
        ])
      ])
    );
  }

  function renderAnswerSheet() {
    const text = getCurrentQuizAnswerSheet();
    if (!text) {
      screen.append(
        el("section", { className: "empty-state" }, [
          el("p", {}, "표시할 답안지가 없습니다. 퀴즈를 완료한 뒤 다시 시도해 주세요."),
          el("div", { className: "button-row" }, [
            button("Today로 이동", "primary-button", () => navigate("today"))
          ])
        ])
      );
      return;
    }

    const textarea = el("textarea", {
      className: "answer-sheet-box textarea-readonly",
      readonly: true,
      rows: "18",
      value: text
    });

    screen.append(
      el("section", { className: "result-panel" }, [
        el("h2", {}, "퀴즈 답안지"),
        el("p", { className: "row-subtitle" }, "아래 텍스트를 복사해서 노트나 문서에 붙여넣을 수 있습니다."),
        textarea,
        el("div", { className: "button-row" }, [
          button("클립보드 복사", "primary-button", () => copyTextToClipboard(text)),
          button("텍스트 파일 다운로드", "secondary-button", () => downloadTextFile(`toefl-vocab-answer-sheet-${safeFilenameDate()}.txt`, text)),
          button("Today", "secondary-button", () => navigate("today"))
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

  function renderWordStats() {
    const selectedDeckId = normalizeSelectedDeckId(app.statsDeckId || "all");
    app.statsDeckId = selectedDeckId;
    const allStats = getWordsForDeck(selectedDeckId).map(computeWordStats);
    const totalAttempts = allStats.reduce((sum, stats) => sum + stats.totalAttempts, 0);
    const weakWords = allStats.filter((stats) => stats.missCount > 0).length;
    const dueWords = allStats.filter((stats) => stats.isDue).length;
    const averageRetrievability = allStats.length
      ? allStats.reduce((sum, stats) => sum + stats.retrievability, 0) / allStats.length
      : 0;
    const learningWords = allStats.filter((stats) => ["new", "learning", "relearning"].includes(stats.learningPhase)).length;
    const averageStability = allStats.length
      ? allStats.reduce((sum, stats) => sum + stats.stabilityDays, 0) / allStats.length
      : 0;
    const averageDifficulty = allStats.length
      ? allStats.reduce((sum, stats) => sum + stats.difficulty, 0) / allStats.length
      : 0;
    const totalLapses = allStats.reduce((sum, stats) => sum + stats.lapses, 0);
    app.statsSort = app.statsSort || "recommended";
    app.statsSearch = app.statsSearch || "";

    screen.append(
      el("section", { className: "stat-grid" }, [
        stat(String(allStats.length), selectedDeckId === "all" ? "전체 단어" : `${getDeckLabel(selectedDeckId)} 단어`),
        stat(String(totalAttempts), "전체 시도"),
        stat(String(weakWords), "약한 단어"),
        stat(String(dueWords), "복습 예정"),
        stat(formatPercent(averageRetrievability), "현재 추정 기억률"),
        stat(String(learningWords), "학습 단계"),
        stat(formatDays(averageStability), "기억 안정도"),
        stat(formatDecimal(averageDifficulty, 2), "난이도"),
        stat(String(totalLapses), "실패 누적"),
        stat(String(getFavoriteCount()), "즐겨찾기")
      ])
    );

    const sortSelect = el("select", {
      className: "select-input",
      value: app.statsSort,
      onchange: (event) => {
        app.statsSort = event.target.value;
        renderStatsRows();
      }
    }, [
      el("option", { value: "recommended", selected: app.statsSort === "recommended" }, "추천순"),
      el("option", { value: "wrongRate", selected: app.statsSort === "wrongRate" }, "오답률 높은 순"),
      el("option", { value: "recentMiss", selected: app.statsSort === "recentMiss" }, "최근 오답순"),
      el("option", { value: "retrievability", selected: app.statsSort === "retrievability" }, "기억률 낮은 순"),
      el("option", { value: "risk", selected: app.statsSort === "risk" }, "위험 단어순"),
      el("option", { value: "stale", selected: app.statsSort === "stale" }, "오래 안 본 순"),
      el("option", { value: "attempts", selected: app.statsSort === "attempts" }, "시도 횟수 많은 순"),
      el("option", { value: "alpha", selected: app.statsSort === "alpha" }, "알파벳순")
    ]);
    const searchInput = el("input", {
      className: "search-input",
      type: "search",
      placeholder: "단어 검색",
      value: app.statsSearch,
      oninput: (event) => {
        app.statsSearch = event.target.value;
        renderStatsRows();
      }
    });
    const deckSelect = el("select", {
      className: "select-input",
      value: selectedDeckId,
      onchange: (event) => {
        app.statsDeckId = normalizeSelectedDeckId(event.target.value);
        render();
      }
    }, [
      el("option", { value: "all", selected: selectedDeckId === "all" }, "전체 단어"),
      ...getDecks().map((deck) => (
        el("option", { value: deck.deck_id, selected: selectedDeckId === deck.deck_id }, deck.display_name || deck.deck_id)
      ))
    ]);
    const favoriteToggle = el("label", { className: "checkbox-row" }, [
      el("input", {
        type: "checkbox",
        checked: Boolean(app.statsFavoritesOnly),
        onchange: (event) => {
          app.statsFavoritesOnly = Boolean(event.target.checked);
          renderStatsRows();
        }
      }),
      el("span", {}, "즐겨찾기만")
    ]);
    const listHost = el("div", { className: "list" });

    screen.append(
      el("section", { className: "section" }, [
        el("h2", {}, "단어별 통계"),
        el("div", { className: "stats-controls" }, [
          deckSelect,
          sortSelect,
          searchInput,
          favoriteToggle
        ]),
        listHost
      ])
    );

    renderStatsRows();

    function renderStatsRows() {
      const favoriteFiltered = app.statsFavoritesOnly
        ? allStats.filter((stats) => isFavoriteWord(stats.word))
        : allStats;
      const filtered = filterWordStats(favoriteFiltered, app.statsSearch);
      const sorted = sortWordStats(filtered, app.statsSort);
      listHost.replaceChildren();

      if (sorted.length === 0) {
        listHost.append(emptyState("검색 결과가 없습니다."));
        return;
      }

      sorted.forEach((stats) => {
        listHost.append(
          el("button", { className: "row", type: "button", onclick: () => navigate("word", { word: stats.word }) }, [
            el("div", { className: "row-main" }, [
              el("p", { className: "row-title" }, [
                isFavoriteWord(stats.word) ? el("span", { className: "favorite-star", title: "즐겨찾기" }, "★") : null,
                el("span", {}, stats.word),
                el("span", { className: "score-pill" }, `점수 ${formatScore(stats.weightedScore)}`)
              ]),
              el("p", { className: "row-subtitle" }, stats.entry.core_meaning_ko || stats.entry.alt_meanings_ko || ""),
              deckBadgeRow(stats.entry),
              el("p", { className: "row-subtitle" }, `시도 ${stats.totalAttempts} · 정답 ${stats.correctCount} · 오답/부분/미응답 ${stats.missCount} · 오답률 ${formatPercent(stats.wrongRate)} · 점수 ${formatScore(stats.weightedScore)}`),
              el("p", { className: "row-subtitle" }, `기억률 ${formatPercent(stats.retrievability)} · 단계 ${formatLearningPhase(stats.learningPhase)} · 안정도 ${formatDays(stats.stabilityDays)} · 난이도 ${formatDecimal(stats.difficulty, 2)} · 실패 ${stats.lapses}`)
            ]),
            el("span", { className: "row-meta" }, `다음 ${stats.nextReviewDate || "없음"}`)
          ])
        );
      });
    }
  }

  function renderDeckDetail(deckId) {
    const selectedDeckId = normalizeSelectedDeckId(deckId);
    app.selectedDeckId = selectedDeckId;
    const deckWords = getWordsForDeck(selectedDeckId);
    const deckStats = deckWords.map(computeWordStats);
    const dueCount = deckStats.filter((stats) => stats.isDue).length;
    const weakCount = deckStats.filter((stats) => stats.missCount > 0).length;
    const attemptCount = deckStats.reduce((sum, stats) => sum + stats.totalAttempts, 0);
    const deckQuizCount = clampDeckQuizCount(app.deckQuizCount, selectedDeckId);
    if (deckQuizCount > 0) {
      app.deckQuizCount = deckQuizCount;
    }

    const countInput = el("input", {
      className: "number-input",
      type: "number",
      min: "1",
      max: String(Math.max(1, deckWords.length)),
      value: String(deckQuizCount || 1),
      inputMode: "numeric",
      oninput: (event) => {
        app.deckQuizCount = clampDeckQuizCount(event.target.value, selectedDeckId);
      }
    });
    const heading = selectedDeckId === "all" ? "전체 단어" : `${getDeckLabel(selectedDeckId)} Deck`;

    screen.append(
      el("section", { className: "detail-panel" }, [
        el("p", { className: "quiz-pos" }, "Deck"),
        el("h2", { className: "quiz-word" }, heading),
        el("div", { className: "stat-grid" }, [
          stat(String(deckWords.length), "단어 수"),
          stat(String(dueCount), "Due"),
          stat(String(weakCount), "Weak"),
          stat(String(attemptCount), "시도")
        ]),
        el("label", { className: "form-row" }, [
          el("span", {}, "퀴즈 단어 수"),
          countInput
        ]),
        el("div", { className: "button-row" }, [
          button("이 Deck 퀴즈 시작", "primary-button", () => {
            const count = clampDeckQuizCount(countInput.value, selectedDeckId);
            app.deckQuizCount = count;
            startDeckQuiz(selectedDeckId, { count, weighted: false });
          }, deckWords.length === 0),
          button("이 Deck 가중치 퀴즈", "secondary-button", () => {
            const count = clampDeckQuizCount(countInput.value, selectedDeckId);
            app.deckQuizCount = count;
            startDeckQuiz(selectedDeckId, { count, weighted: true });
          }, deckWords.length === 0),
          button("Today", "secondary-button", () => navigate("today"))
        ])
      ])
    );

    const section = el("section", { className: "section" }, [el("h2", {}, "단어 목록")]);
    if (deckWords.length === 0) {
      section.append(emptyState("이 Deck에 표시할 단어가 없습니다."));
    } else {
      section.append(deckWordList(deckWords));
    }
    screen.append(section);
  }

  function renderWordDetail(word) {
    const entry = findWord(word);
    if (!entry) {
      screen.append(emptyState("단어를 찾을 수 없습니다."));
      return;
    }

    const stats = computeWordStats(entry);
    const review = stats.reviewState;
    const deckIds = getWordDeckIds(entry);
    const attempts = getWordAttempts(entry.word)
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
          ["즐겨찾기", isFavoriteWord(entry.word) ? "예" : "아니오"],
          ["Deck", deckIds.length ? deckIds.join(", ") : "없음"],
          ["Primary Deck", entry.primary_deck_id || "없음"],
          ["복습 상태", `next=${review.next_review_date}, interval=${review.interval_days}, priority=${review.priority}, wrong=${review.total_wrong}`],
          ["학습 단계", formatLearningPhase(stats.learningPhase)],
          ["현재 추정 기억률", formatPercent(stats.retrievability)],
          ["목표 기억률", formatPercent(stats.desiredRetention)],
          ["기억 안정도", formatDays(stats.stabilityDays)],
          ["난이도", formatDecimal(stats.difficulty, 2)],
          ["실패 누적", String(stats.lapses)],
          ["다음 복습", review.next_review_date || "없음"],
          ["최근 복습", formatDateTimeShort(review.last_reviewed_at || review.last_seen)],
          ["최근 성공", formatDateTimeShort(review.last_success_at)],
          ["시도 횟수", String(stats.totalAttempts)],
          ["정답", String(stats.correctCount)],
          ["부분 정답", String(stats.partialCount)],
          ["오답", String(stats.wrongCount)],
          ["미응답", String(stats.blankCount)],
          ["오답률", formatPercent(stats.wrongRate)],
          ["최근 시도", formatDateTimeShort(stats.lastAttemptAt)],
          ["최근 오답", formatDateTimeShort(stats.lastMissAt)],
          ["가중치 점수", formatScore(stats.weightedScore)]
        ]),
        el("div", { className: "button-row" }, [
          favoriteButton(entry.word),
          button("이 단어 퀴즈", "primary-button", () => startQuiz([entry], false, { scopeType: "word", scopeLabel: entry.word })),
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
          ["favorites", String(getFavoriteCount())],
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

    const schedulerSettings = getSchedulerSettings();
    const retentionSelect = el("select", {
      className: "select-input",
      value: String(schedulerSettings.desiredRetention),
      onchange: (event) => {
        app.schedulerSettings = normalizeSchedulerSettings({
          ...schedulerSettings,
          desiredRetention: Number(event.target.value)
        });
        saveSchedulerSettings();
        showToast("목표 기억률을 저장했습니다. 다음 채점부터 적용됩니다.");
        render();
      }
    }, [
      el("option", { value: "0.85", selected: schedulerSettings.desiredRetention === 0.85 }, "85% 효율 우선"),
      el("option", { value: "0.9", selected: schedulerSettings.desiredRetention === 0.9 }, "90% 균형"),
      el("option", { value: "0.95", selected: schedulerSettings.desiredRetention === 0.95 }, "95% 정확도 우선")
    ]);

    screen.append(
      el("section", { className: "section settings-panel" }, [
        el("h2", {}, "복습 스케줄"),
        el("label", { className: "form-row" }, [
          el("span", {}, "목표 기억률"),
          retentionSelect
        ]),
        fieldList([
          ["스케줄 모드", schedulerSettings.schedulerMode],
          ["Learning 성공 기준", `${schedulerSettings.learningSuccessTarget}회 성공 회상`],
          ["설명", "목표 기억률을 높이면 다음 복습 간격이 짧아지고 복습량이 늘어납니다."]
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

  function startQuiz(words, silent = false, options = {}) {
    const quizWords = (words && words.length ? words : getDueWords()).slice();
    app.quiz = {
      words: quizWords,
      index: 0,
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      completedAt: "",
      completedAtMs: null,
      scopeType: options.scopeType || "",
      scopeLabel: options.scopeLabel || "",
      deckId: options.deckId || "",
      results: []
    };
    app.lastQuizSummary = null;
    app.lastQuizAnswerSheet = null;
    app.answerDraft = "";
    app.lastResult = null;
    if (!silent) {
      navigate("quiz");
    }
  }

  function submitAnswer(entry) {
    const result = gradeAnswer(app.answerDraft, entry);
    const attempt = {
      id: `local-${Date.now()}-${hashText(`${entry.word}|${app.answerDraft}`)}`,
      source: "local",
      timestamp: new Date().toISOString(),
      session_id: "pwa-local",
      ...result
    };
    app.lastResult = { result, entry, attempt, finalized: false };
    navigate("result");
  }

  function finalizeCurrentResult(effort = "good") {
    if (!app.lastResult) {
      return;
    }
    if (app.lastResult.finalized) {
      nextQuizItem();
      return;
    }

    const { result, entry, attempt } = app.lastResult;
    applySchedule(result, entry.word, effort);
    const review = app.progress.reviewStates[entry.word] || {};
    attempt.recall_effort = effort;
    attempt.scheduler_version = 2;
    attempt.scheduled_next_review_date = review.next_review_date || "";
    attempt.scheduled_interval_days = review.interval_days;
    attempt.stability_days = review.stability_days;
    attempt.difficulty = review.difficulty;
    attempt.retrievability = review.retrievability;
    app.progress.attempts.push(attempt);
    if (app.quiz) {
      app.quiz.results[app.quiz.index] = {
        index: app.quiz.index + 1,
        word: entry.word,
        user_answer: result.user_answer,
        canonical_meaning: result.canonical_meaning,
        verdict: result.verdict,
        reason_ko: result.reason_ko,
        evidence_ko: result.evidence_ko,
        accepted_range_ko: result.accepted_range_ko,
        correction_ko: result.correction_ko,
        error_types: Array.isArray(result.error_types) ? result.error_types.slice() : [],
        confidence: result.confidence,
        timestamp: attempt.timestamp,
        recall_effort: attempt.recall_effort,
        next_review_date: attempt.scheduled_next_review_date,
        interval_days: attempt.scheduled_interval_days,
        scheduled_next_review_date: attempt.scheduled_next_review_date,
        scheduled_interval_days: attempt.scheduled_interval_days,
        stability_days: attempt.stability_days,
        difficulty: attempt.difficulty,
        retrievability: attempt.retrievability
      };
      if (app.quiz.index >= app.quiz.words.length - 1) {
        const completedAtMs = Date.now();
        app.quiz.completedAt = new Date(completedAtMs).toISOString();
        app.quiz.completedAtMs = completedAtMs;
      }
    }
    app.lastResult.finalized = true;
    saveProgress();
    nextQuizItem();
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
      app.lastQuizSummary = buildQuizSummary(app.quiz);
      app.lastQuizAnswerSheet = buildQuizAnswerSheet(app.lastQuizSummary);
      app.quiz = null;
      navigate("summary");
    } else {
      navigate("quiz");
    }
  }

  function isLastQuizResult() {
    return Boolean(app.quiz && app.quiz.index >= app.quiz.words.length - 1);
  }

  function buildQuizSummary(quiz) {
    const results = Array.isArray(quiz && quiz.results) ? quiz.results.filter(Boolean) : [];
    const totalAttempted = results.length;
    const correctCount = results.filter((result) => result.verdict === "correct").length;
    const partialCount = results.filter((result) => result.verdict === "partial").length;
    const wrongCount = results.filter((result) => result.verdict === "wrong").length;
    const blankCount = results.filter((result) => result.verdict === "blank").length;
    const startedAtMs = Number(quiz && quiz.startedAtMs);
    const completedAtMs = Number(quiz && quiz.completedAtMs);
    const elapsedMs = Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs)
      ? completedAtMs - startedAtMs
      : 0;

    return {
      startedAt: quiz && quiz.startedAt ? quiz.startedAt : "",
      completedAt: quiz && quiz.completedAt ? quiz.completedAt : "",
      elapsedMs,
      scopeType: quiz && quiz.scopeType ? quiz.scopeType : "",
      scopeLabel: quiz && quiz.scopeLabel ? quiz.scopeLabel : "",
      deckId: quiz && quiz.deckId ? quiz.deckId : "",
      totalAttempted,
      correctCount,
      partialCount,
      wrongCount,
      blankCount,
      accuracyPercent: totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0,
      results,
      words: results
    };
  }

  function buildQuizAnswerSheet(summary, options = {}) {
    const source = summary || {};
    const results = Array.isArray(source.results)
      ? source.results
      : Array.isArray(source.words)
        ? source.words
        : [];
    const lines = [];
    const completedAt = source.completedAt || new Date().toISOString();
    const dateText = String(completedAt).slice(0, 10) || todayString();

    lines.push("TOEFL Vocab Quiz Answer Sheet");
    lines.push(`Date: ${dateText}`);
    if (source.scopeLabel || options.scopeLabel) {
      lines.push(`Scope: ${source.scopeLabel || options.scopeLabel}`);
    }
    lines.push(`Total: ${source.totalAttempted || results.length || 0}`);
    lines.push(`Correct: ${source.correctCount || 0}`);
    lines.push(`Partial: ${source.partialCount || 0}`);
    lines.push(`Wrong: ${source.wrongCount || 0}`);
    lines.push(`Blank: ${source.blankCount || 0}`);
    lines.push(`Accuracy: ${Number(source.accuracyPercent || 0)}%`);
    lines.push(`Elapsed: ${formatElapsedTime(Number(source.elapsedMs || 0))}`);
    lines.push("");

    results.forEach((result, index) => {
      const itemNumber = Number(result.index || index + 1);
      const nextReview = result.next_review_date || result.scheduled_next_review_date || "";
      const intervalDays = result.interval_days ?? result.scheduled_interval_days;
      const nextReviewText = [
        nextReview || "없음",
        Number.isFinite(Number(intervalDays)) ? `${intervalDays}일 간격` : ""
      ].filter(Boolean).join(" · ");
      const errorTypes = Array.isArray(result.error_types) && result.error_types.length
        ? result.error_types.join(", ")
        : "없음";

      lines.push(`${itemNumber}. ${result.word || ""}`);
      lines.push(`- 제출 답안: ${result.user_answer || "미응답"}`);
      lines.push(`- 기준 의미: ${result.canonical_meaning || "없음"}`);
      lines.push(`- 판정: ${result.verdict || "없음"}`);
      lines.push(`- 회상 난이도: ${formatRecallEffort(result.recall_effort)}`);
      lines.push(`- 허용 범위: ${result.accepted_range_ko || "없음"}`);
      lines.push(`- 교정 답안: ${result.correction_ko || "없음"}`);
      lines.push(`- 다음 복습: ${nextReviewText}`);
      lines.push(`- 오류 유형: ${errorTypes}`);
      if (result.reason_ko) {
        lines.push(`- 판정 이유: ${result.reason_ko}`);
      }
      lines.push("");
    });

    return lines.join("\n").trimEnd() + "\n";
  }

  function getCurrentQuizAnswerSheet() {
    if (app.lastQuizAnswerSheet) {
      return app.lastQuizAnswerSheet;
    }
    if (app.lastQuizSummary) {
      return buildQuizAnswerSheet(app.lastQuizSummary);
    }
    return "";
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
          throw new Error("copy command failed");
        }
      }
      showToast("클립보드에 복사했습니다.");
    } catch (error) {
      showToast(`복사 실패: ${error.message}`);
    }
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function safeFilenameDate() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  }

  function formatRecallEffort(effort) {
    const value = String(effort || "");
    if (value === "easy") return "쉬웠음";
    if (value === "good") return "보통";
    if (value === "hard") return "어려웠음";
    if (value === "again") return "다시";
    return "없음";
  }

  function formatElapsedTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) {
      return "0초";
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0) parts.push(`${minutes}분`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}초`);

    return parts.join(" ");
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

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : min;
    const candidate = Number.isFinite(number) ? number : safeFallback;
    const lower = Number.isFinite(Number(min)) ? Number(min) : candidate;
    const upper = Number.isFinite(Number(max)) ? Number(max) : candidate;
    return Math.min(upper, Math.max(lower, candidate));
  }

  function clamp01(value) {
    return clampNumber(value, 0, 1, 0);
  }

  function getSchedulerSettings() {
    if (!app.schedulerSettings) {
      app.schedulerSettings = normalizeSchedulerSettings(null);
    }
    return app.schedulerSettings;
  }

  function getMaxIntervalDays() {
    return getSchedulerSettings().maxIntervalDays || DEFAULT_SCHEDULER_SETTINGS.maxIntervalDays;
  }

  function daysSinceDate(dateValue) {
    const date = parseLocalDay(dateValue);
    if (!date) return null;

    const today = parseLocalDay(todayString());
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((today.getTime() - date.getTime()) / msPerDay);
  }

  function estimateRetrievability(reviewState) {
    const lastReviewedAt = reviewState && (reviewState.last_reviewed_at || reviewState.last_seen);
    if (!lastReviewedAt) return 1;

    const elapsedDays = daysSinceDate(lastReviewedAt);
    if (elapsedDays === null) return 1;

    const stability = Math.max(0.25, Number(reviewState.stability_days) || 1);
    return clamp01(Math.pow(0.9, elapsedDays / stability));
  }

  function intervalForDesiredRetention(stabilityDays, desiredRetention) {
    const stability = Math.max(0.5, Number(stabilityDays) || 1);
    const retention = normalizeDesiredRetention(desiredRetention);
    const interval = stability * Math.log(retention) / Math.log(0.9);
    return Math.round(clampNumber(interval, 1, getMaxIntervalDays(), 1));
  }

  function updateMemoryState(review, result, effort) {
    const settings = getSchedulerSettings();
    const word = review && review.word ? review.word : result.word;
    const updated = normalizeReviewState(findWord(word) || { word }, review, { hasAttempts: true });
    const now = new Date().toISOString();
    const today = todayString();
    const verdict = result.verdict || "wrong";
    const normalizedEffort = normalizeRecallEffort(effort, verdict);
    const maxIntervalDays = settings.maxIntervalDays || DEFAULT_SCHEDULER_SETTINGS.maxIntervalDays;
    const targetSuccesses = settings.learningSuccessTarget || DEFAULT_SCHEDULER_SETTINGS.learningSuccessTarget;
    const oldStability = clampNumber(updated.stability_days, 0.5, maxIntervalDays, updated.interval_days > 0 ? updated.interval_days : 1);

    updated.scheduler_version = 2;
    updated.last_reviewed_at = now;
    updated.last_seen = today;
    updated.last_verdict = verdict;
    updated.desired_retention = settings.desiredRetention;
    updated.first_seen = updated.first_seen || now;

    if (verdict === "correct") {
      updated.consecutive_correct = Number(updated.consecutive_correct || 0) + 1;
      updated.initial_correct_count = Number(updated.initial_correct_count || 0) + 1;
      updated.last_success_at = now;
      updated.priority = Math.max(1, Number(updated.priority || 1) - 1);

      const difficultyDelta = normalizedEffort === "easy" ? -0.08 : normalizedEffort === "hard" ? 0.05 : -0.03;
      updated.difficulty = clampNumber(Number(updated.difficulty || 0.5) + difficultyDelta, 0.1, 0.95, 0.5);

      const baseMultiplier = normalizedEffort === "easy" ? 2.7 : normalizedEffort === "hard" ? 1.35 : 2.0;
      const multiplier = baseMultiplier * (1 - updated.difficulty * 0.2);
      updated.stability_days = clampNumber(oldStability * multiplier, 0.5, maxIntervalDays, 1);

      if (updated.initial_correct_count < targetSuccesses) {
        updated.learning_phase = "learning";
        updated.interval_days = normalizedEffort === "easy" ? 1 : 0;
        updated.next_review_date = addDays(today, updated.interval_days);
      } else {
        updated.learning_phase = updated.stability_days >= 21 ? "mature" : "review";
        updated.interval_days = intervalForDesiredRetention(updated.stability_days, updated.desired_retention);
        updated.next_review_date = addDays(today, updated.interval_days);
      }

      updated.ease = clampNumber(Number(updated.ease || 2.5) + (normalizedEffort === "easy" ? 0.08 : 0.03), 1.3, 3.0, 2.5);
    } else if (verdict === "partial") {
      updated.consecutive_correct = 0;
      updated.total_wrong = Number(updated.total_wrong || 0) + 1;
      updated.priority = Number(updated.priority || 1) + 1;
      updated.difficulty = clampNumber(Number(updated.difficulty || 0.5) + 0.08, 0.1, 0.95, 0.5);
      updated.stability_days = Math.max(0.5, oldStability * 0.75);
      updated.learning_phase = ["new", "learning"].includes(updated.learning_phase) ? "learning" : "relearning";
      updated.interval_days = 1;
      updated.next_review_date = addDays(today, 1);
      updated.ease = clampNumber(Number(updated.ease || 2.5) - 0.05, 1.3, 3.0, 2.5);
    } else {
      updated.consecutive_correct = 0;
      updated.total_wrong = Number(updated.total_wrong || 0) + 1;
      updated.priority = Number(updated.priority || 1) + 2;
      updated.lapses = Number(updated.lapses || 0) + 1;
      updated.difficulty = clampNumber(Number(updated.difficulty || 0.5) + 0.12, 0.1, 0.95, 0.5);
      updated.stability_days = Math.max(0.5, oldStability * 0.4);
      updated.learning_phase = "relearning";
      updated.interval_days = 0;
      updated.next_review_date = today;
      updated.ease = clampNumber(Number(updated.ease || 2.5) - 0.15, 1.3, 3.0, 2.5);
    }

    updated.difficulty = clampNumber(updated.difficulty, 0.1, 0.95, 0.5);
    updated.stability_days = clampNumber(updated.stability_days, 0.5, maxIntervalDays, 1);
    updated.retrievability = estimateRetrievability(updated);
    return updated;
  }

  function normalizeRecallEffort(effort, verdict) {
    if (verdict !== "correct") {
      return verdict === "partial" ? "hard" : "again";
    }
    return ["easy", "good", "hard"].includes(effort) ? effort : "good";
  }

  function applySchedule(result, word, effort = "good") {
    const review = app.progress.reviewStates[word] || normalizeReviewState(findWord(word) || { word });

    if (getSchedulerSettings().schedulerMode === "adaptive") {
      app.progress.reviewStates[word] = updateMemoryState(review, result, effort);
      return;
    }

    const today = todayString();
    review.last_seen = today;
    review.last_reviewed_at = new Date().toISOString();
    review.last_verdict = result.verdict;
    review.scheduler_version = 2;
    review.desired_retention = getSchedulerSettings().desiredRetention;

    if (result.verdict === "correct") {
      review.consecutive_correct = Number(review.consecutive_correct || 0) + 1;
      review.initial_correct_count = Number(review.initial_correct_count || 0) + 1;
      review.last_success_at = review.last_reviewed_at;
      review.interval_days = nextInterval(Number(review.interval_days || 0));
      review.next_review_date = addDays(today, review.interval_days);
      review.priority = Math.max(1, Number(review.priority || 1) - 1);
      review.learning_phase = review.interval_days >= 21 ? "mature" : "review";
    } else if (result.verdict === "partial") {
      review.consecutive_correct = 0;
      review.interval_days = 1;
      review.total_wrong = Number(review.total_wrong || 0) + 1;
      review.priority = Number(review.priority || 1) + 1;
      review.next_review_date = addDays(today, 1);
      review.learning_phase = "learning";
    } else {
      review.consecutive_correct = 0;
      review.interval_days = 0;
      review.total_wrong = Number(review.total_wrong || 0) + 1;
      review.priority = Number(review.priority || 1) + 1;
      review.lapses = Number(review.lapses || 0) + 1;
      review.next_review_date = today;
      review.learning_phase = "relearning";
    }

    review.stability_days = clampNumber(review.stability_days, 0.5, getMaxIntervalDays(), review.interval_days > 0 ? review.interval_days : 1);
    review.difficulty = clampNumber(review.difficulty, 0.1, 0.95, 0.5);
    review.retrievability = estimateRetrievability(review);
    app.progress.reviewStates[word] = review;
  }

  function nextInterval(current) {
    return INTERVALS.find((interval) => interval > current) || INTERVALS[INTERVALS.length - 1];
  }

  function getDueWords() {
    const today = todayString();
    const reviewStates = app.progress && app.progress.reviewStates ? app.progress.reviewStates : {};
    return app.words
      .filter((word) => {
        const review = reviewStates[word.word];
        return !review || String(review.next_review_date || today) <= today;
      })
      .sort((a, b) => {
        const left = reviewStates[a.word] || {};
        const right = reviewStates[b.word] || {};
        if (Number(left.priority || 0) !== Number(right.priority || 0)) {
          return Number(right.priority || 0) - Number(left.priority || 0);
        }
        if (Number(left.total_wrong || 0) !== Number(right.total_wrong || 0)) {
          return Number(right.total_wrong || 0) - Number(left.total_wrong || 0);
        }
        return a.word.localeCompare(b.word);
      });
  }

  function getDecks() {
    const seedDecks = app.seed && Array.isArray(app.seed.decks) ? app.seed.decks : [];
    const byId = new Map();

    seedDecks.forEach((deck) => {
      const deckId = normalizeDeckId(deck.deck_id);
      if (!deckId) return;
      byId.set(deckId, {
        deck_id: deckId,
        display_name: deck.display_name || deckId,
        word_count: Number(deck.word_count || 0),
        source_file: deck.source_file || ""
      });
    });

    app.words.forEach((entry) => {
      getWordDeckIds(entry).forEach((deckId) => {
        const current = byId.get(deckId) || {
          deck_id: deckId,
          display_name: deckId,
          word_count: 0,
          source_file: ""
        };
        current.word_count = getWordsForDeck(deckId).length;
        byId.set(deckId, current);
      });
    });

    return Array.from(byId.values()).sort((a, b) => naturalDeckCompare(a.deck_id, b.deck_id));
  }

  function getWordDeckIds(entry) {
    const values = [];
    appendDeckValues(values, entry && entry.deck_ids);
    appendDeckValues(values, entry && entry.deck_tags);
    appendDeckValues(values, entry && entry.deck_id);
    appendDeckValues(values, entry && entry.primary_deck_id);

    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      const deckId = normalizeDeckId(value);
      const key = deckId.toLowerCase();
      if (!deckId || seen.has(key)) return;
      seen.add(key);
      result.push(deckId);
    });
    return result.sort(naturalDeckCompare);
  }

  function appendDeckValues(target, value) {
    if (Array.isArray(value)) {
      value.forEach((item) => appendDeckValues(target, item));
      return;
    }
    String(value || "")
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => target.push(item));
  }

  function normalizeDeckId(value) {
    const text = String(value || "").trim();
    if (/^d\d+$/i.test(text)) {
      return `D${Number(text.slice(1))}`;
    }
    return text;
  }

  function normalizeSelectedDeckId(deckId) {
    const normalized = normalizeDeckId(deckId || "all");
    if (!normalized || normalized === "all") return "all";
    const exists = getDecks().some((deck) => deck.deck_id === normalized);
    return exists ? normalized : "all";
  }

  function wordBelongsToDeck(entry, deckId) {
    const normalized = normalizeDeckId(deckId || "all");
    if (!normalized || normalized === "all") return true;
    return getWordDeckIds(entry).includes(normalized);
  }

  function getWordsForDeck(deckId) {
    const normalized = normalizeDeckId(deckId || "all");
    if (!normalized || normalized === "all") return app.words.slice();
    return app.words.filter((entry) => wordBelongsToDeck(entry, normalized));
  }

  function getDeckLabel(deckId) {
    const normalized = normalizeDeckId(deckId || "all");
    if (!normalized || normalized === "all") return "전체 단어";
    const deck = getDecks().find((item) => item.deck_id === normalized);
    return deck ? deck.display_name || deck.deck_id : normalized;
  }

  function naturalDeckCompare(a, b) {
    const left = deckSortParts(a);
    const right = deckSortParts(b);
    if (left.number !== right.number) return left.number - right.number;
    return left.text.localeCompare(right.text);
  }

  function deckSortParts(value) {
    const deckId = normalizeDeckId(value);
    if (/^D\d+$/.test(deckId)) {
      return { number: Number(deckId.slice(1)), text: "" };
    }
    return { number: Number.MAX_SAFE_INTEGER, text: deckId };
  }

  function clampDeckQuizCount(value, deckId) {
    return clampCountForTotal(value, getWordsForDeck(deckId).length);
  }

  function clampFavoriteQuizCount(value) {
    return clampCountForTotal(value, getFavoriteWords().length);
  }

  function startFavoriteQuiz(options = {}) {
    const favoriteWords = getFavoriteWords();
    if (favoriteWords.length === 0) {
      showToast("즐겨찾기 단어가 없습니다.");
      return;
    }

    const count = clampFavoriteQuizCount(options.count || app.favoriteQuizCount);
    app.favoriteQuizCount = count;
    const quizWords = options.weighted
      ? sampleWeightedWords(count, { candidates: favoriteWords })
      : shuffleWords(favoriteWords).slice(0, count);
    app.lastGeneratedQuizWords = quizWords;
    showToast(`즐겨찾기에서 ${quizWords.length}개 단어로 퀴즈를 만들었습니다.`);
    startQuiz(quizWords, false, {
      scopeType: "favorites",
      scopeLabel: options.weighted ? "즐겨찾기 가중치 퀴즈" : "즐겨찾기 퀴즈"
    });
  }

  function startDeckQuiz(deckId, options = {}) {
    const normalized = normalizeDeckId(deckId || "all");
    const deckWords = getWordsForDeck(normalized);
    if (deckWords.length === 0) {
      showToast("선택한 Deck에 단어가 없습니다.");
      return;
    }

    const count = clampDeckQuizCount(options.count || app.deckQuizCount, normalized);
    const quizWords = options.weighted
      ? sampleWeightedWords(count, { candidates: deckWords })
      : shuffleWords(deckWords).slice(0, count);
    app.lastGeneratedQuizWords = quizWords;
    showToast(`${getDeckLabel(normalized)}에서 ${quizWords.length}개 단어로 퀴즈를 만들었습니다.`);
    startQuiz(quizWords, false, {
      scopeType: "deck",
      scopeLabel: `${getDeckLabel(normalized)}${options.weighted ? " 가중치" : ""}`,
      deckId: normalized
    });
  }

  function shuffleWords(words) {
    const shuffled = words.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function getWordAttempts(word) {
    const attempts = app.progress && Array.isArray(app.progress.attempts)
      ? app.progress.attempts
      : [];
    return attempts.filter((attempt) => attempt.word === word);
  }

  function computeWordStats(entry) {
    const attempts = getWordAttempts(entry.word);
    const totalAttempts = attempts.length;
    const correctCount = attempts.filter((attempt) => attempt.verdict === "correct").length;
    const partialCount = attempts.filter((attempt) => attempt.verdict === "partial").length;
    const wrongCount = attempts.filter((attempt) => attempt.verdict === "wrong").length;
    const blankCount = attempts.filter((attempt) => attempt.verdict === "blank").length;
    const missCount = partialCount + wrongCount + blankCount;
    const wrongRate = totalAttempts > 0 ? missCount / totalAttempts : 0;
    const lastAttemptAt = latestAttemptTimestamp(attempts);
    const lastMissAt = latestAttemptTimestamp(attempts.filter(isMissAttempt));
    const reviewState = app.progress && app.progress.reviewStates && app.progress.reviewStates[entry.word]
      ? normalizeReviewState(entry, app.progress.reviewStates[entry.word], { hasAttempts: totalAttempts > 0 })
      : normalizeReviewState(entry, null, { hasAttempts: totalAttempts > 0 });
    const nextReviewDate = reviewState && reviewState.next_review_date ? reviewState.next_review_date : "";
    const isDue = Boolean(nextReviewDate && String(nextReviewDate) <= todayString());
    const priority = Number(reviewState && reviewState.priority ? reviewState.priority : 1);
    const totalWrong = Number(reviewState && reviewState.total_wrong ? reviewState.total_wrong : 0);
    const consecutiveCorrect = Number(reviewState && reviewState.consecutive_correct ? reviewState.consecutive_correct : 0);
    const lastSeen = reviewState && reviewState.last_seen ? reviewState.last_seen : lastAttemptAt;
    const daysSinceLastSeen = daysBetweenToday(lastSeen);
    const daysSinceLastAttempt = daysBetweenToday(lastAttemptAt);
    const recentMissScore = scoreRecentMiss(lastMissAt);
    const staleScore = scoreStaleness(daysSinceLastSeen, totalAttempts);
    const desiredRetention = getSchedulerSettings().desiredRetention;
    const retrievability = estimateRetrievability(reviewState);
    const lastMissDays = daysSinceDate(lastMissAt);
    const recentMiss = lastMissDays !== null && lastMissDays >= 0 && lastMissDays <= 7;
    const learningPhase = normalizeLearningPhaseValue(reviewState.learning_phase) || "new";
    const stabilityDays = clampNumber(reviewState.stability_days, 0.5, getMaxIntervalDays(), 1);
    const difficulty = clampNumber(reviewState.difficulty, 0.1, 0.95, 0.5);
    const lapses = Math.max(0, Number(reviewState.lapses || 0));
    const isRisk = retrievability < desiredRetention || recentMiss || lapses > 0;
    const stats = {
      word: entry.word,
      entry,
      attempts,
      totalAttempts,
      correctCount,
      partialCount,
      wrongCount,
      blankCount,
      missCount,
      wrongRate,
      lastAttemptAt,
      lastMissAt,
      reviewState,
      nextReviewDate,
      isDue,
      priority,
      totalWrong,
      consecutiveCorrect,
      daysSinceLastSeen,
      daysSinceLastAttempt,
      recentMissScore,
      staleScore,
      stabilityDays,
      difficulty,
      retrievability,
      retrievabilityPercent: Math.round(retrievability * 100),
      desiredRetention,
      isRisk,
      learningPhase,
      lapses,
      weightedScore: 0
    };
    stats.weightedScore = computeWeightedQuizScore(stats);
    return stats;
  }

  function computeAllWordStats() {
    return app.words.map(computeWordStats);
  }

  function daysBetweenToday(dateValue) {
    const date = parseLocalDay(dateValue);
    if (!date) return null;

    const today = parseLocalDay(todayString());
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((today.getTime() - date.getTime()) / msPerDay);
  }

  function computeWeightedQuizScore(stats) {
    const wrongRateScore = safeNumber(stats.wrongRate) * 6;
    const missVolumeScore = Math.min(3, Math.log1p(safeNumber(stats.missCount)));
    const dueScore = stats.isDue ? 4 : 0;
    const priorityScore = Math.min(4, safeNumber(stats.priority || 1) * 0.7);
    const totalWrongScore = Math.min(3, safeNumber(stats.totalWrong) * 0.4);
    const unseenBoost = stats.totalAttempts === 0 ? 2 : 0;
    const recentMissScore = Number.isFinite(Number(stats.recentMissScore))
      ? Number(stats.recentMissScore)
      : scoreRecentMiss(stats.lastMissAt);
    const staleScore = Number.isFinite(Number(stats.staleScore))
      ? Number(stats.staleScore)
      : scoreStaleness(stats.daysSinceLastSeen, stats.totalAttempts);
    const lowRetrievabilityScore = Math.max(0, safeNumber(stats.desiredRetention) - safeNumber(stats.retrievability)) * 10;
    const lapseScore = Math.min(3, safeNumber(stats.lapses) * 0.8);
    const learningBoost = ["new", "learning", "relearning"].includes(stats.learningPhase) ? 1.5 : 0;
    const correctPenalty = Math.min(2, safeNumber(stats.consecutiveCorrect) * 0.35);
    const score = 1
      + wrongRateScore
      + missVolumeScore
      + dueScore
      + priorityScore
      + totalWrongScore
      + unseenBoost
      + recentMissScore
      + staleScore
      + lowRetrievabilityScore
      + lapseScore
      + learningBoost
      - correctPenalty;

    return Math.max(0.2, score);
  }

  function sampleWeightedWords(count, options = {}) {
    const sourceWords = Array.isArray(options.candidates)
      ? options.candidates.slice()
      : options.deckId && options.deckId !== "all"
        ? getWordsForDeck(options.deckId)
        : app.words.slice();
    const target = clampCountForTotal(count, sourceWords.length);
    if (target === 0) return [];

    const candidates = sourceWords.map(computeWordStats);
    const selected = [];
    while (selected.length < target && candidates.length > 0) {
      const totalWeight = candidates.reduce((sum, candidate) => {
        const weight = Number(candidate.weightedScore);
        return sum + (Number.isFinite(weight) && weight > 0 ? weight : 0);
      }, 0);
      let selectedIndex = -1;

      if (totalWeight > 0) {
        const pick = Math.random() * totalWeight;
        let cumulative = 0;
        selectedIndex = candidates.findIndex((candidate) => {
          const weight = Number(candidate.weightedScore);
          cumulative += Number.isFinite(weight) && weight > 0 ? weight : 0;
          return cumulative >= pick;
        });
      }

      if (selectedIndex < 0) {
        selectedIndex = Math.floor(Math.random() * candidates.length);
      }

      const [candidate] = candidates.splice(selectedIndex, 1);
      selected.push(candidate.entry);
    }

    return selected;
  }

  function clampQuizCount(value) {
    return clampCountForTotal(value, app.words.length);
  }

  function clampCountForTotal(value, total) {
    if (total <= 0) return 0;

    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) {
      return Math.min(10, total);
    }
    return Math.min(total, Math.max(1, parsed));
  }

  function filterWordStats(statsList, search) {
    const query = String(search || "").trim().toLowerCase();
    if (!query) return statsList.slice();

    return statsList.filter((stats) => {
      const word = String(stats.word || "").toLowerCase();
      const meaning = String(stats.entry.core_meaning_ko || "").toLowerCase();
      return word.includes(query) || meaning.includes(query);
    });
  }

  function sortWordStats(statsList, sortKey) {
    const sorted = statsList.slice();
    sorted.sort((a, b) => {
      if (sortKey === "wrongRate") {
        return compareDesc(a.wrongRate, b.wrongRate)
          || compareDesc(a.missCount, b.missCount)
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "recentMiss") {
        return compareDesc(timestampSortValue(a.lastMissAt), timestampSortValue(b.lastMissAt))
          || compareDesc(a.missCount, b.missCount)
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "retrievability") {
        return compareAsc(a.retrievability, b.retrievability)
          || compareDesc(a.weightedScore, b.weightedScore)
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "risk") {
        return compareDesc(a.isRisk ? 1 : 0, b.isRisk ? 1 : 0)
          || compareAsc(a.retrievability, b.retrievability)
          || compareDesc(a.lapses, b.lapses)
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "stale") {
        return compareDesc(staleSortValue(a.daysSinceLastSeen), staleSortValue(b.daysSinceLastSeen))
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "attempts") {
        return compareDesc(a.totalAttempts, b.totalAttempts)
          || a.word.localeCompare(b.word);
      }
      if (sortKey === "alpha") {
        return a.word.localeCompare(b.word);
      }
      return compareDesc(a.weightedScore, b.weightedScore)
        || compareDesc(a.missCount, b.missCount)
        || a.word.localeCompare(b.word);
    });
    return sorted;
  }

  function latestAttemptTimestamp(attempts) {
    let latest = null;
    attempts.forEach((attempt) => {
      const value = timestampSortValue(attempt.timestamp);
      if (!Number.isFinite(value)) return;
      if (!latest || value > latest.value) {
        latest = { value, timestamp: attempt.timestamp };
      }
    });
    return latest ? latest.timestamp : "";
  }

  function isMissAttempt(attempt) {
    return attempt.verdict === "partial" || attempt.verdict === "wrong" || attempt.verdict === "blank";
  }

  function scoreRecentMiss(lastMissAt) {
    const days = daysBetweenToday(lastMissAt);
    if (days === null) return 0;
    if (days <= 1) return 3;
    if (days <= 3) return 2.5;
    if (days <= 7) return 2;
    if (days <= 14) return 1;
    return 0.4;
  }

  function scoreStaleness(daysSinceLastSeen, totalAttempts) {
    if (daysSinceLastSeen === null) return Number(totalAttempts || 0) === 0 ? 1.5 : 0;
    if (daysSinceLastSeen >= 30) return 2;
    if (daysSinceLastSeen >= 14) return 1.5;
    if (daysSinceLastSeen >= 7) return 1;
    return 0;
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function compareDesc(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) && !Number.isFinite(rightNumber)) return 0;
    if (!Number.isFinite(leftNumber)) return 1;
    if (!Number.isFinite(rightNumber)) return -1;
    return rightNumber - leftNumber;
  }

  function compareAsc(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) && !Number.isFinite(rightNumber)) return 0;
    if (!Number.isFinite(leftNumber)) return 1;
    if (!Number.isFinite(rightNumber)) return -1;
    return leftNumber - rightNumber;
  }

  function timestampSortValue(value) {
    const date = parseLocalDay(value, { keepTime: true });
    return date ? date.getTime() : Number.NEGATIVE_INFINITY;
  }

  function staleSortValue(value) {
    return value === null ? Number.POSITIVE_INFINITY : Number(value);
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
              isFavoriteWord(word.word) ? el("span", { className: "favorite-star", title: "즐겨찾기" }, "★") : null,
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

  function deckWordList(words) {
    const list = el("div", { className: "list" });
    words.forEach((word) => {
      const stats = computeWordStats(word);
      list.append(
        el("button", { className: "row", type: "button", onclick: () => navigate("word", { word: word.word }) }, [
          el("div", { className: "row-main" }, [
            el("p", { className: "row-title" }, [
              isFavoriteWord(word.word) ? el("span", { className: "favorite-star", title: "즐겨찾기" }, "★") : null,
              el("span", {}, word.word),
              word.entry_type === "phrase" ? el("span", { className: "pill" }, "phrase") : null
            ]),
            el("p", { className: "row-subtitle" }, word.core_meaning_ko || word.alt_meanings_ko || ""),
            deckBadgeRow(word)
          ]),
          el("span", { className: "row-meta" }, `시도 ${stats.totalAttempts}`)
        ])
      );
    });
    return list;
  }

  function deckBadgeRow(entry) {
    const deckIds = getWordDeckIds(entry);
    if (deckIds.length === 0) return null;
    return el("div", { className: "deck-badge-row" }, deckIds.map((deckId) => (
      el("span", { className: "deck-badge" }, deckId)
    )));
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
      else if (key === "onkeydown") node.addEventListener("keydown", value);
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
    app.lastQuizSummary = null;
    app.lastQuizAnswerSheet = null;
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
    app.lastQuizSummary = null;
    app.lastQuizAnswerSheet = null;
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

  function parseLocalDay(value, options = {}) {
    if (!value) return null;

    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    if (options.keepTime) {
      return date;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "0%";
    }
    return `${Math.round(number * 100)}%`;
  }

  function formatDecimal(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return (0).toFixed(digits);
    }
    return number.toFixed(digits);
  }

  function formatDays(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "0일";
    }
    return `${formatDecimal(number, 1)}일`;
  }

  function normalizeLearningPhaseValue(value) {
    const phase = String(value || "").trim();
    return ["new", "learning", "review", "mature", "relearning"].includes(phase) ? phase : "";
  }

  function formatLearningPhase(value) {
    const phase = normalizeLearningPhaseValue(value) || "new";
    const labels = {
      new: "신규",
      learning: "학습 중",
      review: "복습",
      mature: "장기 유지",
      relearning: "재학습"
    };
    return labels[phase] || labels.new;
  }

  function formatScore(value) {
    const number = Number(value);
    return (Number.isFinite(number) ? number : 0).toFixed(1);
  }

  function formatDateTimeShort(value) {
    if (!value) return "없음";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "없음";
    }
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
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
