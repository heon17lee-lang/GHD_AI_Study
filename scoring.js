(function () {
  "use strict";

  const data = window.APP_DATA;
  const dimensionOrder = [
    "awareness",
    "experience",
    "prompting",
    "verification",
    "security",
  ];

  function scoreQuestion(question, selectedValues) {
    if (!question.dimension || !selectedValues?.length) return 0;

    if (question.scoring === "experienceCount") {
      if (selectedValues.includes("none")) return 0;
      const count = selectedValues.length;
      if (count === 1) return 1;
      if (count === 2) return 2;
      if (count <= 4) return 3;
      if (count <= 6) return 4;
      return 5;
    }

    if (question.scoring === "coreCount") {
      const coreCount = question.options.filter(
        (option) => option.core && selectedValues.includes(option.value),
      ).length;
      if (coreCount <= 1) return 0;
      if (coreCount === 2) return 1;
      if (coreCount === 3) return 2;
      return 3;
    }

    return selectedValues.reduce((total, value) => {
      const option = question.options.find((item) => item.value === value);
      return total + (option?.score || 0);
    }, 0);
  }

  function getResultType(normalized, readiness) {
    const { awareness, experience, prompting, verification, security } =
      normalized;

    if (
      readiness >= 75 &&
      awareness >= 55 &&
      experience >= 55 &&
      prompting >= 55 &&
      verification >= 55 &&
      security >= 55
    ) {
      return "workflow_director";
    }

    if (experience >= 60 && readiness >= 50) {
      return "practical_maker";
    }

    if (
      verification >= 65 &&
      security >= 60 &&
      verification >= prompting
    ) {
      return "quality_editor";
    }

    if (
      prompting >= 65 &&
      prompting > experience &&
      prompting >= verification
    ) {
      return "prompt_designer";
    }

    if (awareness >= 65 && experience < 50) {
      return "curious_explorer";
    }

    return "ai_warmup";
  }

  function calculateResult(answers) {
    const raw = Object.fromEntries(dimensionOrder.map((key) => [key, 0]));

    data.questions.forEach((question) => {
      const selected = answers[question.id] || [];
      if (question.dimension) {
        raw[question.dimension] += scoreQuestion(question, selected);
      }
    });

    const normalized = Object.fromEntries(
      dimensionOrder.map((key) => [
        key,
        Math.round((raw[key] / data.dimensions[key].max) * 100),
      ]),
    );

    const readiness = Math.round(
      normalized.awareness * 0.15 +
        normalized.experience * 0.2 +
        normalized.prompting * 0.25 +
        normalized.verification * 0.25 +
        normalized.security * 0.15,
    );

    const sorted = [...dimensionOrder].sort(
      (a, b) => normalized[b] - normalized[a],
    );

    return {
      raw,
      normalized,
      readiness,
      type: getResultType(normalized, readiness),
      topStrength: sorted[0],
      growthArea: sorted[sorted.length - 1],
    };
  }

  function levelLabel(score) {
    if (score >= 80) return "아주 탄탄해요";
    if (score >= 60) return "제법 익숙해요";
    if (score >= 40) return "가능성이 보여요";
    if (score >= 20) return "천천히 익히는 중";
    return "이제 시작해요";
  }

  window.SCORING = {
    dimensionOrder,
    scoreQuestion,
    getResultType,
    calculateResult,
    levelLabel,
  };
})();
