(function () {
  "use strict";

  const data = window.APP_DATA;
  const scoring = window.SCORING;
  const mbtiData = window.MBTI_DATA;
  const SHEET_ENDPOINT = window.SHEET_ENDPOINT || "";
  const app = document.querySelector("#app");
  const toast = document.querySelector("#toast");
  const brand = document.querySelector(".brand");

  const LOADING_MESSAGES = [
    "AI도 준비할 시간이 필요해요",
    "그거 아세요? AI는 잠을 안 자요, 그래도 몸풀기는 필요해요",
    "오늘 만날 질문들을 살짝 훑어보는 중",
    "커피 대신 데이터를 한 잔 마시는 중",
    "사실 이 로딩바는 서두를 필요 없어요",
    "AI: 저 지금 긴장돼요...",
    "옷매무새 다듬고 마이크 테스트 중",
    "TMI: 기다림도 하나의 콘텐츠가 될 수 있어요",
    "신발끈 한 번 더 묶는 중",
    "거의 다 왔어요, 조금만 더 기다려주세요",
  ];

  const BOOT_READY_MESSAGE = "저는 준비됐어요. 당신은 준비되셨나요?";

  const state = {
    screen: "loading",
    nickname: "",
    jobTasks: [],
    mbti: null,
    currentQuestionIndex: 0,
    answers: {},
    feedbackVisible: false,
    optionOrder: {},
    sheetSubmitted: false,
  };

  let preparedResultCardKey = "";
  let preparedResultCardPromise = null;

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const currentQuestion = () => data.questions[state.currentQuestionIndex];

  const chapterFor = (question) =>
    data.chapters.find((chapter) => chapter.id === question.chapter);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2400);
  }

  function focusMain() {
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    if (state.screen === "loading") renderLoading();
    if (state.screen === "welcome") renderWelcome();
    if (state.screen === "profile") renderProfile();
    if (state.screen === "chapter") renderChapterBreak();
    if (state.screen === "quiz") renderQuestion();
    if (state.screen === "result") renderResult();
  }

  function shuffled(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [
        result[randomIndex],
        result[index],
      ];
    }
    return result;
  }

  function initializeOptionOrder() {
    state.optionOrder = Object.fromEntries(
      data.questions.map((question) => {
        const values = question.options.map((option) => option.value);
        let order;
        if (question.type === "ox") {
          order = ["o", "x"].filter((value) => values.includes(value));
        } else if (question.ordered) {
          order = values;
        } else {
          order = shuffled(values);
        }
        return [question.id, order];
      }),
    );
  }

  function orderedOptions(question) {
    const order = state.optionOrder[question.id];
    if (!order) return question.options;
    return order
      .map((value) =>
        question.options.find((option) => option.value === value),
      )
      .filter(Boolean);
  }

  function renderLoading() {
    app.className = "app-shell loading-shell";
    const messages = shuffled(LOADING_MESSAGES);
    app.innerHTML = `
      <section class="boot-card" aria-live="polite">
        <div class="boot-topbar">
          <span class="boot-led" aria-hidden="true"></span>
          <span>AI SYSTEM BOOT</span>
        </div>
        <div class="boot-screen">
          <p class="boot-message" id="boot-message">${escapeHtml(messages[0])}</p>
          <div class="boot-bar-track">
            <div class="boot-bar-fill" id="boot-bar-fill" style="width:0%"></div>
          </div>
          <div class="boot-percent-row">
            <span class="boot-percent" id="boot-percent">0<span>%</span></span>
            <span class="boot-cursor" aria-hidden="true">_</span>
          </div>
        </div>
        <button
          type="button"
          class="primary-button boot-enter-button"
          id="boot-enter-button"
          data-action="welcome"
          hidden
        >
          입장하기
          <span aria-hidden="true">→</span>
        </button>
      </section>
    `;
    runBootSequence(messages);
  }

  function runBootSequence(messages) {
    const totalDuration = 12000;
    const messageInterval = 3000;
    const barFill = document.querySelector("#boot-bar-fill");
    const percentEl = document.querySelector("#boot-percent");
    const messageEl = document.querySelector("#boot-message");
    const enterButton = document.querySelector("#boot-enter-button");
    if (!barFill || !percentEl || !messageEl || !enterButton) return;

    const reducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      barFill.style.width = "100%";
      percentEl.innerHTML = "100<span>%</span>";
      messageEl.textContent = BOOT_READY_MESSAGE;
      enterButton.hidden = false;
      enterButton.classList.add("is-visible");
      return;
    }

    const startTime = performance.now();
    let currentBucket = 0;

    function tick(now) {
      if (state.screen !== "loading") return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      const percent = Math.round(progress * 100);
      barFill.style.width = `${percent}%`;
      percentEl.innerHTML = `${percent}<span>%</span>`;

      const bucket = Math.min(
        Math.floor(elapsed / messageInterval),
        messages.length - 1,
      );
      if (bucket !== currentBucket) {
        currentBucket = bucket;
        messageEl.textContent = messages[bucket];
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        messageEl.textContent = BOOT_READY_MESSAGE;
        enterButton.hidden = false;
        requestAnimationFrame(() => enterButton.classList.add("is-visible"));
      }
    }

    requestAnimationFrame(tick);
  }

  function renderWelcome() {
    app.className = "app-shell welcome-shell";
    app.innerHTML = `
      <section class="welcome-card" aria-labelledby="welcome-title">
        <div class="confetti confetti-one" aria-hidden="true"></div>
        <div class="confetti confetti-two" aria-hidden="true"></div>
        <div class="eyebrow">AI 업무 스타일 진단</div>
        <div class="mascot" aria-hidden="true">
          <span class="mascot-antenna"></span>
          <span class="mascot-face">
            <i></i><i></i>
            <b></b>
          </span>
          <span class="mascot-spark">✦</span>
        </div>
        <h1 id="welcome-title">오늘부터 함께 일할<br /><em>AI 메이트</em>는 누구?</h1>
        <p class="welcome-copy">
          정답을 많이 맞히는 시험이 아니에요.<br />
          지금 나와 가장 가까운 답을 고르면<br />
          나만의 AI 업무 스타일을 알려드릴게요.
        </p>
        <div class="welcome-meta" aria-label="테스트 안내">
          <span>25개 질문</span>
          <span aria-hidden="true">·</span>
          <span>약 10분</span>
          <span aria-hidden="true">·</span>
          <span>모바일 최적화</span>
        </div>
        <button class="primary-button start-button" data-action="start">
          내 AI 업무 스타일 찾기
          <span aria-hidden="true">→</span>
        </button>
        <p class="privacy-note">
          <span aria-hidden="true">🔒</span>
          응답은 다음 교육을 준비하는 목적으로만 기록돼요.
        </p>
      </section>
    `;
  }

  function renderProfile() {
    app.className = "app-shell";
    const taskButtons = data.jobTasks
      .map((task) => {
        const selected = state.jobTasks.includes(task.value);
        return `
          <button
            type="button"
            class="task-card ${selected ? "is-selected" : ""}"
            data-task="${task.value}"
            aria-pressed="${selected}"
          >
            <span aria-hidden="true">${task.icon}</span>
            <span>${task.label}</span>
            <i class="selection-check" aria-hidden="true">✓</i>
          </button>
        `;
      })
      .join("");

    const mbtiButtons = mbtiData.order
      .map((code) => {
        const type = mbtiData.types[code];
        const selected = state.mbti === code;
        return `
          <button
            type="button"
            class="mbti-chip ${selected ? "is-selected" : ""}"
            data-mbti="${code}"
            aria-pressed="${selected}"
          >
            <span aria-hidden="true">${type.emoji}</span>
            <span>${code}</span>
          </button>
        `;
      })
      .join("");
    const mbtiUnknownSelected = state.mbti === "unknown";

    app.innerHTML = `
      <section class="question-card profile-card" aria-labelledby="profile-title">
        <div class="profile-step">시작 전, 잠깐만요</div>
        <h1 id="profile-title">오늘 사용할 이름과<br />자주 하는 일을 알려주세요.</h1>
        <p class="question-helper">결과 카드를 조금 더 나답게 만들어드릴게요.</p>

        <label class="field-label" for="nickname">닉네임</label>
        <div class="text-field-wrap">
          <input
            id="nickname"
            class="text-field"
            type="text"
            minlength="2"
            maxlength="10"
            autocomplete="off"
            placeholder="2~10자로 입력해주세요"
            value="${escapeHtml(state.nickname)}"
          />
          <span class="character-count">${state.nickname.length}/10</span>
        </div>

        <div class="field-heading">
          <span class="field-label">자주 하는 업무</span>
          <span>${state.jobTasks.length}/3 선택</span>
        </div>
        <div class="task-grid" role="group" aria-label="자주 하는 업무, 최대 3개">
          ${taskButtons}
        </div>

        <div class="field-heading">
          <span class="field-label">MBTI (선택)</span>
          <span>결과에 보너스 팁으로만 사용돼요</span>
        </div>
        <div class="mbti-grid" role="group" aria-label="MBTI 선택">
          ${mbtiButtons}
        </div>
        <button
          type="button"
          class="mbti-unknown ${mbtiUnknownSelected ? "is-selected" : ""}"
          data-mbti="unknown"
          aria-pressed="${mbtiUnknownSelected}"
        >
          ${mbtiData.unknownLabel}
        </button>

        <div class="sticky-actions profile-actions">
          <button class="text-button" data-action="welcome">이전</button>
          <button
            class="primary-button compact"
            data-action="begin-quiz"
            ${isProfileValid() ? "" : "disabled"}
          >
            진단 시작하기
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    `;
  }

  function isProfileValid() {
    return (
      state.nickname.trim().length >= 2 &&
      state.jobTasks.length > 0 &&
      Boolean(state.mbti)
    );
  }

  function renderChapterBreak() {
    app.className = "app-shell chapter-shell";
    const question = currentQuestion();
    const chapter = chapterFor(question);
    const chapterQuestions = data.questions.filter(
      (item) => item.chapter === chapter.id,
    );
    const isFirst = chapter.step === 1;
    const completed = state.currentQuestionIndex;
    const progress = (completed / data.questions.length) * 100;
    const stepDots = data.chapters
      .map(
        (item) => `
          <span
            class="${item.step < chapter.step ? "is-done" : ""} ${
              item.step === chapter.step ? "is-current" : ""
            }"
            style="--dot-color:${item.color}"
            aria-label="STEP ${item.step}${item.step === chapter.step ? ", 현재 단계" : ""}"
          ></span>
        `,
      )
      .join("");

    app.innerHTML = `
      <section
        class="chapter-card"
        style="--chapter-color:${chapter.color}"
        aria-labelledby="chapter-title"
      >
        <div class="chapter-orbit orbit-one" aria-hidden="true"></div>
        <div class="chapter-orbit orbit-two" aria-hidden="true"></div>
        <div class="chapter-topline">
          <span>${isFirst ? "첫 번째 챕터" : "여기서 잠깐!"}</span>
          <span>STEP ${chapter.step} / ${data.chapters.length}</span>
        </div>
        <div class="chapter-step-dots" aria-label="전체 STEP 진행 상황">
          ${stepDots}
        </div>
        <img
          class="chapter-illustration"
          src="${chapter.image}"
          alt="${chapter.title}을 표현한 일러스트"
        />
        <div class="chapter-copy">
          <span class="chapter-kicker">${chapter.kicker}</span>
          <h1 id="chapter-title">${chapter.title}</h1>
          <p class="chapter-description">${chapter.description}</p>
          <div class="chapter-pause">
            <span aria-hidden="true">${chapter.step === 3 ? "💡" : chapter.step === 5 ? "🔎" : "✦"}</span>
            <p>${chapter.pause}</p>
          </div>
          <div class="chapter-meta">
            <span>${chapterQuestions.length}개 질문</span>
            <span aria-hidden="true">·</span>
            <span>${chapter.prompt}</span>
          </div>
          <button class="primary-button chapter-button" data-action="start-chapter">
            ${chapter.title} 시작
            <span aria-hidden="true">→</span>
          </button>
        </div>
        ${
          completed
            ? `<div class="chapter-total-progress" aria-label="전체 진단 ${Math.round(
                progress,
              )}% 완료"><span style="width:${progress}%"></span></div>`
            : ""
        }
      </section>
    `;
  }

  function renderQuestion() {
    app.className = "app-shell quiz-shell";
    const question = currentQuestion();
    const chapter = chapterFor(question);
    const answer = state.answers[question.id] || [];
    const selectedValues = Array.isArray(answer) ? answer : [answer];
    const progress = ((state.currentQuestionIndex + 1) / data.questions.length) * 100;
    const countLabel =
      question.type === "multi"
        ? `<span class="selection-counter">${selectedValues.length}${
            question.maxSelections ? `/${question.maxSelections}` : ""
          } 선택</span>`
        : "";

    app.innerHTML = `
      <section class="quiz-frame" aria-labelledby="question-title">
        <div class="progress-header">
          <button class="icon-button" data-action="back" aria-label="이전 질문">
            <span aria-hidden="true">←</span>
          </button>
          <div class="progress-copy">
            <span>${state.currentQuestionIndex + 1} / ${data.questions.length}</span>
            <span>${progressPhrase(state.currentQuestionIndex)}</span>
          </div>
          <span class="chapter-number">STEP ${chapter.step}</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          aria-valuemin="1"
          aria-valuemax="${data.questions.length}"
          aria-valuenow="${state.currentQuestionIndex + 1}"
          aria-label="진단 진행률"
        >
          <span style="width:${progress}%"></span>
        </div>

        <article class="question-card">
          <div class="chapter-label">${chapter.title}</div>
          <div class="question-number">${question.id}</div>
          <h1 id="question-title">${question.title}</h1>
          ${question.helper ? `<p class="question-helper">${question.helper}</p>` : ""}
          ${
            question.scenario
              ? `<blockquote class="scenario">${question.scenario}</blockquote>`
              : ""
          }
          <div class="options-heading">
            <span>${question.type === "multi" ? "복수 선택" : "하나 선택"}</span>
            ${countLabel}
          </div>
          <div
            class="options-list ${question.type === "ox" ? "ox-options" : ""}"
            role="group"
            aria-label="${escapeHtml(question.title)} 선택지"
          >
            ${renderOptions(question, selectedValues)}
          </div>
          ${renderFeedback(question, selectedValues)}
          <div class="sticky-actions">
            <button
              class="primary-button compact"
              data-action="next"
              ${selectedValues.length ? "" : "disabled"}
            >
              ${
                state.feedbackVisible
                  ? state.currentQuestionIndex === data.questions.length - 1
                    ? "내 결과 확인하기"
                    : "다음 질문"
                  : question.correct
                    ? "선택 확인하기"
                    : state.currentQuestionIndex === data.questions.length - 1
                      ? "내 결과 확인하기"
                      : "다음 질문"
              }
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </section>
    `;
  }

  function renderOptions(question, selectedValues) {
    return orderedOptions(question)
      .map((option, index) => {
        const selected = selectedValues.includes(option.value);
        const locked = state.feedbackVisible && Boolean(question.correct);
        const letter = String.fromCharCode(65 + index);
        return `
          <button
            type="button"
            class="option-card ${selected ? "is-selected" : ""} ${
              locked && option.value === question.correct ? "is-correct" : ""
            }"
            data-option="${option.value}"
            aria-pressed="${selected}"
            ${locked ? "disabled" : ""}
          >
            ${
              question.type === "ox"
                ? `<span class="ox-mark">${option.label}</span>`
                : `<span class="option-index">${
                    option.icon || letter
                  }</span><span class="option-label">${option.label}</span>`
            }
            <i class="selection-check" aria-hidden="true">✓</i>
          </button>
        `;
      })
      .join("");
  }

  function renderFeedback(question, selectedValues) {
    if (!state.feedbackVisible || !question.correct) return "";
    const isCorrect = selectedValues.includes(question.correct);
    return `
      <aside class="feedback-card ${isCorrect ? "is-good" : "is-learning"}" aria-live="polite">
        <div class="feedback-icon" aria-hidden="true">${isCorrect ? "✦" : "💡"}</div>
        <div>
          <strong>${
            isCorrect
              ? "좋아요! 핵심 포인트를 정확히 봤어요."
              : "이 문항은 많은 사람이 헷갈려요."
          }</strong>
          <p>${question.explanation}</p>
        </div>
      </aside>
    `;
  }

  function progressPhrase(index) {
    const ratio = index / data.questions.length;
    if (ratio < 0.2) return "AI와 인사 나누는 중";
    if (ratio < 0.45) return "제법 대화가 통하는 중";
    if (ratio < 0.7) return "업무 취향을 파악하는 중";
    if (ratio < 0.92) return "거의 다 알아가는 중";
    return "결과 카드를 만드는 중";
  }

  function handleOption(value) {
    const question = currentQuestion();
    if (state.feedbackVisible && question.correct) return;
    const current = state.answers[question.id] || [];

    if (question.type !== "multi" && question.type !== "ox") {
      state.answers[question.id] = [value];
    } else if (question.type === "ox") {
      state.answers[question.id] = [value];
    } else {
      const option = question.options.find((item) => item.value === value);
      let next = Array.isArray(current) ? [...current] : [];

      if (next.includes(value)) {
        next = next.filter((item) => item !== value);
      } else if (option.exclusive) {
        next = [value];
      } else {
        next = next.filter((item) => {
          const candidate = question.options.find((entry) => entry.value === item);
          return !candidate?.exclusive;
        });
        if (!question.maxSelections || next.length < question.maxSelections) {
          next.push(value);
        } else {
          showToast(`최대 ${question.maxSelections}개까지 선택할 수 있어요.`);
        }
      }
      state.answers[question.id] = next;
    }

    if (question.correct) {
      state.feedbackVisible = true;
    }
    renderQuestion();
  }

  function goNext() {
    const question = currentQuestion();
    const answer = state.answers[question.id] || [];
    if (!answer.length) return;

    if (question.correct && !state.feedbackVisible) {
      state.feedbackVisible = true;
      renderQuestion();
      document.querySelector(".feedback-card")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      return;
    }

    state.feedbackVisible = false;
    if (state.currentQuestionIndex < data.questions.length - 1) {
      const currentChapter = question.chapter;
      state.currentQuestionIndex += 1;
      const nextQuestion = currentQuestion();
      if (nextQuestion.chapter !== currentChapter) {
        state.screen = "chapter";
        renderChapterBreak();
      } else {
        renderQuestion();
      }
      focusMain();
    } else {
      state.screen = "result";
      renderResult();
      focusMain();
    }
  }

  function goBack() {
    state.feedbackVisible = false;
    if (state.currentQuestionIndex === 0) {
      state.screen = "profile";
    } else {
      state.currentQuestionIndex -= 1;
    }
    render();
    focusMain();
  }

  function renderResult() {
    app.className = "app-shell result-shell";
    const result = scoring.calculateResult(state.answers);
    const type = data.resultTypes[result.type];
    const strength = data.dimensions[result.topStrength];
    const growth = data.dimensions[result.growthArea];
    const bars = scoring.dimensionOrder
      .map((key, index) => {
        const dimension = data.dimensions[key];
        const score = result.normalized[key];
        return `
          <div class="skill-row">
            <div class="skill-meta">
              <span><i aria-hidden="true">${dimension.icon}</i>${dimension.label}</span>
              <strong>${scoring.levelLabel(score)}</strong>
            </div>
            <div class="skill-track" aria-label="${dimension.label}: ${scoring.levelLabel(
              score,
            )}">
              <span style="width:${Math.max(
                score,
                4,
              )}%; animation-delay:${index * 90}ms"></span>
            </div>
          </div>
        `;
      })
      .join("");

    const mbtiType =
      state.mbti && state.mbti !== "unknown"
        ? mbtiData.types[state.mbti]
        : null;
    const combo = mbtiType ? mbtiData.getCombo(state.mbti, result.type) : null;
    const mbtiSection = mbtiType
      ? `
        <article class="result-panel mbti-panel">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">BONUS · MBTI</span>
              <h2>${mbtiType.emoji} ${escapeHtml(state.mbti)}인 ${escapeHtml(
                state.nickname,
              )}님에게 추천해요</h2>
            </div>
            <span class="mini-sticker mbti-sticker" aria-hidden="true">${
              mbtiType.emoji
            }</span>
          </div>
          <div class="mbti-badge">${mbtiType.title}</div>
          ${
            combo
              ? `
                <div class="combo-card">
                  <span class="combo-label">${escapeHtml(
                    state.mbti,
                  )} × ${type.name} = ${combo.label}</span>
                  <p class="combo-line">${combo.line}</p>
                </div>
              `
              : ""
          }
          <p>${mbtiType.summary}</p>
          <ul class="mbti-tip-list">
            ${mbtiType.tips.map((tip) => `<li>${tip}</li>`).join("")}
          </ul>
          <p class="mbti-disclaimer">
            MBTI는 재미로 곁들이는 보너스 콘텐츠예요. 위 진단 결과와는 무관해요.
          </p>
        </article>
      `
      : "";

    app.innerHTML = `
      <section
        class="result-page"
        style="--result-color:${type.color}"
      >
        <div class="result-intro">
          <div class="result-kicker">${escapeHtml(state.nickname)}님의 AI 업무 스타일</div>
          <div class="result-character-stage">
            <span class="stage-note stage-note-left" aria-hidden="true">질문 ✓</span>
            <span class="stage-note stage-note-right" aria-hidden="true">검수 ✓</span>
            ${
              type.video
                ? `
                  <video
                    class="result-character result-character-video"
                    autoplay
                    muted
                    loop
                    playsinline
                    preload="auto"
                    poster="${type.image}"
                    tabindex="-1"
                    aria-label="${type.name} 캐릭터 애니메이션"
                    disablepictureinpicture
                  >
                    <source src="${type.video}" type="video/mp4" />
                  </video>
                `
                : `
                  <img
                    class="result-character"
                    src="${type.image}"
                    alt="${type.name} 캐릭터"
                  />
                `
            }
            <span class="stage-spark spark-left" aria-hidden="true">✦</span>
            <span class="stage-spark spark-right" aria-hidden="true">✦</span>
          </div>
          <h1>${type.name}</h1>
          <p>${type.tagline}</p>
          <div class="result-ribbon">${type.cardLine}</div>

          <div class="readiness-row">
            <div
              class="readiness-badge"
              data-readiness="${result.readiness}"
              style="--pct:0"
              role="img"
              aria-label="AI 준비도 0%"
            >
              <span class="readiness-number" aria-hidden="true">0<small>%</small></span>
            </div>
            <div class="readiness-copy">
              <span class="readiness-title">AI 준비도</span>
              <span class="readiness-desc">오늘 답변을 100점 만점으로 환산했어요</span>
            </div>
          </div>
        </div>

        <div class="result-grid">
          <article class="result-panel skill-panel">
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">MY BALANCE</span>
                <h2>나의 AI 협업 밸런스</h2>
              </div>
              <span class="mini-sticker" aria-hidden="true">✦</span>
            </div>
            <div class="skill-list">${bars}</div>
            <p class="score-note">점수는 등수가 아니라 다음 교육을 더 잘 맞추기 위한 참고 지표예요.</p>
          </article>

          <article class="result-panel insight-panel">
            <span class="panel-kicker">STRENGTH</span>
            <h2>${strength.icon} 지금 잘하고 있는 점</h2>
            <p>${type.strength}</p>
            <div class="insight-tag">가장 돋보이는 감각 · ${strength.label}</div>
          </article>

          <article class="result-panel insight-panel growth-panel">
            <span class="panel-kicker">GROWTH POINT</span>
            <h2>${growth.icon} 다음으로 키워볼 점</h2>
            <p>${type.growth}</p>
            <div class="insight-tag">이번 교육의 성장 포인트 · ${growth.label}</div>
          </article>

          ${mbtiSection}

          <article class="result-panel mission-panel">
            <div class="mission-badge">첫 번째 추천 미션</div>
            <h2>${type.missions[0]}</h2>
            <p>오늘 업무에서 10분만 투자해 바로 시도해보세요.</p>
            <ul>
              ${type.missions
                .slice(1)
                .map((mission) => `<li>${mission}</li>`)
                .join("")}
            </ul>
          </article>
        </div>

        <div class="result-actions">
          <button class="primary-button" data-action="share-card" disabled>
            <span aria-hidden="true">↗</span>
            공유 카드 준비 중...
          </button>
          <button class="secondary-button" data-action="restart">
            다시 해보기
          </button>
        </div>

        <p class="result-privacy">
          이 결과는 다음 교육을 준비하는 목적으로 기록돼요.
        </p>
      </section>
    `;

    prepareResultCard()
      .then(() => updateShareButton(true))
      .catch(() => updateShareButton(true));

    playResultReveal(result.readiness);

    if (!state.sheetSubmitted) {
      state.sheetSubmitted = true;
      submitToSheet(buildSheetPayload(result));
    }
  }

  function buildSheetPayload(result) {
    const answerColumns = Object.fromEntries(
      data.questions.map((question) => [
        question.id,
        (state.answers[question.id] || []).join(", "),
      ]),
    );
    const jobTaskLabels = state.jobTasks
      .map(
        (value) =>
          data.jobTasks.find((task) => task.value === value)?.label || value,
      )
      .join(", ");

    return {
      timestamp: new Date().toISOString(),
      nickname: state.nickname,
      jobTasks: jobTaskLabels,
      mbti: state.mbti && state.mbti !== "unknown" ? state.mbti : "",
      ...answerColumns,
      awareness: result.normalized.awareness,
      experience: result.normalized.experience,
      prompting: result.normalized.prompting,
      verification: result.normalized.verification,
      security: result.normalized.security,
      readiness: result.readiness,
      resultType: data.resultTypes[result.type].name,
    };
  }

  function submitToSheet(payload) {
    if (!SHEET_ENDPOINT) return;
    try {
      fetch(SHEET_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (error) {
      // 응답 기록 실패는 진단 결과 화면에 영향을 주지 않습니다.
    }
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function playResultReveal(readiness) {
    const badge = document.querySelector(".readiness-badge");
    if (!badge) return;

    if (prefersReducedMotion()) {
      badge.style.setProperty("--pct", readiness);
      badge.querySelector(".readiness-number").innerHTML =
        `${readiness}<small>%</small>`;
      badge.setAttribute("aria-label", `AI 준비도 ${readiness}%`);
      return;
    }

    const duration = 1100;
    const startDelay = 250;
    const numberEl = badge.querySelector(".readiness-number");
    const startTime = performance.now() + startDelay;
    let vibrated = false;

    function tick(now) {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * readiness);
      badge.style.setProperty("--pct", value);
      numberEl.innerHTML = `${value}<small>%</small>`;

      if (!vibrated) {
        vibrated = true;
        if (navigator.vibrate) navigator.vibrate(12);
      }

      if (progress >= 1) {
        badge.setAttribute("aria-label", `AI 준비도 ${readiness}%`);
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        launchConfetti(document.querySelector(".readiness-row"));
        if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
      }
    }

    requestAnimationFrame(tick);
  }

  function launchConfetti(anchor) {
    if (!anchor || prefersReducedMotion()) return;
    const colors = [
      "var(--lavender)",
      "var(--coral)",
      "var(--mint)",
      "var(--yellow)",
    ];
    const burst = document.createElement("div");
    burst.className = "confetti-burst";
    for (let i = 0; i < 26; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", `${(Math.random() - 0.5) * 240}px`);
      piece.style.setProperty("--rot", `${Math.random() * 520 - 260}deg`);
      piece.style.setProperty("--delay", `${Math.random() * 120}ms`);
      piece.style.setProperty(
        "--duration",
        `${900 + Math.random() * 500}ms`,
      );
      piece.style.background = colors[i % colors.length];
      burst.appendChild(piece);
    }
    anchor.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1700);
  }

  function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(
      x + width,
      y + height,
      x,
      y + height,
      safeRadius,
    );
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }

  function fillRoundedRect(context, x, y, width, height, radius, color) {
    context.fillStyle = color;
    roundedRect(context, x, y, width, height, radius);
    context.fill();
  }

  function drawCenteredLines(
    context,
    text,
    centerX,
    startY,
    maxWidth,
    lineHeight,
    maxLines = 3,
  ) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);

    lines.slice(0, maxLines).forEach((item, index) => {
      context.fillText(item, centerX, startY + index * lineHeight);
    });
    return Math.min(lines.length, maxLines);
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  function drawRoundedImageCover(
    context,
    image,
    x,
    y,
    width,
    height,
    radius,
  ) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;

    context.save();
    roundedRect(context, x, y, width, height, radius);
    context.clip();
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.restore();
  }

  function setFittedFont(
    context,
    text,
    maxWidth,
    maxSize,
    minSize,
    weight,
  ) {
    let size = maxSize;
    const family =
      'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    while (size > minSize) {
      context.font = `${weight} ${size}px ${family}`;
      if (context.measureText(text).width <= maxWidth) break;
      size -= 2;
    }

    return size;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("결과 카드 이미지 생성 실패"));
      }, "image/png");
    });
  }

  async function createResultCard() {
    const result = scoring.calculateResult(state.answers);
    const type = data.resultTypes[result.type];
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const context = canvas.getContext("2d");
    const centerX = canvas.width / 2;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff9f4";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 0.17;
    context.fillStyle = type.color;
    context.beginPath();
    context.arc(60, 105, 235, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(1050, 1600, 270, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;

    context.shadowColor = "rgba(57, 43, 79, 0.13)";
    context.shadowBlur = 36;
    context.shadowOffsetY = 18;
    fillRoundedRect(context, 54, 54, 972, 1812, 52, "#ffffff");
    context.shadowColor = "transparent";

    fillRoundedRect(context, 270, 104, 540, 70, 35, "#f4f2f6");
    context.fillStyle = "#55536a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    setFittedFont(
      context,
      `${state.nickname}님의 AI 업무 스타일`,
      480,
      28,
      22,
      800,
    );
    context.fillText(
      `${state.nickname}님의 AI 업무 스타일`,
      centerX,
      139,
    );

    fillRoundedRect(context, 185, 236, 740, 1050, 230, type.color);
    const characterImage = await loadImage(type.image);
    drawRoundedImageCover(
      context,
      characterImage,
      170,
      220,
      740,
      1050,
      230,
    );

    context.fillStyle = type.color;
    context.font =
      '900 46px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText("✦", 132, 260);
    context.font =
      '900 34px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText("✦", 946, 390);

    context.fillStyle = "#25243a";
    setFittedFont(context, type.name, 900, 86, 56, 900);
    context.fillText(type.name, centerX, 1375);

    context.fillStyle = "#55536a";
    context.font =
      '600 32px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawCenteredLines(
      context,
      type.tagline,
      centerX,
      1485,
      850,
      48,
      3,
    );

    fillRoundedRect(context, 130, 1625, 820, 170, 36, "#fff0ec");
    context.fillStyle = "#25243a";
    context.font =
      '800 29px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawCenteredLines(
      context,
      type.cardLine,
      centerX,
      1684,
      720,
      44,
      2,
    );

    context.fillStyle = "#8f8999";
    context.font =
      '800 23px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText("AI 업무 메이트 찾기  ✦", centerX, 1830);

    const blob = await canvasToBlob(canvas);
    const safeTypeName = type.name.replace(/\s+/g, "-");
    return {
      blob,
      filename: `AI-업무-메이트-결과-${safeTypeName}.png`,
      title: `${state.nickname}님의 ${type.name}`,
      text: type.cardLine,
    };
  }

  function resultCardKey() {
    const result = scoring.calculateResult(state.answers);
    const scores = scoring.dimensionOrder
      .map((key) => result.normalized[key])
      .join("-");
    return `${state.nickname}-${result.type}-${scores}`;
  }

  function prepareResultCard() {
    const nextKey = resultCardKey();
    if (
      preparedResultCardPromise &&
      preparedResultCardKey === nextKey
    ) {
      return preparedResultCardPromise;
    }

    preparedResultCardKey = nextKey;
    preparedResultCardPromise = createResultCard().catch((error) => {
      preparedResultCardPromise = null;
      throw error;
    });
    return preparedResultCardPromise;
  }

  function updateShareButton(isReady) {
    const button = document.querySelector('[data-action="share-card"]');
    if (!button) return;
    button.disabled = !isReady;
    button.innerHTML = `
      <span aria-hidden="true">↗</span>
      결과 공유하기
    `;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function shareResultCard() {
    const button = document.querySelector('[data-action="share-card"]');
    const previousLabel = button?.innerHTML;
    let card;

    if (button) {
      button.disabled = true;
      button.textContent = "공유창을 여는 중...";
    }

    try {
      card = await prepareResultCard();
      const supportsFileShare =
        typeof File === "function" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function";

      if (supportsFileShare) {
        const file = new File([card.blob], card.filename, {
          type: "image/png",
        });

        if (navigator.canShare({ files: [file] })) {
          const pageUrl = window.location.href.split("#")[0];
          await navigator.share({
            files: [file],
            title: card.title,
            text: `${card.text}\n${pageUrl}`,
          });
          showToast("결과 카드를 공유했어요.");
          return;
        }
      }

      downloadBlob(card.blob, card.filename);
      showToast("공유 기능을 지원하지 않아 PNG로 저장했어요.");
    } catch (error) {
      if (error?.name === "AbortError") return;

      if (card?.blob) {
        downloadBlob(card.blob, card.filename);
        showToast("공유창을 열지 못해 PNG로 저장했어요.");
        return;
      }

      showToast(
        window.location.protocol === "file:"
          ? "공유 기능은 로컬 서버나 GitHub Pages에서 이용해주세요."
          : "결과 카드를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = previousLabel;
      }
    }
  }

  function restart() {
    state.screen = "welcome";
    state.nickname = "";
    state.jobTasks = [];
    state.mbti = null;
    state.currentQuestionIndex = 0;
    state.answers = {};
    state.feedbackVisible = false;
    state.optionOrder = {};
    state.sheetSubmitted = false;
    preparedResultCardKey = "";
    preparedResultCardPromise = null;
    render();
    focusMain();
  }

  app.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    const optionTarget = event.target.closest("[data-option]");
    const taskTarget = event.target.closest("[data-task]");
    const mbtiTarget = event.target.closest("[data-mbti]");

    if (optionTarget) {
      handleOption(optionTarget.dataset.option);
      return;
    }

    if (taskTarget) {
      const value = taskTarget.dataset.task;
      if (state.jobTasks.includes(value)) {
        state.jobTasks = state.jobTasks.filter((item) => item !== value);
      } else if (state.jobTasks.length < 3) {
        state.jobTasks.push(value);
      } else {
        showToast("자주 하는 업무는 최대 3개까지 선택할 수 있어요.");
      }
      renderProfile();
      return;
    }

    if (mbtiTarget) {
      const value = mbtiTarget.dataset.mbti;
      state.mbti = state.mbti === value ? null : value;
      renderProfile();
      return;
    }

    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === "start") {
      state.screen = "profile";
      renderProfile();
      focusMain();
    }
    if (action === "welcome") {
      state.screen = "welcome";
      renderWelcome();
      focusMain();
    }
    if (action === "begin-quiz" && isProfileValid()) {
      if (!Object.keys(state.optionOrder).length) {
        initializeOptionOrder();
      }
      state.screen = "chapter";
      state.currentQuestionIndex = 0;
      renderChapterBreak();
      focusMain();
    }
    if (action === "start-chapter") {
      state.screen = "quiz";
      renderQuestion();
      focusMain();
    }
    if (action === "back") goBack();
    if (action === "next") goNext();
    if (action === "share-card") shareResultCard();
    if (action === "restart") restart();
  });

  app.addEventListener("input", (event) => {
    if (event.target.id !== "nickname") return;
    state.nickname = event.target.value.slice(0, 10);
    const count = document.querySelector(".character-count");
    const beginButton = document.querySelector('[data-action="begin-quiz"]');
    if (count) count.textContent = `${state.nickname.length}/10`;
    if (beginButton) beginButton.disabled = !isProfileValid();
  });

  brand.addEventListener("click", (event) => {
    event.preventDefault();
    restart();
  });

  render();
})();
