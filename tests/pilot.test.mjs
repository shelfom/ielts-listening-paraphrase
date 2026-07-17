import test from "node:test";
import assert from "node:assert/strict";
import { COURSE, audioKey, correctIsLeft } from "../data.js";

test("pilot contains Cambridge 11 Test 1 from required to purpose", () => {
  assert.equal(COURSE.book, 11);
  assert.equal(COURSE.test, 1);
  assert.equal(COURSE.drills.length, 30);
  assert.equal(COURSE.drills[0].question, "required");
  assert.equal(COURSE.drills[0].answer, "we do insist");
  assert.equal(COURSE.drills[0].distractor, "collected up");
  assert.equal(COURSE.drills.at(-1).question, "purpose");
  assert.equal(COURSE.drills.at(-1).answer, "so that");
});

test("all four Parts have the workbook counts", () => {
  const counts = new Map();
  COURSE.drills.forEach((drill) => counts.set(drill.part, (counts.get(drill.part) || 0) + 1));
  assert.deepEqual(Object.fromEntries(counts), { 1: 9, 2: 3, 3: 8, 4: 10 });
});

test("every distractor comes from an answer in the same Part", () => {
  for (const drill of COURSE.drills) {
    const samePartAnswers = COURSE.drills
      .filter((candidate) => candidate.part === drill.part)
      .map((candidate) => candidate.answer);
    assert.ok(samePartAnswers.includes(drill.distractor), drill.id);
    assert.notEqual(drill.answer, drill.distractor, drill.id);
  }
});

test("answer positions are deterministic and perfectly balanced", () => {
  const left = COURSE.drills.filter((_, index) => correctIsLeft(index)).length;
  assert.equal(left, 15);
  assert.equal(COURSE.drills.length - left, 15);
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
