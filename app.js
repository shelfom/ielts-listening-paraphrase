import { COURSE, audioPath, correctPosition } from "./data.js";

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
  accuracyValue: $("accuracyValue"),
  practiseAgainButton: $("practiseAgainButton")
};

const storageKey = "ielts-listening-paraphrase-pilot-v2";
const stored = readStoredState();
const audioPool = new Map();
const state = {
  index: Math.min(stored.index ?? 0, COURSE.drills.length - 1),
  results: stored.results ?? {},
  heard: { question: false, options: [false, false, false] },
  locked: false,
  firstTry: true,
  activeAudio: null,
  activeCard: null
};

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
    JSON.stringify({ index: state.index, results: state.results })
  );
}

function currentDrill() {
  return COURSE.drills[state.index];
}

function currentPart() {
  return COURSE.parts.find((part) => part.number === currentDrill().part);
}

function currentOptions() {
  const drill = currentDrill();
  const distractors =
    state.index % 2 === 0
      ? [drill.distractor, drill.distractor2]
      : [drill.distractor2, drill.distractor];
  const options = distractors.map((text) => ({ text, correct: false }));
  options.splice(correctPosition(state.index), 0, { text: drill.answer, correct: true });
  return options;
}

function completedCount() {
  return Object.values(state.results).filter((result) => result.completed).length;
}

function firstAttemptCount() {
  return Object.values(state.results).filter(
    (result) => result.completed && result.firstTryCorrect
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
  if (heardCount > 0) {
    setInstruction("Choose when ready", "ready");
  } else {
    setInstruction("Listen or choose");
  }
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
  const currentCompleted = Boolean(state.results[currentDrill().id]?.completed);
  const visibleProgress = currentCompleted
    ? Math.max(completedCount(), state.index + 1)
    : completedCount();
  elements.scoreLabel.textContent = `${visibleProgress}/${COURSE.total}`;
  elements.progressFill.style.width = `${(visibleProgress / COURSE.total) * 100}%`;
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

function drillAudioSources(index) {
  const next = COURSE.drills[index];
  if (!next) return [];
  const distractors =
    index % 2 === 0
      ? [next.distractor, next.distractor2]
      : [next.distractor2, next.distractor];
  const choices = distractors.slice();
  choices.splice(correctPosition(index), 0, next.answer);
  return [
    audioPath("female", next.question),
    ...choices.map((text) => audioPath("male", text))
  ];
}

function preloadCurrentAndNext() {
  [...drillAudioSources(state.index), ...drillAudioSources(state.index + 1)].forEach(primeClip);
}

function render() {
  stopAudio();
  const drill = currentDrill();
  const part = currentPart();
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
  elements.testLabel.textContent = `Cambridge ${COURSE.book} · Test ${COURSE.test} · Part ${part.number}`;
  elements.nextButton.disabled = true;
  elements.backButton.disabled = state.index === 0;
  updateProgress();
  updateChoiceState();

  if (result?.completed) {
    state.heard = { question: true, options: [true, true, true] };
    state.firstTry = result.firstTryCorrect;
    state.locked = false;
    revealAnswer(correctPosition(state.index), false);
  }

  saveState();
  preloadCurrentAndNext();
}

function nextDrill() {
  if (!state.locked) return;
  if (state.index === COURSE.drills.length - 1) {
    elements.accuracyValue.textContent = `${Math.round(
      (firstAttemptCount() / COURSE.total) * 100
    )}%`;
    elements.finishScreen.hidden = false;
    elements.practiseAgainButton.focus({ preventScroll: true });
    return;
  }
  state.index += 1;
  render();
}

function previousDrill() {
  if (state.index === 0) return;
  state.index -= 1;
  render();
}

function restartTest() {
  stopAudio();
  localStorage.removeItem(storageKey);
  state.index = 0;
  state.results = {};
  elements.finishScreen.hidden = true;
  render();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("ielts-listening-theme", theme);
  const dark = theme === "dark";
  elements.themeButton.querySelector(".theme-icon").textContent = dark ? "☾" : "☼";
  elements.themeButton.querySelector(".theme-label").textContent = dark ? "Light" : "Dark";
  elements.themeButton.setAttribute(
    "aria-label",
    `Switch to ${dark ? "light" : "dark"} theme`
  );
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", dark ? "#111916" : "#e9f1ee");
}

elements.questionListen.addEventListener("click", () => {
  playClip(
    elements.questionCard,
    audioPath("female", currentDrill().question),
    () => (state.heard.question = true)
  );
});

elements.options.forEach(({ card, listen, choose }, index) => {
  listen.addEventListener("click", () => {
    playClip(
      card,
      audioPath("male", currentOptions()[index].text),
      () => (state.heard.options[index] = true)
    );
  });
  choose.addEventListener("click", () => revealAnswer(index));
});

elements.backButton.addEventListener("click", previousDrill);
elements.nextButton.addEventListener("click", nextDrill);
elements.restartButton.addEventListener("click", restartTest);
elements.practiseAgainButton.addEventListener("click", restartTest);
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
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()));
  }
}

window.__IELTS_LISTENING_APP__ = { COURSE, state, currentOptions };
