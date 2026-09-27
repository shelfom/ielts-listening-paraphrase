// Contents navigation helpers.
// Pure functions are kept framework-free and covered by tests/pilot.test.mjs.

/**
 * Build the ordered list of books from COURSE test metadata (first occurrence).
 * Future books appear automatically; no hardcoded list or offsets.
 *
 * @param {{ tests: Array<{ book: number }> }} course
 * @returns {Array<{ book: number, firstTestIndex: number }>}
 */
export function buildBookIndex(course) {
  const seen = new Map();
  course.tests.forEach((test, index) => {
    if (!seen.has(test.book)) {
      seen.set(test.book, { book: test.book, firstTestIndex: index });
    }
  });
  return [...seen.values()].sort((a, b) => a.book - b.book);
}

/**
 * Resolve the first available test index for a book (e.g. Book 12 starts at Test 5).
 * Returns -1 when the book is unknown.
 *
 * @param {{ tests: Array<{ book: number }> }} course
 * @param {number} book
 * @returns {number}
 */
export function firstTestIndex(course, book) {
  return course.tests.findIndex((test) => test.book === book);
}

/**
 * Compute the state changes for a book jump without mutating the source state.
 * The `results` object is passed through untouched and returned by reference.
 *
 * @param {{ testIndex: number, drillIndex: number, results: Object }} state
 * @param {number} targetTestIndex
 * @returns {{ testIndex: number, drillIndex: number, results: Object }}
 */
export function prepareBookJump(state, targetTestIndex) {
  return {
    testIndex: targetTestIndex,
    drillIndex: 0,
    results: state.results
  };
}

// --- Play guard: invalidate stale asynchronous play callbacks/events. ---

export function createPlayGuard() {
  let epoch = 0;
  return {
    stop() {
      epoch += 1;
      return epoch;
    },
    current() {
      return epoch;
    },
    isCurrent(value) {
      return value === epoch;
    }
  };
}
