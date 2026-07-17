import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { COURSE, audioKey, correctPosition } from "../data.js";

test("pilot contains Cambridge 11 Test 1 from required to purpose", () => {
  assert.equal(COURSE.book, 11);
  assert.equal(COURSE.test, 1);
  assert.equal(COURSE.drills.length, 30);
  assert.equal(COURSE.drills[0].question, "required");
  assert.equal(COURSE.drills[0].answer, "we do insist");
  assert.equal(COURSE.drills[0].distractor, "collected up");
  assert.equal(COURSE.drills[0].distractor2, "before");
  assert.equal(COURSE.drills.at(-1).question, "purpose");
  assert.equal(COURSE.drills.at(-1).answer, "so that");
});

test("all four Parts have the workbook counts", () => {
  const counts = new Map();
  COURSE.drills.forEach((drill) => counts.set(drill.part, (counts.get(drill.part) || 0) + 1));
  assert.deepEqual(Object.fromEntries(counts), { 1: 9, 2: 3, 3: 8, 4: 10 });
});

test("both distractors come from answers in the same Part", () => {
  for (const drill of COURSE.drills) {
    const samePartAnswers = COURSE.drills
      .filter((candidate) => candidate.part === drill.part)
      .map((candidate) => candidate.answer);
    assert.ok(samePartAnswers.includes(drill.distractor), drill.id);
    assert.ok(samePartAnswers.includes(drill.distractor2), drill.id);
    assert.notEqual(drill.answer, drill.distractor, drill.id);
    assert.notEqual(drill.answer, drill.distractor2, drill.id);
    assert.notEqual(drill.distractor, drill.distractor2, drill.id);
  }
});

test("three answer positions are deterministic and perfectly balanced", () => {
  const positions = [0, 1, 2].map(
    (position) => COURSE.drills.filter((_, index) => correctPosition(index) === position).length
  );
  assert.deepEqual(positions, [10, 10, 10]);
});

test("ids and audio keys are stable", () => {
  assert.equal(new Set(COURSE.drills.map((drill) => drill.id)).size, 30);
  assert.equal(audioKey("don't touch"), "dont-touch");
  assert.equal(audioKey("you'll be informed of"), "youll-be-informed-of");
  assert.equal(audioKey("STEM disciplines"), "stem-disciplines");
});

test("Book 20 is supported by data, not hard-coded totals", () => {
  assert.equal(COURSE.futureBookReady, 20);
  assert.equal(COURSE.total, COURSE.drills.length);
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

test("current and next drill audio are held in a persistent preload pool", () => {
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
  assert.ok(navigation > -1);
  assert.ok(cards > -1);
  assert.ok(navigation > cards);
  assert.match(html, /class="text-button back-button"/);
  assert.match(html, /class="text-button next-button"/);
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
