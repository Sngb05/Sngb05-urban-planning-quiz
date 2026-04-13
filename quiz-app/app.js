(function () {
  const wrongKey = "urban-planning-quiz-wrongs-v1";
  const conceptLinks = {
    "2주차": "./concepts.html#week2",
    "3주차": "./concepts.html#week3",
    "4주차": "./concepts.html#week4",
    "5주차": "./concepts.html#week5",
    "6주차": "./concepts.html#week6"
  };
  const state = {
    mode: "exam",
    scope: "all",
    selectedTypes: new Set(["mcq", "short", "essay"]),
    lastNonKillerTypes: new Set(["mcq", "short", "essay"]),
    selectedWeeks: new Set(["2주차", "3주차", "4주차", "5주차", "6주차"]),
    shuffle: true,
    saveWrongs: true,
    session: null,
    timerHandle: null
  };

  const els = {
    bankCount: document.getElementById("bankCount"),
    setupPanel: document.getElementById("setupPanel"),
    quizPanel: document.getElementById("quizPanel"),
    resultPanel: document.getElementById("resultPanel"),
    modeChips: document.getElementById("modeChips"),
    bankScopeChips: document.getElementById("bankScopeChips"),
    typeToggles: document.getElementById("typeToggles"),
    weekToggles: document.getElementById("weekToggles"),
    shuffleToggle: document.getElementById("shuffleToggle"),
    repeatWrongToggle: document.getElementById("repeatWrongToggle"),
    setupSummary: document.getElementById("setupSummary"),
    startButton: document.getElementById("startButton"),
    startWrongOnlyButton: document.getElementById("startWrongOnlyButton"),
    progressLabel: document.getElementById("progressLabel"),
    questionTitle: document.getElementById("questionTitle"),
    questionMeta: document.getElementById("questionMeta"),
    timer: document.getElementById("timer"),
    quitButton: document.getElementById("quitButton"),
    progressFill: document.getElementById("progressFill"),
    questionType: document.getElementById("questionType"),
    questionPrompt: document.getElementById("questionPrompt"),
    questionChoices: document.getElementById("questionChoices"),
    textAnswerWrap: document.getElementById("textAnswerWrap"),
    essayAnswerWrap: document.getElementById("essayAnswerWrap"),
    textAnswer: document.getElementById("textAnswer"),
    essayAnswer: document.getElementById("essayAnswer"),
    submitButton: document.getElementById("submitButton"),
    sourceLink: document.getElementById("sourceLink"),
    answerPanel: document.getElementById("answerPanel"),
    answerBadge: document.getElementById("answerBadge"),
    answerValue: document.getElementById("answerValue"),
    answerExplain: document.getElementById("answerExplain"),
    essayFeedback: document.getElementById("essayFeedback"),
    nextButton: document.getElementById("nextButton"),
    resultSummary: document.getElementById("resultSummary"),
    resultCorrect: document.getElementById("resultCorrect"),
    resultWrong: document.getElementById("resultWrong"),
    resultRate: document.getElementById("resultRate"),
    reviewList: document.getElementById("reviewList"),
    restartButton: document.getElementById("restartButton"),
    retryWrongButton: document.getElementById("retryWrongButton")
  };

  const questionBank = window.buildQuestionBank(window.QUIZ_FACTS, window.QUIZ_ESSAYS);
  const weeks = [...new Set(questionBank.map((question) => question.week))];
  const searchParams = new URLSearchParams(window.location.search);

  init();

  function init() {
    els.bankCount.textContent = `${questionBank.length}문항`;
    applyUrlPreset();
    renderModeChips();
    renderBankScopeChips();
    renderTypeToggles();
    renderWeekToggles();
    bindEvents();
    refreshSetupSummary();
    if (searchParams.get("autostart") === "1") {
      window.addEventListener("load", () => {
        window.setTimeout(() => {
          startSession(searchParams.get("wrongOnly") === "1");
        }, 120);
      }, { once: true });
    }
  }

  function applyUrlPreset() {
    const mode = searchParams.get("mode");
    if (mode === "exam" || mode === "practice") {
      state.mode = mode;
    }

    const scope = searchParams.get("scope");
    if (scope === "all" || scope === "killer") {
      state.scope = scope;
    }

    const types = searchParams.get("types");
    if (types) {
      const nextTypes = new Set(types.split(",").map((item) => item.trim()).filter((item) => ["mcq", "short", "essay"].includes(item)));
      if (nextTypes.size) {
        state.selectedTypes = nextTypes;
      }
    }

    state.lastNonKillerTypes = new Set(state.selectedTypes);

    const weeksParam = searchParams.get("weeks");
    if (weeksParam) {
      const nextWeeks = new Set(weeksParam.split(",").map((item) => decodeURIComponent(item.trim())));
      const validWeeks = new Set(weeks.filter((week) => nextWeeks.has(week)));
      if (validWeeks.size) {
        state.selectedWeeks = validWeeks;
      }
    }

    const shuffle = searchParams.get("shuffle");
    if (shuffle === "0") {
      state.shuffle = false;
      els.shuffleToggle.checked = false;
    }

    const saveWrongs = searchParams.get("saveWrongs");
    if (saveWrongs === "0") {
      state.saveWrongs = false;
      els.repeatWrongToggle.checked = false;
    }

    enforceScopeConstraints();
  }

  function enforceScopeConstraints() {
    if (state.scope === "killer") {
      state.selectedTypes = new Set(["mcq"]);
      return;
    }
    state.selectedTypes = new Set(state.lastNonKillerTypes.size ? state.lastNonKillerTypes : ["mcq", "short", "essay"]);
  }

  function setScope(scope) {
    if (scope === state.scope) {
      return;
    }
    if (scope === "killer") {
      state.lastNonKillerTypes = new Set(state.selectedTypes);
    }
    state.scope = scope;
    enforceScopeConstraints();
    renderBankScopeChips();
    renderTypeToggles();
    refreshSetupSummary();
  }

  function bindEvents() {
    els.shuffleToggle.addEventListener("change", () => {
      state.shuffle = els.shuffleToggle.checked;
      refreshSetupSummary();
    });
    els.repeatWrongToggle.addEventListener("change", () => {
      state.saveWrongs = els.repeatWrongToggle.checked;
      refreshSetupSummary();
    });
    els.startButton.addEventListener("click", () => startSession(false));
    els.startWrongOnlyButton.addEventListener("click", () => startSession(true));
    els.quitButton.addEventListener("click", restartToSetup);
    els.submitButton.addEventListener("click", submitTextQuestion);
    els.nextButton.addEventListener("click", nextQuestion);
    els.restartButton.addEventListener("click", restartToSetup);
    els.retryWrongButton.addEventListener("click", () => {
      restartToSetup();
      startSession(true);
    });
    els.textAnswer.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitTextQuestion();
      }
    });
  }

  function renderModeChips() {
    const modes = [
      { id: "exam", label: "실전 모드", desc: "75분 카운트다운" },
      { id: "practice", label: "연습 모드", desc: "시간 제한 없음" }
    ];
    els.modeChips.innerHTML = "";
    modes.forEach((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${state.mode === mode.id ? " is-active" : ""}`;
      button.innerHTML = `<strong>${mode.label}</strong><span>${mode.desc}</span>`;
      button.addEventListener("click", () => {
        state.mode = mode.id;
        renderModeChips();
        refreshSetupSummary();
      });
      els.modeChips.appendChild(button);
    });
  }

  function renderBankScopeChips() {
    const scopes = [
      { id: "all", label: "전체 문제", desc: "기존 문제은행 전체" },
      { id: "killer", label: "킬러 50", desc: "고난도 객관식만" }
    ];
    els.bankScopeChips.innerHTML = "";
    scopes.forEach((scope) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${state.scope === scope.id ? " is-active" : ""}`;
      button.innerHTML = `<strong>${scope.label}</strong><span>${scope.desc}</span>`;
      button.addEventListener("click", () => {
        setScope(scope.id);
      });
      els.bankScopeChips.appendChild(button);
    });
  }

  function renderTypeToggles() {
    const isLocked = state.scope === "killer";
    renderToggleGroup(els.typeToggles, [
      { id: "mcq", label: "객관식", locked: isLocked },
      { id: "short", label: "단답형", locked: isLocked },
      { id: "essay", label: "서술형", locked: isLocked }
    ], state.selectedTypes, renderTypeToggles);
  }

  function renderWeekToggles() {
    renderToggleGroup(els.weekToggles, weeks.map((week) => ({ id: week, label: week })), state.selectedWeeks, renderWeekToggles);
  }

  function renderToggleGroup(target, items, selectedSet, rerender) {
    target.innerHTML = "";
    items.forEach((item) => {
      const label = document.createElement("label");
      label.className = `toggle-pill${selectedSet.has(item.id) ? " is-active" : ""}${item.locked ? " is-locked" : ""}`;
      label.setAttribute("aria-disabled", item.locked ? "true" : "false");
      label.innerHTML = `<input type="checkbox" ${selectedSet.has(item.id) ? "checked" : ""}><span>${item.label}</span>`;
      label.addEventListener("click", (event) => {
        if (item.locked) {
          event.preventDefault();
          return;
        }
        toggleInSet(selectedSet, item.id);
        if (selectedSet.size === 0) {
          selectedSet.add(item.id);
        }
        if (target === els.typeToggles && state.scope !== "killer") {
          state.lastNonKillerTypes = new Set(selectedSet);
        }
        rerender();
        refreshSetupSummary();
      });
      target.appendChild(label);
    });
  }

  function refreshSetupSummary() {
    const filtered = filterBank(questionBank);
    const counts = filtered.reduce((acc, question) => {
      acc[question.kind] = (acc[question.kind] || 0) + 1;
      return acc;
    }, {});
    els.setupSummary.textContent = [
      `${scopeLabel()} · ${state.mode === "exam" ? "75분 실전 모드" : "연습 모드"} · 총 ${filtered.length}문항`,
      `객관식 ${counts.mcq || 0} / 단답형 ${counts.short || 0} / 서술형 ${counts.essay || 0}`,
      `오답노트 ${state.saveWrongs ? "저장" : "비저장"} · 저장된 오답 ${readWrongs().length}문항`
    ].join(" | ");
  }

  function startSession(wrongOnly) {
    let questions = filterBank(questionBank);
    if (wrongOnly) {
      const wrongSet = new Set(readWrongs());
      questions = questions.filter((question) => wrongSet.has(question.id));
    }
    if (!questions.length) {
      window.alert(wrongOnly ? "저장된 오답 문항이 없습니다." : "선택한 조건에 맞는 문항이 없습니다.");
      return;
    }
    state.session = {
      questions: state.shuffle ? shuffle(questions) : questions.slice(),
      index: 0,
      correct: 0,
      wrong: 0,
      answers: [],
      deadline: state.mode === "exam" ? Date.now() + 75 * 60 * 1000 : null
    };
    els.setupPanel.classList.add("is-hidden");
    els.resultPanel.classList.add("is-hidden");
    els.quizPanel.classList.remove("is-hidden");
    startTimer();
    renderQuestion();
  }

  function restartToSetup() {
    stopTimer();
    state.session = null;
    els.setupPanel.classList.remove("is-hidden");
    els.quizPanel.classList.add("is-hidden");
    els.resultPanel.classList.add("is-hidden");
    clearAnswerPanel();
    refreshSetupSummary();
  }

  function startTimer() {
    stopTimer();
    updateTimer();
    state.timerHandle = window.setInterval(updateTimer, 1000);
  }

  function stopTimer() {
    if (state.timerHandle) {
      window.clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }

  function updateTimer() {
    if (!state.session || !state.session.deadline) {
      els.timer.textContent = state.mode === "exam" ? "75:00" : "연습 모드";
      return;
    }
    const remaining = Math.max(0, state.session.deadline - Date.now());
    const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
    const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    els.timer.textContent = `${mm}:${ss}`;
    if (remaining === 0) {
      finishSession();
    }
  }

  function renderQuestion() {
    const session = state.session;
    const question = session.questions[session.index];
    const pos = session.index + 1;
    const total = session.questions.length;
    clearAnswerPanel();
    clearInputState();
    els.progressLabel.textContent = `${pos} / ${total}`;
    els.progressFill.style.width = `${(pos / total) * 100}%`;
    els.questionTitle.textContent = `${question.week} · ${question.section}`;
    els.questionMeta.textContent = `${question.page ? `기준 p.${question.page}` : "페이지 정보 없음"} · ${typeLabel(question.kind)}`;
    els.questionType.textContent = typeLabel(question.kind);
    els.questionPrompt.textContent = question.prompt;
    const conceptLink = conceptLinks[question.week];
    els.sourceLink.classList.toggle("is-hidden", !conceptLink);
    if (conceptLink) {
      els.sourceLink.href = conceptLink;
    } else {
      els.sourceLink.removeAttribute("href");
    }
    els.questionChoices.innerHTML = "";
    if (question.kind === "mcq") {
      question.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = `${String.fromCharCode(9312 + index)} ${option}`;
        button.addEventListener("click", () => evaluateMcq(question, option, button));
        els.questionChoices.appendChild(button);
      });
      els.submitButton.classList.add("is-hidden");
      els.textAnswerWrap.classList.add("is-hidden");
      els.essayAnswerWrap.classList.add("is-hidden");
    } else if (question.kind === "short") {
      els.textAnswerWrap.classList.remove("is-hidden");
      els.essayAnswerWrap.classList.add("is-hidden");
      els.submitButton.classList.remove("is-hidden");
      els.textAnswer.focus();
    } else {
      els.textAnswerWrap.classList.add("is-hidden");
      els.essayAnswerWrap.classList.remove("is-hidden");
      els.submitButton.classList.remove("is-hidden");
      els.essayAnswer.focus();
    }
  }

  function evaluateMcq(question, selected, button) {
    if (!state.session || !els.answerPanel.classList.contains("is-hidden")) {
      return;
    }
    const isCorrect = normalize(selected) === normalize(question.answer);
    [...els.questionChoices.querySelectorAll(".choice")].forEach((choice) => {
      choice.disabled = true;
      const text = choice.textContent.replace(/^[①-⑳]\s*/, "").trim();
      if (normalize(text) === normalize(question.answer)) {
        choice.classList.add("is-correct");
      }
    });
    if (!isCorrect) {
      button.classList.add("is-wrong");
    }
    finalizeAnswer(question, isCorrect, selected);
  }

  function submitTextQuestion() {
    if (!state.session || !els.answerPanel.classList.contains("is-hidden")) {
      return;
    }
    const question = state.session.questions[state.session.index];
    if (question.kind === "short") {
      const value = els.textAnswer.value.trim();
      if (!value) {
        return;
      }
      const normalizedValue = normalize(value);
      const isCorrect = question.accepted.some((answer) => {
        const normalizedAnswer = normalize(answer);
        return normalizedValue === normalizedAnswer || normalizedValue.includes(normalizedAnswer);
      });
      finalizeAnswer(question, isCorrect, value);
    } else {
      const value = els.essayAnswer.value.trim();
      if (!value) {
        return;
      }
      const feedback = scoreEssay(question, value);
      finalizeAnswer(question, feedback.isCorrect, value, feedback.text);
    }
  }

  function finalizeAnswer(question, isCorrect, userAnswer, extraFeedback) {
    const session = state.session;
    els.submitButton.disabled = true;
    els.textAnswer.disabled = true;
    els.essayAnswer.disabled = true;
    if (isCorrect) {
      session.correct += 1;
      if (state.saveWrongs) {
        removeWrong(question.id);
      }
    } else {
      session.wrong += 1;
      if (state.saveWrongs) {
        saveWrong(question.id);
      }
    }
    session.answers.push({
      id: question.id,
      week: question.week,
      section: question.section,
      page: question.page,
      prompt: question.prompt,
      answer: question.answer,
      explanation: question.explanation,
      userAnswer,
      isCorrect
    });
    els.answerPanel.classList.remove("is-hidden");
    els.answerPanel.dataset.status = isCorrect ? "correct" : "wrong";
    els.answerBadge.textContent = isCorrect ? "정답!" : "오답!";
    els.answerValue.textContent = question.answer;
    els.answerExplain.textContent = question.explanation;
    if (extraFeedback) {
      els.essayFeedback.classList.remove("is-hidden");
      els.essayFeedback.textContent = extraFeedback;
    }
  }

  function nextQuestion() {
    state.session.index += 1;
    if (state.session.index >= state.session.questions.length) {
      finishSession();
      return;
    }
    renderQuestion();
  }

  function finishSession() {
    stopTimer();
    if (!state.session) {
      return;
    }
    const total = state.session.questions.length;
    const rate = total ? Math.round((state.session.correct / total) * 100) : 0;
    els.quizPanel.classList.add("is-hidden");
    els.resultPanel.classList.remove("is-hidden");
    els.resultCorrect.textContent = String(state.session.correct);
    els.resultWrong.textContent = String(state.session.wrong);
    els.resultRate.textContent = `${rate}%`;
    els.resultSummary.textContent = `총 ${total}문항을 풀었고 정답 ${state.session.correct}문항, 오답 ${state.session.wrong}문항입니다.`;
    renderReviewList(state.session.answers.filter((item) => !item.isCorrect));
  }

  function renderReviewList(items) {
    els.reviewList.innerHTML = "";
    if (!items.length) {
      els.reviewList.innerHTML = `<div class="review-item"><p class="review-item__prompt">오답이 없습니다. 같은 범위를 한 번 더 돌리면 기억을 더 고정할 수 있습니다.</p></div>`;
      return;
    }
    items.slice(0, 30).forEach((item) => {
      const article = document.createElement("article");
      article.className = "review-item";
      article.innerHTML = `
        <p class="review-item__meta">${item.week} · ${item.section} · ${item.page ? `기준 p.${item.page}` : "페이지 없음"}</p>
        <p class="review-item__prompt">${item.prompt}</p>
        <p class="review-item__answer"><strong>정답:</strong> ${item.answer}</p>
        <p class="review-item__answer"><strong>해설:</strong> ${item.explanation}</p>
      `;
      els.reviewList.appendChild(article);
    });
  }

  function filterBank(bank) {
    return bank.filter((question) => {
      const matchesType = state.selectedTypes.has(question.kind);
      const matchesWeek = state.selectedWeeks.has(question.week);
      const matchesScope = state.scope === "killer" ? Boolean(question.isKiller) : true;
      return matchesType && matchesWeek && matchesScope;
    });
  }

  function scopeLabel() {
    return state.scope === "killer" ? "킬러 50 전용" : "전체 문제";
  }

  function clearInputState() {
    els.textAnswer.value = "";
    els.essayAnswer.value = "";
    els.submitButton.disabled = false;
    els.textAnswer.disabled = false;
    els.essayAnswer.disabled = false;
  }

  function clearAnswerPanel() {
    els.answerPanel.classList.add("is-hidden");
    els.answerPanel.dataset.status = "";
    els.answerValue.textContent = "";
    els.answerExplain.textContent = "";
    els.essayFeedback.classList.add("is-hidden");
    els.essayFeedback.textContent = "";
  }

  function scoreEssay(question, userAnswer) {
    const normalized = normalize(userAnswer);
    const missing = question.keywords.filter((keyword) => !normalized.includes(normalize(keyword)));
    const hitCount = question.keywords.length - missing.length;
    return {
      isCorrect: question.keywords.length ? hitCount / question.keywords.length >= 0.6 : false,
      text: missing.length ? `보완 필요: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " ..." : ""}` : "핵심 키워드를 모두 포함했습니다."
    };
  }

  function normalize(text) {
    return String(text).toLowerCase().replace(/[\s·.,()[\]{}'"“”‘’/\\\-_:;!?]/g, "");
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function toggleInSet(set, value) {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
  }

  function readWrongs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(wrongKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveWrong(id) {
    const next = new Set(readWrongs());
    next.add(id);
    localStorage.setItem(wrongKey, JSON.stringify([...next]));
  }

  function removeWrong(id) {
    const next = new Set(readWrongs());
    next.delete(id);
    localStorage.setItem(wrongKey, JSON.stringify([...next]));
  }

  function typeLabel(kind) {
    return { mcq: "객관식", short: "주관식 단답형", essay: "주관식 서술형" }[kind];
  }

})();
