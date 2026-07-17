export const COURSE = {
  product: "IELTS Listening Paraphrase",
  book: 11,
  test: 1,
  total: 30,
  futureBookReady: 20,
  parts: [
    { number: 1, title: "Hiring a public room" },
    { number: 2, title: "Fiddy working heritage farm" },
    { number: 3, title: "Study on gender in physics" },
    { number: 4, title: "Ocean biodiversity" }
  ],
  drills: [
    { id: "11-1-1-01", part: 1, question: "required", answer: "we do insist", distractor: "collected up" },
    { id: "11-1-1-02", part: 1, question: "will need", answer: "have to see about getting", distractor: "no one fiddles about with" },
    { id: "11-1-1-03", part: 1, question: "in advance", answer: "before", distractor: "let know" },
    { id: "11-1-1-04", part: 1, question: "to arrange", answer: "to make the arrangements", distractor: "stacked up" },
    { id: "11-1-1-05", part: 1, question: "don't touch", answer: "no one fiddles about with", distractor: "before" },
    { id: "11-1-1-06", part: 1, question: "contact", answer: "let know", distractor: "have to see about getting" },
    { id: "11-1-1-07", part: 1, question: "need to know", answer: "you'll be informed of", distractor: "to make the arrangements" },
    { id: "11-1-1-08", part: 1, question: "placed", answer: "collected up", distractor: "we do insist" },
    { id: "11-1-1-09", part: 1, question: "piled up", answer: "stacked up", distractor: "you'll be informed of" },

    { id: "11-1-2-01", part: 2, question: "advice", answer: "tips", distractor: "injure" },
    { id: "11-1-2-02", part: 2, question: "harm", answer: "injure", distractor: "unless" },
    { id: "11-1-2-03", part: 2, question: "exceptions", answer: "unless", distractor: "tips" },

    { id: "11-1-3-01", part: 3, question: "science, technology, engineering or mathematics", answer: "STEM disciplines", distractor: "got same results" },
    { id: "11-1-3-02", part: 3, question: "way to improving", answer: "solution", distractor: "significant" },
    { id: "11-1-3-03", part: 3, question: "investigate", answer: "find out", distractor: "get poor results" },
    { id: "11-1-3-04", part: 3, question: "do badly", answer: "get poor results", distractor: "the idea of" },
    { id: "11-1-3-05", part: 3, question: "important", answer: "significant", distractor: "hadn't expected" },
    { id: "11-1-3-06", part: 3, question: "aim", answer: "the idea of", distractor: "STEM disciplines" },
    { id: "11-1-3-07", part: 3, question: "surprised", answer: "hadn't expected", distractor: "solution" },
    { id: "11-1-3-08", part: 3, question: "had no effect on", answer: "got same results", distractor: "find out" },

    { id: "11-1-4-01", part: 4, question: "contain", answer: "have", distractor: "boundaries" },
    { id: "11-1-4-02", part: 4, question: "many different", answer: "the greatest mixture of", distractor: "below" },
    { id: "11-1-4-03", part: 4, question: "important", answer: "significant", distractor: "so that" },
    { id: "11-1-4-04", part: 4, question: "sufficient", answer: "enough", distractor: "create" },
    { id: "11-1-4-05", part: 4, question: "where meet", answer: "boundaries", distractor: "have" },
    { id: "11-1-4-06", part: 4, question: "under", answer: "below", distractor: "the greatest mixture of" },
    { id: "11-1-4-07", part: 4, question: "near", answer: "around", distractor: "significant" },
    { id: "11-1-4-08", part: 4, question: "establish", answer: "create", distractor: "enough" },
    { id: "11-1-4-09", part: 4, question: "reduce", answer: "lower", distractor: "around" },
    { id: "11-1-4-10", part: 4, question: "purpose", answer: "so that", distractor: "lower" }
  ]
};

export function audioKey(text) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-{2,}/g, "-");
}

export function audioPath(voice, text) {
  return `/audio/${voice}/${audioKey(text)}.mp3`;
}

export function correctIsLeft(index) {
  return index % 4 === 0 || index % 4 === 3;
}
