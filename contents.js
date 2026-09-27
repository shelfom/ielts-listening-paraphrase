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

// --- Focus trap: shared by native <dialog> and the fallback layer. ---

export const TAB_TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Return the visible, enabled tabbable elements inside a container.
 *
 * @param {Element} container
 * @returns {Element[]}
 */
export function getTabbable(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return [];
  }
  return [...container.querySelectorAll(TAB_TABBABLE_SELECTOR)].filter(
    (element) => {
      if (element.hasAttribute('disabled')) return false;
      if (typeof element.getClientRects === 'function') {
        return element.getClientRects().length > 0;
      }
      return true;
    }
  );
}

/**
 * Handle Tab / Shift+Tab wrapping inside `container`. Used in both native and
 * fallback modes so focus can never escape the dialog while it is open.
 *
 * @param {{ key: string, shiftKey?: boolean }} event
 * @param {Element} container
 * @param {Element} activeElement
 * @returns {boolean} true when the event was handled (caller must preventDefault)
 */
export function trapTabKey(event, container, activeElement) {
  if (!event || event.key !== 'Tab') return false;
  const items = getTabbable(container);
  if (items.length === 0) return true;
  const first = items[0];
  const last = items[items.length - 1];
  const inside =
    typeof container.contains === 'function'
      ? container.contains(activeElement)
      : false;

  if (event.shiftKey) {
    if (!inside || activeElement === first) {
      last.focus();
      return true;
    }
  } else {
    if (!inside || activeElement === last) {
      first.focus();
      return true;
    }
  }
  return false;
}
