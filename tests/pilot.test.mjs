import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { ALL_DRILLS, ALL_TESTS, COURSE, PEP_TALKS, audioKey, correctPosition } from "../data.js";
import {
  buildBookIndex,
  firstTestIndex,
  prepareBookJump,
  createPlayGuard,
  trapTabKey,
  getTabbable,
  TAB_TABBABLE_SELECTOR
} from "../contents.js";
import { createFeedbackBells } from "../feedback-bells.js";

test("course covers Books 11–20 from required through usually most effective", () => {
  assert.equal(COURSE.tests.length, 40);
  assert.equal(COURSE.total, 2069);
  assert.deepEqual(ALL_DRILLS[0], {
    id: "11-1-1-01",
    book: 11,
    test: 1,
    part: 1,
    question: "required",
    answer: "we do insist",
    distractor: ALL_DRILLS[0].distractor,
    distractor2: ALL_DRILLS[0].distractor2,
    distractorScope: "same-part"
  });
  assert.equal(ALL_DRILLS.at(-1).book, 20);
  assert.equal(ALL_DRILLS.at(-1).test, 4);
  assert.equal(ALL_DRILLS.at(-1).part, 4);
  assert.equal(ALL_DRILLS.at(-1).question, "usually most effective");
  assert.equal(ALL_DRILLS.at(-1).answer, "for them to have any effect");
});

test("first Test retains the accepted 30-drill, four-Part sequence", () => {
  const firstTest = ALL_TESTS[0];
  assert.equal(firstTest.book, 11);
  assert.equal(firstTest.test, 1);
  assert.equal(firstTest.total, 30);
  assert.deepEqual(firstTest.parts.map((part) => part.total), [9, 3, 8, 10]);
  assert.equal(firstTest.drills.at(-1).question, "purpose");
  assert.equal(firstTest.drills.at(-1).answer, "so that");
});

test("Book 20 contributes four complete Tests and 244 verified drills", () => {
  const book20Tests = ALL_TESTS.filter((testData) => testData.book === 20);
  assert.equal(book20Tests.length, 4);
  assert.equal(book20Tests.reduce((sum, testData) => sum + testData.total, 0), 244);
  assert.deepEqual(book20Tests.map((testData) => testData.total), [62, 61, 61, 60]);
  assert.deepEqual(
    book20Tests.flatMap((testData) => testData.parts.map((part) => part.total)),
    [14, 16, 17, 15, 14, 15, 17, 15, 15, 15, 16, 15, 14, 15, 16, 15]
  );
});

test("distractors stay in the original Listening Part whenever the source supplies two", () => {
  for (const testData of ALL_TESTS) {
    for (const drill of testData.drills) {
      const samePartAnswers = testData.drills
        .filter((candidate) => candidate.part === drill.part)
        .map((candidate) => candidate.answer);
      assert.notEqual(drill.answer, drill.distractor, drill.id);
      assert.notEqual(drill.answer, drill.distractor2, drill.id);
      assert.notEqual(drill.distractor, drill.distractor2, drill.id);
      if (drill.distractorScope === "same-part") {
        assert.ok(samePartAnswers.includes(drill.distractor), drill.id);
        assert.ok(samePartAnswers.includes(drill.distractor2), drill.id);
      }
    }
  }
  const exceptions = ALL_DRILLS.filter((drill) => drill.distractorScope !== "same-part");
  assert.deepEqual(exceptions.map((drill) => drill.id), ["11-3-3-01", "11-3-3-02"]);
});

test("answer positions are deterministic and balanced within each Test", () => {
  for (const testData of ALL_TESTS) {
    const positions = [0, 1, 2].map(
      (position) => testData.drills.filter((_, index) => correctPosition(index) === position).length
    );
    assert.ok(Math.max(...positions) - Math.min(...positions) <= 1, testData.id);
  }
  assert.deepEqual(
    [0, 1, 2].map((position) => ALL_TESTS[0].drills.filter((_, index) => correctPosition(index) === position).length),
    [10, 10, 10]
  );
});

test("ids, audio keys, and Book 21 readiness remain stable", () => {
  assert.equal(new Set(ALL_DRILLS.map((drill) => drill.id)).size, 2069);
  assert.equal(audioKey("don't touch"), "dont-touch");
  assert.equal(audioKey("you'll be informed of"), "youll-be-informed-of");
  assert.equal(audioKey("STEM disciplines"), "stem-disciplines");
  assert.equal(COURSE.futureBookReady, 21);
  assert.equal(COURSE.total, ALL_DRILLS.length);
});

test("each Test has a distinct pep talk", () => {
  assert.equal(PEP_TALKS.length, ALL_TESTS.length);
  assert.equal(new Set(PEP_TALKS).size, ALL_TESTS.length);
  assert.match(PEP_TALKS.at(-1), /Full course complete/);
});

test("correct and wrong game feedback sounds are bundled", () => {
  for (const name of ["correct", "wrong"]) {
    const file = new URL(`../public/sfx/${name}.mp3`, import.meta.url);
    assert.ok(existsSync(file), `${name} sound is missing`);
    assert.ok(statSync(file).size > 1000, `${name} sound is empty`);
  }
});

test("Choose is available immediately and does not require listening first", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.equal((html.match(/class="choose-button"/g) || []).length, 3);
  assert.doesNotMatch(html, /class="choose-button"[^>]*disabled/);
  assert.match(app, /if \(state\.locked\) return;/);
  assert.doesNotMatch(app, /!allClipsHeard\(\)/);
});

test("all four English phrases stay hidden until choice and Choose remains active afterward", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /class="heard-mark"/);
  assert.equal((html.match(/class="term-text(?: question-text)?"[^>]* hidden/g) || []).length, 4);
  assert.match(styles, /\.option-card \.card-actions \{[\s\S]*position: relative;[\s\S]*z-index: 4;/);
  assert.match(styles, /\.option-card \.listen-action,[\s\S]*\.option-card \.choose-button \{[\s\S]*position: relative;[\s\S]*z-index: 5;[\s\S]*touch-action: manipulation;/);
  assert.doesNotMatch(app, /setInstruction\("Try again"/);
  assert.doesNotMatch(styles, /\.question-card \.term-text \{[\s\S]*opacity: 1/);
  assert.match(styles, /\.term-text \{[\s\S]*opacity: 0;[\s\S]*visibility: hidden;/);
  assert.match(app, /elements\.questionCard\.classList\.add\("is-revealed"\)/);
  assert.match(styles, /\.question-card\.is-revealed \.question-text \{[\s\S]*opacity: 1;[\s\S]*visibility: visible;/);
  assert.match(app, /function concealTerm\(element, text = ""\) \{[\s\S]*display", "none", "important"[\s\S]*element\.hidden = true;/);
  assert.match(app, /function revealTerm\(element, text\) \{[\s\S]*element\.hidden = false;[\s\S]*display", "block", "important"[\s\S]*opacity", "1", "important"[\s\S]*visibility", "visible", "important"/);
  assert.match(styles, /\.term-text\[hidden\] \{[\s\S]*display: none !important;/);
  assert.match(app, /revealTerm\(elements\.questionText, drill\.question\);/);
  assert.match(app, /function revealAllTerms\(drill, options\) \{[\s\S]*elements\.audioStage\.dataset\.termsVisible = "true";[\s\S]*revealTerm\(elements\.questionText, drill\.question\);[\s\S]*void elements\.questionText\.offsetWidth;/);
  assert.match(app, /const firstChoice = !state\.locked;\s*revealAllTerms\(drill, options\);/);
  assert.match(app, /card\.classList\.toggle\("is-correct", index === selectedIndex && selected\.correct\)/);
  assert.match(app, /card\.classList\.toggle\("is-wrong", index === selectedIndex && !selected\.correct\)/);
  assert.match(app, /card\.classList\.toggle\("is-distractor", index !== selectedIndex\)/);
  assert.match(app, /revealTerm\(text, options\[index\]\.text\);/);
  assert.match(styles, /\.is-revealed \.term-text \{[\s\S]*transition: none;/);
  assert.match(styles, /\.audio-stage\[data-terms-visible="true"\] \.term-text,[\s\S]*display: block !important;[\s\S]*opacity: 1 !important;[\s\S]*visibility: visible !important;/);
  assert.match(styles, /\.question-card \.card-actions\.single-action \{\s*position: relative;/);
  assert.doesNotMatch(app, /choose\.disabled = true/);
  assert.doesNotMatch(app, /revealAnswer\(correctPosition\(state\.drillIndex\), false\)/);
  assert.match(app, /elements\.questionListen\.setAttribute\("aria-label", "Listen to tested word"\)/);
  assert.match(worker, /const cacheName = "ielts-listening-books-11-20-v18";/);
  assert.match(app, /navigator\.serviceWorker\.register\("\/sw\.js\?release=v18"\)/);
});

test("correct and wrong feedback use distinct immediate bell cues", () => {
  const bellsSource = readFileSync(
    new URL("../feedback-bells.js", import.meta.url),
    "utf8"
  );
  assert.match(bellsSource, /783\.99/);
  assert.match(bellsSource, /1174\.66/);
  assert.match(bellsSource, /329\.63/);
  assert.match(bellsSource, /246\.94/);
  assert.match(bellsSource, /oscillator\.type = correct \? "sine" : "triangle"/);
  assert.match(bellsSource, /context\.resume\(\)\.then\(\s*\(\) => ring/);
  assert.match(bellsSource, /playFallback\(kind, expectedEpoch\)/);
});

test("a correct choice stays visible until the learner clicks Next", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /autoAdvance/);
  assert.doesNotMatch(app, /scheduleAutoAdvance/);
  assert.doesNotMatch(app, /window\.setTimeout/);
  assert.doesNotMatch(app, /window\.requestAnimationFrame/);
  assert.match(app, /function nextDrill\(\) \{\s*if \(!state\.locked\) return;/);
  assert.match(app, /elements\.nextButton\.addEventListener\("click", nextDrill\)/);
  assert.match(app, /visibilityState: \(\) => \(\{[\s\S]*allVisible:/);
});

test("current and following drill audio are held in a persistent preload pool", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /const audioPool = new Map\(\)/);
  assert.match(app, /function primeClip\(src\)/);
  assert.match(app, /preloadCurrentAndNext\(\)/);
  assert.match(app, /state\.activeAudio = audio/);
});

test("Back and Next sit below the listening cards", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const navigation = html.indexOf('class="practice-nav"');
  const cards = html.indexOf('class="audio-stage"');
  assert.ok(navigation > cards);
  assert.match(html, /class="text-button back-button"/);
  assert.match(html, /class="text-button next-button"/);
  assert.match(styles, /\.back-button,\s*\.next-button \{[\s\S]*width: 100%;[\s\S]*max-width: 144px;/);
  assert.doesNotMatch(styles, /\.next-button:not\(:disabled\) \{[\s\S]*background: var\(--accent\)/);
});

test("the word Listen control sits in the same lower-right choice row", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.question-card \.card-actions\.single-action \{[\s\S]*position: relative;[\s\S]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.question-card \.listen-action \{[\s\S]*grid-row: 1;[\s\S]*width: min\(48%, 210px\)/);
  assert.match(styles, /\.option-card \.card-actions \{[\s\S]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.option-card \.listen-action \{[\s\S]*grid-row: 1/);
  assert.match(styles, /\.option-card \.choose-button \{[\s\S]*grid-row: 2/);
});

test("completion screen progresses Test by Test and preserves pep talks", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="pepTalk"/);
  assert.match(html, /id="continueTestButton"/);
  assert.match(app, /function showFinishScreen\(\)/);
  assert.match(app, /function continueAfterFinish\(\)/);
  assert.match(app, /state\.testIndex \+= 1/);
});

test("phone practice shell is fixed and IELTS-led", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /class="brand-ielts">IELTS</);
  assert.doesNotMatch(html, /Hiring a public room/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /html,\s*body \{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.practice \{[\s\S]*grid-template-rows:[\s\S]*minmax\(0, 1fr\)/);
  assert.match(styles, /\.audio-stage \{[\s\S]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
});

// --- Contents navigation ---

test("Contents derives all books dynamically from test metadata with no hardcoded list", () => {
  const index = buildBookIndex(COURSE);
  assert.deepEqual(
    index.map((entry) => entry.book),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  );
  // First occurrence indexes follow the 4-tests-per-book structure.
  assert.deepEqual(
    index.map((entry) => entry.firstTestIndex),
    [0, 4, 8, 12, 16, 20, 24, 28, 32, 36]
  );

  // Future books appear automatically: build from an artificial course.
  const futureCourse = {
    tests: [{ book: 11 }, { book: 11 }, { book: 21 }, { book: 21 }]
  };
  assert.deepEqual(buildBookIndex(futureCourse), [
    { book: 11, firstTestIndex: 0 },
    { book: 21, firstTestIndex: 2 }
  ]);
});

test("every book resolves to its first available test, including Book 12 starting at Test 5", () => {
  const index = buildBookIndex(COURSE);
  index.forEach(({ book, firstTestIndex: expected }) => {
    assert.equal(firstTestIndex(COURSE, book), expected);
    const resolvedTest = COURSE.tests[firstTestIndex(COURSE, book)];
    assert.equal(resolvedTest.book, book);
  });
  // Book 12 must never assume Test 1: its first test is Cambridge 12 Test 5 (index 4).
  assert.equal(firstTestIndex(COURSE, 12), 4);
  assert.equal(COURSE.tests[4].book, 12);
  assert.equal(COURSE.tests[4].test, 5);
  // Unknown book yields -1 rather than a guessed index.
  assert.equal(firstTestIndex(COURSE, 99), -1);
});

test("book jump targets the first drill and preserves results exactly by reference", () => {
  const results = { "11-1-1-01": { completed: true, firstTryCorrect: true } };
  const baseState = { testIndex: 4, drillIndex: 27, results };

  // Forward book (11 -> 20)
  let jump = prepareBookJump(baseState, firstTestIndex(COURSE, 20));
  assert.deepEqual(jump, { testIndex: 36, drillIndex: 0, results });
  assert.equal(jump.results, results);

  // Backward book (20 -> 11)
  jump = prepareBookJump(baseState, firstTestIndex(COURSE, 11));
  assert.deepEqual(jump, { testIndex: 0, drillIndex: 0, results });
  assert.equal(jump.results, results);

  // Same book still returns to its first drill, results untouched
  jump = prepareBookJump(baseState, firstTestIndex(COURSE, 12));
  assert.deepEqual(jump, { testIndex: 4, drillIndex: 0, results });
  assert.equal(jump.results, results);
});

test("play guard stops audio and invalidates stale asynchronous callbacks", () => {
  const guard = createPlayGuard();
  const first = guard.current();
  assert.ok(guard.isCurrent(first));
  const afterStop = guard.stop();
  assert.ok(afterStop > first);
  // Captured epoch before stop is now stale.
  assert.equal(guard.isCurrent(first), false);
  assert.ok(guard.isCurrent(afterStop));
  // Each stop invalidates the previous generation again.
  const later = guard.stop();
  assert.equal(guard.isCurrent(afterStop), false);
  assert.ok(guard.isCurrent(later));
});

test("Contents is wired into the header and the completion screen", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="headerContentsButton"[^>]*>\s*Contents/);
  assert.match(html, /id="finishContentsButton"[^>]*>\s*Contents/);
  assert.match(html, /<dialog[^>]*id="contentsDialog"[^>]*aria-labelledby="contentsTitle"/);
  assert.match(html, /id="contentsTitle"[^>]*>Contents/);
  assert.match(html, /id="contentsList"/);
  assert.match(html, /id="contentsClose"[^>]*aria-label="Close Contents"/);
  assert.match(app, /elements\.headerContentsButton\.addEventListener\("click", openContents\)/);
  assert.match(app, /elements\.finishContentsButton\.addEventListener\("click", openContents\)/);
});

test("Contents dialog highlights the current book visually and accessibly", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /button\.setAttribute\("aria-current", "true"\)/);
  assert.match(app, /current book/);
  assert.match(styles, /\.contents-book\[aria-current="true"\]/);
  assert.match(styles, /content: "Current"/);
});

test("selecting a book closes the dialog, hides completion, and jumps to first drill", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /function jumpToBook\(book\) \{[\s\S]*const targetTestIndex = firstTestIndex\(COURSE, book\);[\s\S]*state\.testIndex = jump\.testIndex;[\s\S]*state\.drillIndex = jump\.drillIndex;[\s\S]*Results preserved by reference/
  );
  assert.match(app, /elements\.finishScreen\.hidden = true;[\s\S]*stopAudio\(\);[\s\S]*render\(\);/);
  assert.match(
    app,
    /function selectBook\(book\) \{[\s\S]*jumpToBook\(book\);[\s\S]*closeContentsDialog\(\);[\s\S]*elements\.headerContentsButton\.focus/
  );
  // Storage format and results key are preserved.
  assert.match(app, /const storageKey = "ielts-listening-paraphrase-v3";/);
  // The book path must never delete results.
  const jumpBody = app.match(/function jumpToBook\(book\) \{\n([\s\S]*?)\n\}\n/);
  assert.ok(jumpBody, "jumpToBook must exist");
  assert.doesNotMatch(jumpBody[1], /restartCurrentTest/);
  const selectBody = app.match(/function selectBook\(book\) \{\n([\s\S]*?)\n\}\n/);
  assert.ok(selectBody, "selectBook must exist");
  assert.doesNotMatch(selectBody[1], /restartCurrentTest/);
});

test("dismissal via Escape, close button, or backdrop leaves the exercise unchanged", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // Native dialog: cancel (Escape) prevented and routed through dismissContents.
  assert.match(app, /elements\.contentsDialog\.addEventListener\("cancel", \(event\) =>/);
  assert.match(app, /event\.preventDefault\(\);\s*dismissContents\(\);/);
  // Actual backdrop dismissal.
  assert.match(app, /if \(event\.target === elements\.contentsDialog\) dismissContents\(\);/);
  // Close button.
  assert.match(app, /elements\.contentsClose\.addEventListener\("click", dismissContents\)/);
  // Dismiss only returns focus; it does not touch test/drill/results.
  assert.match(
    app,
    /function dismissContents\(\) \{[\s\S]*contentsBookPicked = false;[\s\S]*closeContentsDialog\(\);[\s\S]*contentsReturnFocus\?\.focus/
  );
  const dismissBody = app.match(/function dismissContents\(\) \{\n([\s\S]*?)\n\}\n/);
  assert.ok(dismissBody, "dismissContents must exist");
  assert.doesNotMatch(dismissBody[1], /render\(\)/);
});

test("dialog provides focus trap, initial focus, background inertness, and focus return", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // Initial focus lands on the current book.
  assert.match(app, /currentBookButton\(\)\?\.focus\(\);/);
  // Focus returns to opener on close (native close event for dismissal).
  assert.match(app, /elements\.contentsDialog\.addEventListener\("close", \(\) =>/);
  assert.match(app, /contentsReturnFocus\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  // Fallback path: background inertness.
  assert.match(app, /setAttribute\("inert", ""\)/);
  assert.match(app, /removeAttribute\("inert"\)/);
  // A scoped keydown handler using the shared trapTabKey helper is bound in
  // both native and fallback modes and removed on every close path.
  assert.match(app, /contentsDialogKeydownHandler = \(keyEvent\) =>/);
  assert.match(app, /trapTabKey\(\s*keyEvent,\s*elements\.contentsDialog,\s*document\.activeElement/);
  assert.match(app, /elements\.contentsDialog\.addEventListener\(\s*"keydown",\s*contentsDialogKeydownHandler/);
  assert.match(app, /elements\.contentsDialog\.removeEventListener\(\s*"keydown",\s*contentsDialogKeydownHandler/);
});

test("repeated open/Escape cycles do not accumulate keydown listeners", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // closeContentsDialog must remove the keydown handler on every close path.
  const closeBody = app.match(/function closeContentsDialog\(\) \{\n([\s\S]*?)\n\}\n/);
  assert.ok(closeBody, "closeContentsDialog must exist");
  assert.match(
    closeBody[1],
    /elements\.contentsDialog\.removeEventListener\(\s*"keydown",\s*contentsDialogKeydownHandler/
  );
  // The handler is assigned once per open, not accumulated.
  assert.match(app, /contentsDialogKeydownHandler = \(keyEvent\) => \{/);
  // Every close path (dismiss, select, cancel) goes through closeContentsDialog.
  assert.match(app, /function dismissContents\(\)[\s\S]*closeContentsDialog\(\)/);
  assert.match(app, /function selectBook\(book\)[\s\S]*closeContentsDialog\(\)/);
});

test("Contents modal stacks above completion and keeps keyboard shortcuts inactive while open", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.contents-dialog/);
  assert.match(styles, /\.contents-list \{[\s\S]*overflow-y: auto;/);
  assert.match(app, /const contentsOpen =[\s\S]*if \(contentsOpen\) return;/);
});

// --- Explicit Tab wrap shared by native and fallback modes. ---

function makeTrapContainer(count) {
  const buttons = Array.from({ length: count }, (_, index) => ({
    tag: "button",
    focusCallCount: 0,
    focus() {
      this.focusCallCount += 1;
    },
    getClientRects: () => [{}],
    hasAttribute: () => false
  }));
  return {
    buttons,
    querySelectorAll: () => buttons,
    contains: (element) => buttons.includes(element)
  };
}

test("trapTabKey wraps Tab forward and Shift+Tab backward in the open dialog", () => {
  const container = makeTrapContainer(3);
  const [first, middle, last] = container.buttons;

  // Forward Tab on the last item wraps to the first.
  assert.equal(trapTabKey({ key: "Tab" }, container, last), true);
  assert.equal(first.focusCallCount, 1);
  // Forward Tab elsewhere stays inside (browser moves focus normally).
  assert.equal(trapTabKey({ key: "Tab" }, container, middle), false);
  assert.equal(first.focusCallCount, 1);
  // Shift+Tab on the first item wraps to the last.
  assert.equal(trapTabKey({ key: "Tab", shiftKey: true }, container, first), true);
  assert.equal(last.focusCallCount, 1);
  // Focus that somehow escaped the dialog recovers to the ends.
  const outsideFocus = { tag: "body" };
  assert.equal(trapTabKey({ key: "Tab" }, container, outsideFocus), true);
  assert.equal(first.focusCallCount, 2);
  assert.equal(
    trapTabKey({ key: "Tab", shiftKey: true }, container, outsideFocus),
    true
  );
  assert.equal(last.focusCallCount, 2);
  // Non-Tab keys are untouched.
  assert.equal(trapTabKey({ key: "Escape" }, container, last), false);
});

test("getTabbable keeps only visible enabled controls in dialog order", () => {
  const visible = { hasAttribute: () => false, getClientRects: () => [{}] };
  const hidden = { hasAttribute: () => false, getClientRects: () => [] };
  const disabled = { hasAttribute: (name) => name === "disabled", getClientRects: () => [{}] };
  const container = { querySelectorAll: () => [visible, hidden, disabled] };
  assert.deepEqual(getTabbable(container), [visible]);
});

test("native and fallback dialog modes share one Tab-wrap wiring", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // The handler is registered before the native/fallback branch, so both
  // paths receive it; no separate fallback Tab branch remains.
  const handlerIndex = app.indexOf("contentsDialogKeydownHandler = (keyEvent) =>");
  const branchIndex = app.indexOf("if (supportsNativeDialog) {", handlerIndex);
  assert.ok(handlerIndex > -1 && branchIndex > handlerIndex);
  assert.doesNotMatch(app, /const focusables = focusableElements\(\)/);
  assert.match(app, TAB_TABBABLE_SELECTOR ? /trapTabKey/ : /trapTabKey/);
});

// --- Feedback epoch: stale resume/tone/fallback must not survive a jump. ---

class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

function makeFakeOscillator() {
  return {
    stopped: false,
    disconnected: false,
    onended: null,
    type: "",
    frequency: { setValueAtTime() {} },
    connect() {},
    start() {},
    stop() {
      this.stopped = true;
    },
    disconnect() {
      this.disconnected = true;
    }
  };
}

function makeFakeAudioContext(state) {
  const deferred = new Deferred();
  return {
    state,
    currentTime: 1,
    destination: {},
    resume: () => deferred.promise,
    _deferred: deferred,
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {}
      };
    },
    createOscillator: makeFakeOscillator
  };
}

function makeBells(context) {
  return createFeedbackBells({
    createAudioContext: () => context,
    fallback: {
      correct: { pause() {}, play: async () => {}, currentTime: 0 },
      wrong: { pause() {}, play: async () => {}, currentTime: 0 }
    }
  });
}

test("late resume resolve after a book jump cannot ring the stale feedback", async () => {
  const context = makeFakeAudioContext("suspended");
  const bells = makeBells(context);
  const before = bells.epoch();
  bells.play("correct");
  assert.equal(bells.epoch(), before + 1);
  // A book jump invalidates the epoch before resume resolves.
  bells.cancel(true);
  context._deferred.resolve();
  await context._deferred.promise.catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(bells.state(), {
    oscillators: 0,
    outputs: 0,
    fallbackAudios: 0
  });
});

test("late resume rejection after a book jump cannot start a fallback clip", async () => {
  const context = makeFakeAudioContext("suspended");
  const bells = makeBells(context);
  bells.play("wrong");
  bells.cancel(true);
  context._deferred.reject(new Error("suspended resume failed"));
  await context._deferred.promise.catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bells.state().fallbackAudios, 0);
});

test("rejected resume on the current epoch starts one fallback clip only", async () => {
  const context = makeFakeAudioContext("suspended");
  let played = 0;
  const bells = createFeedbackBells({
    createAudioContext: () => context,
    fallback: {
      wrong: { pause() {}, play: async () => (played += 1), currentTime: 0 }
    }
  });
  bells.play("wrong");
  context._deferred.reject(new Error("resume failed"));
  await context._deferred.promise.catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(played, 1);
  assert.equal(bells.state().fallbackAudios, 0);
});

test("book selection cancels running feedback tones and fallback clips", () => {
  const context = makeFakeAudioContext("running");
  const bells = makeBells(context);
  bells.play("correct");
  const active = bells.state();
  assert.ok(active.oscillators >= 2);
  assert.ok(active.outputs >= 1);
  bells.cancel(true);
  assert.deepEqual(bells.state(), {
    oscillators: 0,
    outputs: 0,
    fallbackAudios: 0
  });
  // Cancellation without epoch invalidation stays available for dismiss paths.
  bells.cancel(false);
  assert.equal(bells.state().oscillators, 0);
});

test("normal same-drill bells are unchanged and Contents dismissal preserves exercise state", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // dismissContents does not touch feedback; only jumpToBook invalidates it.
  const dismissBody = app.slice(
    app.indexOf("function dismissContents()"),
    app.indexOf("function jumpToBook(book)")
  );
  assert.doesNotMatch(dismissBody, /cancelFeedbackAudio/);
  const jumpBody = app.slice(
    app.indexOf("function jumpToBook(book)"),
    app.indexOf("function selectBook(book)")
  );
  assert.match(jumpBody, /cancelFeedbackAudio\(true\)/);
});

test("no-WebAudio fallback clip is paused and rewound by cancel after play resolves", async () => {
  let playResolved = false;
  const fakeClip = {
    paused: false,
    currentTime: 0,
    play() {
      this.paused = false;
      return Promise.resolve().then(() => {
        playResolved = true;
      });
    },
    pause() {
      this.paused = true;
    }
  };
  const bells = createFeedbackBells({
    createAudioContext: () => null,
    fallback: { correct: fakeClip, wrong: fakeClip }
  });
  bells.play("correct");
  // Wait for the play promise to resolve.
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(playResolved, "play() should have resolved");
  assert.equal(fakeClip.paused, false, "clip should be playing before cancel");
  bells.cancel(true);
  assert.equal(fakeClip.paused, true, "clip should be paused after cancel");
  assert.equal(fakeClip.currentTime, 0, "clip currentTime should be rewound to 0");
});

// --- Completion card must stay within the viewport at 320x568 and 375x667. ---

test("completion card uses shrink-safe grid tracks and border-box sizing", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.finish-screen \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(
    styles,
    /\.finish-card \{[\s\S]*box-sizing: border-box;[\s\S]*min-width: 0;[\s\S]*max-width: min\(100%, 520px\);/
  );
  assert.match(
    styles,
    /\.finish-stats \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/
  );
  assert.match(
    styles,
    /\.primary-button,[\s\S]*\.secondary-button \{[\s\S]*white-space: normal;[\s\S]*overflow-wrap: anywhere;/
  );
});

test("completion card h2 shrinks to 2rem at 360px to prevent text clipping", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*\.finish-card h2 \{[\s\S]*font-size: 2rem;/);
});

test("completion card constrains height and scrolls so every button stays reachable", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.finish-card \{[\s\S]*max-height: calc\(100dvh - 48px\);[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/
  );
  // Closed dialog remains hidden; no unconditional display override.
  assert.match(styles, /dialog:where\(\[open\]\)\s*\{[\s\S]*display: block;/);
  assert.doesNotMatch(styles, /\.contents-dialog\s*\{[^}]*display:\s*(block|flex)/);
});


