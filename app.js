import { COURSE, audioPath, correctIsLeft } from "./data.js";

const $ = (id) => document.getElementById(id);

const elements = {
  testLabel: $("testLabel"),
  partTitle: $("partTitle"),
  scoreLabel: $("scoreLabel"),
  progressFill: $("progressFill"),
  instruction: $("instruction"),
  questionCard: $("questionCard"),
  leftCard: $("leftCard"),
  rightCard: $("rightCard"),
  questionText: $("questionText"),
  leftText: $("leftText"),
  rightText: $("rightText"),
  backButton: $("backButton"),
  restartButton: $("restartButton"),
  nextButton: $("nextButton"),
  themeButton: $("themeButton"),
  finishScreen: $("finishScreen"),
  accuracyValue: $("accuracyValue"),
  practiseAgainButton: $("practiseAgainButton")
};

const storageKey = "ielts-listening-paraphrase-pilot-v1";
const stored = readStoredState();
const state = {
  index: Math.min(stored.index ?? 0, COURSE.drills.length - 1),
  results: stored.results ?? {},
  heard: { question: false, left: false, right: false },
  locked: false,
  firstTry: true,
  activeAudio: new Audio(),
  activeCard: null
};

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
  const partNumber = currentDrill().part;
  return COURSE.parts.find((part) => part.number === partNumber);
}

function currentOptions() {
  const drill = currentDrill();
  const correctLeft = correctIsLeft(state.index);
  return {
    left: {
      text: correctLeft ? drill.answer : drill.distractor,
      correct: correctLeft
    },
    right: {
      text: correctLeft ? drill.distractor : drill.answer,
      correct: !correctLeft
    }
  };
}

function completedCount() {
  return Object.values(state.results).filter((result) => result.completed).length;
}

function firstAttemptCount() {
  return Object.values(state.results).filter(
    (result) => result.completed && result.firstTryCorrect
  ).length;
}

function stopAudio() {
  state.activeAudio.pause();
  state.activeAudio.currentTime = 0;
  state.activeCard?.classList.remove("is-playing");
  state.activeCard = null;
}

function setInstruction(message, tone = "") {
  elements.instruction.textContent = message;
  elements.instruction.dataset.tone = tone;
}

async function playAudio(card, src, heardKey) {
  if (state.locked) return;
  stopAudio();
  state.activeCard = card;
  state.activeAudio.src = src;
  state.activeAudio.volume = 1;
  state.activeAudio.preload = "auto";
  card.classList.add("is-playing");
  setInstruction("Listen carefully");

  const finished = () => {
    card.classList.remove("is-playing");
    card.classList.add("is-heard");
    state.heard[heardKey] = true;
    state.activeCard = null;
    updateListeningState();
  };

  state.activeAudio.onended = finished;
  state.activeAudio.onerror = () => {
    card.classList.remove("is-playing");
    state.activeCard = null;
    setInstruction("Audio could not load — tap again", "wrong");
  };

  try {
    await state.activeAudio.play();
  } catch {
    card.classList.remove("is-playing");
    state.activeCard = null;
    setInstruction("Tap again to play the audio", "wrong");
  }
}

function updateListeningState() {
  if (!state.heard.question) {
    elements.leftCard.disabled = true;
    elements.rightCard.disabled = true;
    setInstruction("Listen to the question");
    return;
  }

  elements.leftCard.disabled = false;
  elements.rightCard.disabled = false;

  if (!state.heard.left || !state.heard.right) {
    setInstruction("Listen to both options");
    return;
  }

  elements.leftCard.classList.add("is-ready");
  elements.rightCard.classList.add("is-ready");
  setInstruction("Choose the paraphrase", "ready");
}

function revealAnswer(selectedSide) {
  const drill = currentDrill();
  const options = currentOptions();
  const selected = options[selectedSide];

  if (!selected.correct) {
    state.firstTry = false;
    const card = selectedSide === "left" ? elements.leftCard : elements.rightCard;
    card.classList.remove("is-wrong");
    void card.offsetWidth;
    card.classList.add("is-wrong");
    setInstruction("Not that one — listen again", "wrong");
    window.setTimeout(() => {
      card.classList.remove("is-wrong");
      if (!state.locked) setInstruction("Choose the paraphrase", "ready");
    }, 520);
    return;
  }

  stopAudio();
  state.locked = true;
  const previousResult = state.results[drill.id];
  state.results[drill.id] = previousResult ?? {
    completed: true,
    firstTryCorrect: state.firstTry
  };
  saveState();

  elements.questionText.textContent = drill.question;
  elements.leftText.textContent = options.left.text;
  elements.rightText.textContent = options.right.text;
  elements.questionCard.classList.add("is-revealed");
  elements.leftCard.classList.add("is-revealed");
  elements.rightCard.classList.add("is-revealed");
  elements.leftCard.classList.toggle("is-correct", options.left.correct);
  elements.rightCard.classList.toggle("is-correct", options.right.correct);
  elements.leftCard.classList.toggle("is-distractor", !options.left.correct);
  elements.rightCard.classList.toggle("is-distractor", !options.right.correct);
  elements.questionCard.setAttribute("aria-label", `Question: ${drill.question}`);
  elements.leftCard.setAttribute("aria-label", `Option A: ${options.left.text}`);
  elements.rightCard.setAttribute("aria-label", `Option B: ${options.right.text}`);
  elements.nextButton.disabled = false;
  setInstruction("That’s the paraphrase", "correct");
  updateProgress();
  navigator.vibrate?.(14);
}

function handleOption(side) {
  if (state.locked || !state.heard.question) return;
  const options = currentOptions();
  const card = side === "left" ? elements.leftCard : elements.rightCard;

  if (!state.heard[side] || !state.heard.left || !state.heard.right) {
    playAudio(card, audioPath("male", options[side].text), side);
    return;
  }

  revealAnswer(side);
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

function preloadNext() {
  const next = COURSE.drills[state.index + 1];
  if (!next) return;
  const nextCorrectLeft = correctIsLeft(state.index + 1);
  const clips = [
    audioPath("female", next.question),
    audioPath("male", nextCorrectLeft ? next.answer : next.distractor),
    audioPath("male", nextCorrectLeft ? next.distractor : next.answer)
  ];
  clips.forEach((src) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
  });
}

function render() {
  stopAudio();
  const drill = currentDrill();
  const part = currentPart();
  const result = state.results[drill.id];

  state.heard = { question: false, left: false, right: false };
  state.locked = false;
  state.firstTry = true;
  [elements.questionCard, elements.leftCard, elements.rightCard].forEach(clearCardState);
  [elements.questionText, elements.leftText, elements.rightText].forEach((node) => {
    node.textContent = "";
  });

  elements.testLabel.textContent = `Test ${COURSE.test} · Part ${part.number}`;
  elements.partTitle.textContent = part.title;
  elements.questionCard.setAttribute("aria-label", "Play the question audio");
  elements.leftCard.setAttribute("aria-label", "Play option A");
  elements.rightCard.setAttribute("aria-label", "Play option B");
  elements.leftCard.disabled = true;
  elements.rightCard.disabled = true;
  elements.nextButton.disabled = true;
  elements.backButton.disabled = state.index === 0;
  setInstruction("Listen to the question");
  updateProgress();

  if (result?.completed) {
    state.heard = { question: true, left: true, right: true };
    state.firstTry = result.firstTryCorrect;
    revealAnswer(correctIsLeft(state.index) ? "left" : "right");
  }

  saveState();
  preloadNext();
}

function nextDrill() {
  if (!state.locked) return;
  if (state.index === COURSE.drills.length - 1) {
    const accuracy = Math.round((firstAttemptCount() / COURSE.total) * 100);
    elements.accuracyValue.textContent = `${accuracy}%`;
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

elements.questionCard.addEventListener("click", () => {
  playAudio(elements.questionCard, audioPath("female", currentDrill().question), "question");
});
elements.leftCard.addEventListener("click", () => handleOption("left"));
elements.rightCard.addEventListener("click", () => handleOption("right"));
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

const savedTheme = localStorage.getItem("ielts-listening-theme");
setTheme(savedTheme === "dark" ? "dark" : "light");
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
