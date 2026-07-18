import { COURSE, PEP_TALKS, audioPath, correctPosition } from "./data.js";

const $ = (id) => document.getElementById(id);
const optionLetters = ["A", "B", "C"];

const elements = {
  testLabel: $("testLabel"),
  scoreLabel: $("scoreLabel"),
  progressFill: $("progressFill"),
  instruction: $("instruction"),
  questionCard: $("questionCard"),
  questionListen: $("questionListen"),
  questionText: $("questionText"),
  options: optionLetters.map((_, index) => ({
    card: $(`option${index}Card`),
    listen: $(`option${index}Listen`),
    choose: $(`option${index}Choose`),
    text: $(`option${index}Text`)
  })),
  backButton: $("backButton"),
  restartButton: $("restartButton"),
  nextButton: $("nextButton"),
  themeButton: $("themeButton"),
  finishScreen: $("finishScreen"),
  finishKicker: $("finishKicker"),
  finishCopy: $("finishCopy"),
  pepTalk: $("pepTalk"),
  completionValue: $("completionValue"),
  accuracyValue: $("accuracyValue"),
  continueTestButton: $("continueTestButton"),
  practiseAgainButton: $("practiseAgainButton")
};

const storageKey = "ielts-listening-paraphrase-v3";
const autoAdvanceDelay = 900;
const stored = readStoredState();
const audioPool = new Map();
let feedbackContext = null;
let autoAdvanceTimer = null;
const state = {
  testIndex: Math.min(Math.max(stored.testIndex ?? 0, 0), COURSE.tests.length - 1),
  drillIndex: 0,
  results: stored.results ?? {},
  heard: { question: false, options: [false, false, false] },
  locked: false,
  firstTry: true,
  lastFeedback: null,
  activeAudio: null,
  activeCard: null
};
state.drillIndex = Math.min(
  Math.max(stored.drillIndex ?? 0, 0),
  currentTest().drills.length - 1
);

const feedbackSounds = {
  correct: primeClip("/sfx/correct.mp3"),
  wrong: primeClip("/sfx/wrong.mp3")
};
Object.values(feedbackSounds).forEach((audio) => {
  audio.preload = "auto";
  audio.volume = 0.9;
});

function readStoredState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      testIndex: state.testIndex,
      drillIndex: state.drillIndex,
      results: state.results
    })
  );
}

function currentTest() {
  return COURSE.tests[state.testIndex];
}

function currentDrill() {
  return currentTest().drills[state.drillIndex];
}

function currentPart() {
  return currentTest().parts.find((part) => part.number === currentDrill().part);
}

function currentOptions() {
  const drill = currentDrill();
  const distractors =
    state.drillIndex % 2 === 0
      ? [drill.distractor, drill.distractor2]
      : [drill.distractor2, drill.distractor];
  const options = distractors.map((text) => ({ text, correct: false }));
  options.splice(correctPosition(state.drillIndex), 0, { text: drill.answer, correct: true });
  return options;
}

function clearAutoAdvance() {
  if (autoAdvanceTimer === null) return;
  window.clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = null;
}

function scheduleAutoAdvance() {
  clearAutoAdvance();
  const testId = currentTest().id;
  const drillId = currentDrill().id;
  autoAdvanceTimer = window.setTimeout(() => {
    autoAdvanceTimer = null;
    if (state.locked && currentTest().id === testId && currentDrill().id === drillId) {
      nextDrill();
    }
  }, autoAdvanceDelay);
}

function completedCount(test = currentTest()) {
  return test.drills.filter((drill) => state.results[drill.id]?.completed).length;
}

function firstAttemptCount(test = currentTest()) {
  return test.drills.filter(
    (drill) => state.results[drill.id]?.completed && state.results[drill.id]?.firstTryCorrect
  ).length;
}

function primeClip(src) {
  if (audioPool.has(src)) return audioPool.get(src);
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = src;
  audio.load();
  audioPool.set(src, audio);
  return audio;
}

function stopAudio() {
  state.activeAudio?.pause();
  if (state.activeAudio) {
    state.activeAudio.currentTime = 0;
    state.activeAudio.onended = null;
    state.activeAudio.onerror = null;
  }
  state.activeCard?.classList.remove("is-playing");
  state.activeAudio = null;
  state.activeCard = null;
}

function setInstruction(message, tone = "") {
  elements.instruction.textContent = message;
  elements.instruction.dataset.tone = tone;
}

function concealTerm(element, text = "") {
  element.textContent = text;
  element.style.setProperty("display", "none", "important");
  element.style.removeProperty("opacity");
  element.style.removeProperty("visibility");
  element.style.removeProperty("transform");
  element.hidden = true;
}

function revealTerm(element, text) {
  element.textContent = text;
  element.hidden = false;
  element.style.setProperty("display", "block", "important");
  element.style.setProperty("opacity", "1", "important");
  element.style.setProperty("visibility", "visible", "important");
  element.style.setProperty("transform", "translateY(0)", "important");
}

function playFeedbackFallback(kind) {
  const sound = feedbackSounds[kind];
  sound.pause();
  sound.currentTime = 0;
  sound.volume = 1;
  sound.play().catch(() => {});
}

function playFeedback(kind) {
  state.lastFeedback = kind;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    playFeedbackFallback(kind);
    return;
  }

  try {
    if (!feedbackContext || feedbackContext.state === "closed") {
      feedbackContext = new AudioContextClass();
    }

    const ring = () => {
      const start = feedbackContext.currentTime + 0.008;
      const correct = kind === "correct";
      const tones = correct
        ? [
            { frequency: 783.99, delay: 0, duration: 0.18 },
            { frequency: 1174.66, delay: 0.12, duration: 0.34 }
          ]
        : [
            { frequency: 329.63, delay: 0, duration: 0.18 },
            { frequency: 246.94, delay: 0.13, duration: 0.34 }
          ];
      const master = feedbackContext.createGain();
      master.gain.setValueAtTime(correct ? 0.48 : 0.42, start);
      master.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);
      master.connect(feedbackContext.destination);

      tones.forEach(({ frequency, delay, duration }) => {
        const oscillator = feedbackContext.createOscillator();
        const envelope = feedbackContext.createGain();
        const toneStart = start + delay;
        oscillator.type = correct ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, toneStart);
        envelope.gain.setValueAtTime(0.0001, toneStart);
        envelope.gain.exponentialRampToValueAtTime(1, toneStart + 0.012);
        envelope.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(toneStart);
        oscillator.stop(toneStart + duration + 0.02);
      });
    };

    if (feedbackContext.state === "suspended") {
      feedbackContext.resume().then(ring).catch(() => playFeedbackFallback(kind));
    } else {
      ring();
    }
  } catch {
    playFeedbackFallback(kind);
  }
}

async function playClip(card, src, onFinished) {
  stopAudio();
  const audio = primeClip(src);
  state.activeAudio = audio;
  state.activeCard = card;
  audio.currentTime = 0;
  audio.volume = 1;
  card.classList.add("is-playing");
  setInstruction("Listening");

  audio.onended = () => {
    card.classList.remove("is-playing");
    state.activeAudio = null;
    state.activeCard = null;
    onFinished();
    updateChoiceState();
  };
  audio.onerror = () => {
    card.classList.remove("is-playing");
    state.activeAudio = null;
    state.activeCard = null;
    setInstruction("Audio unavailable — try again", "wrong");
  };

  try {
    await audio.play();
  } catch {
    card.classList.remove("is-playing");
    state.activeCard = null;
    setInstruction("Tap Listen again", "wrong");
  }
}

function updateChoiceState() {
  const ready = !state.locked;
  elements.options.forEach(({ card, choose }) => {
    choose.disabled = false;
    card.classList.toggle("is-ready", ready);
  });

  if (state.locked) return;
  const heardCount = Number(state.heard.question) + state.heard.options.filter(Boolean).length;
  setInstruction(heardCount > 0 ? "Choose when ready" : "Listen or choose", heardCount > 0 ? "ready" : "");
}

function revealAnswer(selectedIndex, withFeedback = true) {
  const options = currentOptions();
  const selected = options[selectedIndex];
  const drill = currentDrill();
  const firstChoice = !state.locked;

  clearAutoAdvance();
  if (firstChoice) {
    stopAudio();
    state.locked = true;
    state.firstTry = selected.correct;
    const previousResult = state.results[drill.id];
    state.results[drill.id] = previousResult ?? {
      completed: true,
      firstTryCorrect: selected.correct
    };
    saveState();
  }
  if (withFeedback) playFeedback(selected.correct ? "correct" : "wrong");
  revealTerm(elements.questionText, drill.question);
  elements.questionCard.classList.add("is-revealed");
  elements.questionListen.setAttribute("aria-label", `Listen to the word: ${drill.question}`);

  elements.options.forEach(({ card, choose, text, listen }, index) => {
    revealTerm(text, options[index].text);
    card.classList.add("is-revealed");
    card.classList.toggle("is-correct", index === selectedIndex && selected.correct);
    card.classList.toggle("is-wrong", index === selectedIndex && !selected.correct);
    card.classList.toggle("is-distractor", index !== selectedIndex);
    choose.disabled = false;
    listen.setAttribute("aria-label", `Listen to option ${optionLetters[index]}: ${options[index].text}`);
    choose.setAttribute("aria-label", `Option ${optionLetters[index]}: ${options[index].text}`);
  });

  elements.nextButton.disabled = false;
  setInstruction(selected.correct ? "Correct" : "Not quite", selected.correct ? "correct" : "wrong");
  updateProgress();
  navigator.vibrate?.(selected.correct ? 14 : [40, 35, 40]);
  if (selected.correct) scheduleAutoAdvance();
}

function updateProgress() {
  const test = currentTest();
  const currentCompleted = Boolean(state.results[currentDrill().id]?.completed);
  const visibleProgress = currentCompleted
    ? Math.max(completedCount(test), state.drillIndex + 1)
    : completedCount(test);
  elements.scoreLabel.textContent = `${visibleProgress}/${test.total}`;
  elements.progressFill.style.width = `${(visibleProgress / test.total) * 100}%`;
}

function clearCardState(card) {
  card.classList.remove(
    "is-playing",
    "is-ready",
    "is-wrong",
    "is-revealed",
    "is-correct",
    "is-distractor"
  );
}

function drillAudioSources(testIndex, drillIndex) {
  const drill = COURSE.tests[testIndex]?.drills[drillIndex];
  if (!drill) return [];
  const distractors =
    drillIndex % 2 === 0
      ? [drill.distractor, drill.distractor2]
      : [drill.distractor2, drill.distractor];
  const choices = distractors.slice();
  choices.splice(correctPosition(drillIndex), 0, drill.answer);
  return [audioPath("female", drill.question), ...choices.map((text) => audioPath("male", text))];
}

function preloadCurrentAndNext() {
  const nextTestIndex =
    state.drillIndex === currentTest().drills.length - 1 ? state.testIndex + 1 : state.testIndex;
  const nextDrillIndex =
    state.drillIndex === currentTest().drills.length - 1 ? 0 : state.drillIndex + 1;
  [...drillAudioSources(state.testIndex, state.drillIndex), ...drillAudioSources(nextTestIndex, nextDrillIndex)]
    .forEach(primeClip);
}

function render() {
  clearAutoAdvance();
  stopAudio();
  const drill = currentDrill();
  const part = currentPart();
  const test = currentTest();

  state.heard = { question: false, options: [false, false, false] };
  state.locked = false;
  state.firstTry = true;
  state.lastFeedback = null;
  clearCardState(elements.questionCard);
  elements.options.forEach(({ card, choose, text, listen }, index) => {
    clearCardState(card);
    choose.disabled = false;
    concealTerm(text);
    listen.setAttribute("aria-label", `Listen to option ${optionLetters[index]}`);
    choose.setAttribute("aria-label", `Choose option ${optionLetters[index]}`);
  });

  concealTerm(elements.questionText, drill.question);
  elements.questionListen.setAttribute("aria-label", "Listen to tested word");
  elements.testLabel.textContent = `Cambridge ${test.book} · Test ${test.test} · Part ${part.number}`;
  elements.nextButton.disabled = true;
  elements.backButton.disabled = state.testIndex === 0 && state.drillIndex === 0;
  updateProgress();
  updateChoiceState();

  saveState();
  preloadCurrentAndNext();
}

function showFinishScreen() {
  const test = currentTest();
  const nextTest = COURSE.tests[state.testIndex + 1];
  const accuracy = Math.round((firstAttemptCount(test) / test.total) * 100);
  elements.finishKicker.textContent = nextTest ? "Test complete" : "Course complete";
  elements.finishCopy.textContent = `Cambridge IELTS ${test.book} · Test ${test.test}`;
  elements.pepTalk.textContent = PEP_TALKS[state.testIndex];
  elements.completionValue.textContent = `${test.total}/${test.total}`;
  elements.accuracyValue.textContent = `${accuracy}%`;
  elements.continueTestButton.textContent = nextTest
    ? `Continue · Cambridge ${nextTest.book} Test ${nextTest.test}`
    : "Start Cambridge 11 Test 1";
  elements.practiseAgainButton.textContent = "Practise this test again";
  elements.finishScreen.hidden = false;
  elements.continueTestButton.focus({ preventScroll: true });
}

function nextDrill() {
  clearAutoAdvance();
  if (!state.locked) return;
  if (state.drillIndex === currentTest().drills.length - 1) {
    showFinishScreen();
    return;
  }
  state.drillIndex += 1;
  render();
}

function previousDrill() {
  clearAutoAdvance();
  if (state.drillIndex > 0) {
    state.drillIndex -= 1;
    render();
    return;
  }
  if (state.testIndex > 0) {
    state.testIndex -= 1;
    state.drillIndex = currentTest().drills.length - 1;
    render();
  }
}

function restartCurrentTest() {
  clearAutoAdvance();
  stopAudio();
  currentTest().drills.forEach((drill) => delete state.results[drill.id]);
  state.drillIndex = 0;
  elements.finishScreen.hidden = true;
  render();
}

function continueAfterFinish() {
  clearAutoAdvance();
  const nextTest = COURSE.tests[state.testIndex + 1];
  if (!nextTest) {
    stopAudio();
    state.testIndex = 0;
    state.drillIndex = 0;
    state.results = {};
  } else {
    state.testIndex += 1;
    state.drillIndex = 0;
  }
  elements.finishScreen.hidden = true;
  render();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("ielts-listening-theme", theme);
  const dark = theme === "dark";
  elements.themeButton.querySelector(".theme-icon").textContent = dark ? "☾" : "☼";
  elements.themeButton.querySelector(".theme-label").textContent = dark ? "Light" : "Dark";
  elements.themeButton.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#111916" : "#e9f1ee");
}

elements.questionListen.addEventListener("click", () => {
  playClip(elements.questionCard, audioPath("female", currentDrill().question), () => {
    state.heard.question = true;
  });
});

elements.options.forEach(({ card, listen, choose }, index) => {
  listen.addEventListener("click", () => {
    playClip(card, audioPath("male", currentOptions()[index].text), () => {
      state.heard.options[index] = true;
    });
  });
  choose.addEventListener("click", () => revealAnswer(index));
});

elements.backButton.addEventListener("click", previousDrill);
elements.nextButton.addEventListener("click", nextDrill);
elements.restartButton.addEventListener("click", restartCurrentTest);
elements.continueTestButton.addEventListener("click", continueAfterFinish);
elements.practiseAgainButton.addEventListener("click", restartCurrentTest);
elements.themeButton.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" && event.altKey) previousDrill();
  if (event.key === "ArrowRight" && event.altKey) nextDrill();
});

setTheme(localStorage.getItem("ielts-listening-theme") === "dark" ? "dark" : "light");
render();

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?release=v13"));
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()));
  }
}

window.__IELTS_LISTENING_APP__ = {
  COURSE,
  state,
  currentOptions,
  currentTest,
  currentDrill,
  feedbackState: () => ({ kind: state.lastFeedback, context: feedbackContext?.state ?? "fallback" }),
  autoAdvanceState: () => ({ pending: autoAdvanceTimer !== null, delay: autoAdvanceDelay })
};
