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
const stored = readStoredState();
const audioPool = new Map();
const state = {
  testIndex: Math.min(Math.max(stored.testIndex ?? 0, 0), COURSE.tests.length - 1),
  drillIndex: 0,
  results: stored.results ?? {},
  heard: { question: false, options: [false, false, false] },
  locked: false,
  firstTry: true,
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

function playFeedback(kind) {
  const sound = feedbackSounds[kind];
  sound.pause();
  sound.currentTime = 0;
  sound.play().catch(() => {});
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
    card.classList.add("is-heard");
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
    choose.disabled = state.locked;
    card.classList.toggle("is-ready", ready);
  });

  if (state.locked) return;
  const heardCount = Number(state.heard.question) + state.heard.options.filter(Boolean).length;
  setInstruction(heardCount > 0 ? "Choose when ready" : "Listen or choose", heardCount > 0 ? "ready" : "");
}

function revealAnswer(selectedIndex, withFeedback = true) {
  if (state.locked) return;
  const drill = currentDrill();
  const options = currentOptions();
  const selected = options[selectedIndex];

  if (!selected.correct) {
    state.firstTry = false;
    if (withFeedback) playFeedback("wrong");
    const card = elements.options[selectedIndex].card;
    card.classList.remove("is-wrong");
    void card.offsetWidth;
    card.classList.add("is-wrong");
    setInstruction("Try again", "wrong");
    window.setTimeout(() => {
      card.classList.remove("is-wrong");
      if (!state.locked) setInstruction("Choose when ready", "ready");
    }, 520);
    return;
  }

  stopAudio();
  if (withFeedback) playFeedback("correct");
  state.locked = true;
  const previousResult = state.results[drill.id];
  state.results[drill.id] = previousResult ?? {
    completed: true,
    firstTryCorrect: state.firstTry
  };
  saveState();

  elements.options.forEach(({ card, choose, text, listen }, index) => {
    text.textContent = options[index].text;
    card.classList.add("is-revealed");
    card.classList.toggle("is-correct", options[index].correct);
    card.classList.toggle("is-distractor", !options[index].correct);
    choose.disabled = true;
    listen.setAttribute("aria-label", `Listen to option ${optionLetters[index]}: ${options[index].text}`);
    choose.setAttribute("aria-label", `Option ${optionLetters[index]}: ${options[index].text}`);
  });

  elements.nextButton.disabled = false;
  setInstruction("Correct", "correct");
  updateProgress();
  navigator.vibrate?.(14);
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
    "is-heard",
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
  stopAudio();
  const drill = currentDrill();
  const part = currentPart();
  const test = currentTest();
  const result = state.results[drill.id];

  state.heard = { question: false, options: [false, false, false] };
  state.locked = false;
  state.firstTry = true;
  clearCardState(elements.questionCard);
  elements.options.forEach(({ card, choose, text, listen }, index) => {
    clearCardState(card);
    choose.disabled = false;
    text.textContent = "";
    listen.setAttribute("aria-label", `Listen to option ${optionLetters[index]}`);
    choose.setAttribute("aria-label", `Choose option ${optionLetters[index]}`);
  });

  elements.questionText.textContent = drill.question;
  elements.questionListen.setAttribute("aria-label", `Listen to the word: ${drill.question}`);
  elements.testLabel.textContent = `Cambridge ${test.book} · Test ${test.test} · Part ${part.number}`;
  elements.nextButton.disabled = true;
  elements.backButton.disabled = state.testIndex === 0 && state.drillIndex === 0;
  updateProgress();
  updateChoiceState();

  if (result?.completed) {
    state.heard = { question: true, options: [true, true, true] };
    state.firstTry = result.firstTryCorrect;
    revealAnswer(correctPosition(state.drillIndex), false);
  }

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
  if (!state.locked) return;
  if (state.drillIndex === currentTest().drills.length - 1) {
    showFinishScreen();
    return;
  }
  state.drillIndex += 1;
  render();
}

function previousDrill() {
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
  stopAudio();
  currentTest().drills.forEach((drill) => delete state.results[drill.id]);
  state.drillIndex = 0;
  elements.finishScreen.hidden = true;
  render();
}

function continueAfterFinish() {
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
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?release=v8"));
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
  currentDrill
};
