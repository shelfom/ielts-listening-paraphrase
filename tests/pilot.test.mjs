import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { ALL_DRILLS, ALL_TESTS, COURSE, PEP_TALKS, audioKey, correctPosition } from "../data.js";

test("course covers Books 11–19 from required through higher risk of", () => {
  assert.equal(COURSE.tests.length, 36);
  assert.equal(COURSE.total, 1825);
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
  assert.equal(ALL_DRILLS.at(-1).book, 19);
  assert.equal(ALL_DRILLS.at(-1).test, 4);
  assert.equal(ALL_DRILLS.at(-1).part, 4);
  assert.equal(ALL_DRILLS.at(-1).question, "higher risk of");
  assert.equal(ALL_DRILLS.at(-1).answer, "increased threat of");
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

test("ids, audio keys, and Book 20 readiness remain stable", () => {
  assert.equal(new Set(ALL_DRILLS.map((drill) => drill.id)).size, 1825);
  assert.equal(audioKey("don't touch"), "dont-touch");
  assert.equal(audioKey("you'll be informed of"), "youll-be-informed-of");
  assert.equal(audioKey("STEM disciplines"), "stem-disciplines");
  assert.equal(COURSE.futureBookReady, 20);
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

test("Choose controls stay above card layers, start active, and reveal on the first selection", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(styles, /\.option-card \.card-actions \{[\s\S]*position: relative;[\s\S]*z-index: 4;/);
  assert.match(styles, /\.option-card \.listen-action,[\s\S]*\.option-card \.choose-button \{[\s\S]*position: relative;[\s\S]*z-index: 5;[\s\S]*touch-action: manipulation;/);
  assert.doesNotMatch(app, /setInstruction\("Try again"/);
  assert.match(app, /card\.classList\.toggle\("is-wrong", index === selectedIndex && !selected\.correct\)/);
  assert.match(app, /text\.textContent = options\[index\]\.text;/);
  assert.match(worker, /const cacheName = "ielts-listening-books-11-19-v9";/);
  assert.match(app, /navigator\.serviceWorker\.register\("\/sw\.js\?release=v9"\)/);
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
  const navigation = html.indexOf('class="practice-nav"');
  const cards = html.indexOf('class="audio-stage"');
  assert.ok(navigation > cards);
  assert.match(html, /class="text-button back-button"/);
  assert.match(html, /class="text-button next-button"/);
});

test("the word Listen control sits in the same lower-right choice row", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.question-card \.card-actions\.single-action \{[\s\S]*inset: auto 0 0;[\s\S]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
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
