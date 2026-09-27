import { COURSE, PEP_TALKS, audioPath, correctPosition } from "./data.js";
import {
  buildBookIndex,
  firstTestIndex,
  prepareBookJump,
  createPlayGuard,
  trapTabKey
} from "./contents.js";
import { createFeedbackBells } from "./feedback-bells.js";

const $ = (id) => document.getElementById(id);
const optionLetters = ["A", "B", "C"];
const books = buildBookIndex(COURSE);
const playGuard = createPlayGuard();

const elements = {
  testLabel: $("testLabel"),
  scoreLabel: $("scoreLabel"),
  progressFill: $("progressFill"),
  instruction: $("instruction"),
  audioStage: $("audioStage"),
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
  headerContentsButton: $("headerContentsButton"),
  finishContentsButton: $("finishContentsButton"),
  contentsDialog: $("contentsDialog"),
  contentsClose: $("contentsClose"),
  contentsList: $("contentsList"),
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
let feedbackContext = null;
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

const feedbackBells = createFeedbackBells({
  createAudioContext: () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!feedbackContext || feedbackContext.state === "closed") {
      feedbackContext = new AudioContextClass();
    }
    return feedbackContext;
  },
  fallback: feedbackSounds
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
  // Invalidate every callback/event attached before this stop so late
  // promise resolutions or ended events from a previous drill/book are ignored.
  playGuard.stop();
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

function revealAllTerms(drill, options) {
  elements.audioStage.dataset.termsVisible = "true";
  revealTerm(elements.questionText, drill.question);
  elements.questionCard.classList.add("is-revealed");
  elements.options.forEach(({ card, text }, index) => {
    revealTerm(text, options[index].text);
    card.classList.add("is-revealed");
  });
  void elements.questionText.offsetWidth;
}

function playFeedback(kind) {
  state.lastFeedback = kind;
  feedbackBells.play(kind);
}

// Book jumps invalidate the feedback epoch and silence every active cue.
function cancelFeedbackAudio(invalidate) {
  feedbackBells.cancel(invalidate);
}

async function playClip(card, src, onFinished) {
  stopAudio();
  const epoch = playGuard.current();
  const audio = primeClip(src);
  state.activeAudio = audio;
  state.activeCard = card;
  audio.currentTime = 0;
  audio.volume = 1;
  card.classList.add("is-playing");
  setInstruction("Listening");

  audio.onended = () => {
    if (!playGuard.isCurrent(epoch)) return;
    card.classList.remove("is-playing");
    state.activeAudio = null;
    state.activeCard = null;
    onFinished();
    updateChoiceState();
  };
  audio.onerror = () => {
    if (!playGuard.isCurrent(epoch)) return;
    card.classList.remove("is-playing");
    state.activeAudio = null;
    state.activeCard = null;
    setInstruction("Audio unavailable — try again", "wrong");
  };

  try {
    await audio.play();
  } catch {
    if (!playGuard.isCurrent(epoch)) return;
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

  revealAllTerms(drill, options);
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
  elements.questionListen.setAttribute("aria-label", `Listen to the word: ${drill.question}`);

  elements.options.forEach(({ card, choose, text, listen }, index) => {
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
  stopAudio();
  const drill = currentDrill();
  const part = currentPart();
  const test = currentTest();

  state.heard = { question: false, options: [false, false, false] };
  state.locked = false;
  state.firstTry = true;
  state.lastFeedback = null;
  elements.audioStage.dataset.termsVisible = "false";
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

// --- Contents dialog ---

const supportsNativeDialog = typeof elements.contentsDialog.showModal === "function";
let contentsReturnFocus = null;
let contentsBookPicked = false;
let contentsKeydownHandler = null;
let contentsDialogKeydownHandler = null;

function populateContents() {
  elements.contentsList.textContent = "";
  books.forEach(({ book }) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "contents-book";
    button.dataset.book = String(book);
    button.textContent = `Cambridge IELTS ${book}`;
    const current = book === currentTest().book;
    if (current) {
      button.setAttribute("aria-current", "true");
      button.setAttribute("aria-label", `Cambridge IELTS ${book} — current book`);
    } else {
      button.setAttribute("aria-label", `Cambridge IELTS ${book}`);
    }
    listItem.appendChild(button);
    elements.contentsList.appendChild(listItem);
  });
}

function currentBookButton() {
  const currentBook = String(currentTest().book);
  return (
    elements.contentsList.querySelector(`[data-book="${currentBook}"]`) ||
    elements.contentsList.querySelector(".contents-book")
  );
}

function openContents(event) {
  contentsReturnFocus = event?.currentTarget || document.activeElement;
  contentsBookPicked = false;
  populateContents();
  // Explicit Tab trap is bound in both native and fallback modes; native
  // showModal() still supplies background inertness, but Chromium does not
  // itself keep Tab from leaving the dialog.
  contentsDialogKeydownHandler = (keyEvent) => {
    if (keyEvent.key === "Tab") {
      const handled = trapTabKey(
        keyEvent,
        elements.contentsDialog,
        document.activeElement
      );
      if (handled) keyEvent.preventDefault();
      return;
    }
    if (!supportsNativeDialog && keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      dismissContents();
    }
  };
  elements.contentsDialog.addEventListener(
    "keydown",
    contentsDialogKeydownHandler
  );

  if (supportsNativeDialog) {
    elements.contentsDialog.showModal();
  } else {
    elements.contentsDialog.setAttribute("open", "");
    elements.contentsDialog.classList.add("is-fallback");
    document.querySelectorAll(".page-shell, .finish-screen").forEach((node) => {
      node.setAttribute("inert", "");
    });
  }
  currentBookButton()?.focus();
}

function closeContentsDialog() {
  if (contentsDialogKeydownHandler) {
    elements.contentsDialog.removeEventListener(
      "keydown",
      contentsDialogKeydownHandler
    );
    contentsDialogKeydownHandler = null;
  }
  if (contentsKeydownHandler) {
    document.removeEventListener("keydown", contentsKeydownHandler);
    contentsKeydownHandler = null;
  }
  if (supportsNativeDialog) {
    if (elements.contentsDialog.open) elements.contentsDialog.close();
  } else {
    elements.contentsDialog.classList.remove("is-fallback");
    elements.contentsDialog.removeAttribute("open");
    document.querySelectorAll(".page-shell, .finish-screen").forEach((node) => {
      node.removeAttribute("inert");
    });
  }
}

function dismissContents() {
  contentsBookPicked = false;
  closeContentsDialog();
  // Dismissal never changes the exercise; focus returns to the opener.
  contentsReturnFocus?.focus?.({ preventScroll: true });
}

function jumpToBook(book) {
  const targetTestIndex = firstTestIndex(COURSE, book);
  if (targetTestIndex < 0) return;
  const jump = prepareBookJump(state, targetTestIndex);
  state.testIndex = jump.testIndex;
  state.drillIndex = jump.drillIndex;
  // Results preserved by reference; never invoke the test-reset path here.
  elements.finishScreen.hidden = true;
  stopAudio();
  cancelFeedbackAudio(true);
  render();
}

function selectBook(book) {
  contentsBookPicked = true;
  jumpToBook(book);
  closeContentsDialog();
  // Move focus to a visible exercise control, not the (possibly hidden) opener.
  elements.headerContentsButton.focus({ preventScroll: true });
}

function handleFallbackKeydown(keyEvent) {
  if (keyEvent.key === "Escape") {
    keyEvent.preventDefault();
    dismissContents();
  }
}

if (supportsNativeDialog) {
  // Escape / backdrop / close button all arrive here; dismissal changes nothing.
  elements.contentsDialog.addEventListener("close", () => {
    if (!contentsBookPicked) {
      contentsReturnFocus?.focus?.({ preventScroll: true });
    }
  });
  elements.contentsDialog.addEventListener("cancel", (event) => {
    // Keep Escape aligned with close(): no selection is made.
    event.preventDefault();
    dismissContents();
  });
  // Actual backdrop dismissal (clicks directly on the dialog, not its content).
  elements.contentsDialog.addEventListener("click", (event) => {
    if (event.target === elements.contentsDialog) dismissContents();
  });
}

elements.contentsClose.addEventListener("click", dismissContents);
elements.contentsList.addEventListener("click", (event) => {
  const button = event.target.closest(".contents-book");
  if (!button) return;
  selectBook(Number(button.dataset.book));
});
elements.headerContentsButton.addEventListener("click", openContents);
elements.finishContentsButton.addEventListener("click", openContents);

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
  const contentsOpen = elements.contentsDialog.open
    ? elements.contentsDialog.open !== false
    : elements.contentsDialog.hasAttribute("open");
  if (contentsOpen) return;
  if (event.key === "ArrowLeft" && event.altKey) previousDrill();
  if (event.key === "ArrowRight" && event.altKey) nextDrill();
});

setTheme(localStorage.getItem("ielts-listening-theme") === "dark" ? "dark" : "light");
render();

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?release=v18"));
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()));
  }
}

window.__IELTS_LISTENING_APP__ = {
  COURSE,
  state,
  books,
  currentOptions,
  currentTest,
  currentDrill,
  openContents,
  selectBook,
  dismissContents,
  jumpToBook,
  feedbackState: () => ({
    kind: state.lastFeedback,
    context: feedbackContext?.state ?? "fallback",
    epoch: feedbackBells.epoch(),
    ...feedbackBells.state()
  }),
  playFeedback,
  cancelFeedbackAudio,
  visibilityState: () => ({
    allVisible:
      elements.audioStage.dataset.termsVisible === "true" &&
      !elements.questionText.hidden &&
      elements.options.every(({ text }) => !text.hidden)
  }),
  contentsOpen: () =>
    supportsNativeDialog ? elements.contentsDialog.open : elements.contentsDialog.hasAttribute("open")
};
