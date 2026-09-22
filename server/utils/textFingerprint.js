// Text fingerprinting for the internal similarity engine (§4.12 phase 4).
//
// The approach is k-shingles (overlapping word windows) reduced to a MinHash
// signature, which is the standard way to compare documents without loading the
// whole corpus into memory:
//
//   * A shingle set captures "which five-word sequences occur here", so a copied
//     passage survives light editing that a whole-document hash would miss.
//   * The MinHash signature is a fixed 128 integers whose matching positions
//     estimate the Jaccard similarity of two shingle sets. Screening every
//     archived report costs 128 comparisons rather than thousands of set
//     operations, and a signature is a couple of kilobytes instead of hundreds.
//
// Two-stage by design: the signature screens candidates cheaply, then the exact
// shingle sets confirm the handful that survive. A MinHash estimate alone is
// good enough to rank but should not be the number a supervisor is shown.

export const SHINGLE_SIZE = 5;
export const SIGNATURE_LENGTH = 128;

// bump when the tokeniser or shingle size changes, so stored fingerprints can be
// identified as stale rather than silently compared against new ones.
export const ALGORITHM_VERSION = "shingle5-minhash128-v1";

// Deterministic 32-bit finaliser. Stands in for the family of independent hash
// functions MinHash needs: mixing the shingle hash with each seed gives a
// well-distributed value per signature slot.
const mix32 = (x) => {
  let value = x | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
};

// Fixed seeds so a signature computed today is comparable with one computed
// tomorrow, or by a different process.
const SEEDS = (() => {
  const seeds = new Uint32Array(SIGNATURE_LENGTH);
  for (let index = 0; index < SIGNATURE_LENGTH; index += 1) {
    seeds[index] = mix32(index * 0x9e3779b1 + 0x85ebca6b);
  }
  return seeds;
})();

// Lowercase, drop everything that is not a letter, digit or whitespace, then
// split. Punctuation and casing are exactly the things a student changes when
// reusing a paragraph, so normalising them away is the point rather than a
// convenience.
export const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

// FNV-1a over the shingle text. Fast, dependency-free, and stable across
// processes - unlike anything derived from object identity.
const hashShingle = (shingle) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < shingle.length; index += 1) {
    hash ^= shingle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// TipTap/ProseMirror document tree -> plain text, one line per block.
//
// The line breaks matter: the exclusion rules decide whether a line is a heading
// ("References", "Bibliography") by looking at its length, and flattening a whole
// report onto a single line makes every heading look like body prose. Joining
// blocks with a space here was a real bug - it silently disabled section
// exclusion entirely.
//
// Tokenisation collapses whitespace, so this does not change the shingle stream
// or any stored fingerprint; it only restores the document's structure.
export const plainTextFromDocumentTree = (tree) => {
  if (!tree || typeof tree !== "object") return "";

  const textOf = (node) => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textOf).join(" ").trim();

    const own = typeof node.text === "string" ? node.text : "";
    const children = Array.isArray(node.content) ? node.content.map(textOf).join(" ") : "";

    return [own, children].filter(Boolean).join(" ").trim();
  };

  // A document tree has one child per block; each becomes a line.
  const blocks = Array.isArray(tree.content) ? tree.content : null;
  if (!blocks) return textOf(tree);

  return blocks
    .map((block) => textOf(block))
    .filter(Boolean)
    .join("\n")
    .trim();
};

// Build the reusable fingerprint of a document.
export const fingerprintText = (text) => {
  const tokens = tokenize(text);

  if (tokens.length < SHINGLE_SIZE) {
    return {
      algorithmVersion: ALGORITHM_VERSION,
      wordCount: tokens.length,
      shingles: [],
      signature: new Array(SIGNATURE_LENGTH).fill(0),
      // No shingle can be formed, so nothing can be compared. Reported as zero
      // rather than faked, and the caller decides what to do about it.
      comparable: false,
    };
  }

  const seen = new Set();
  const shingles = [];
  const firstIndexByHash = new Map();

  for (let index = 0; index + SHINGLE_SIZE <= tokens.length; index += 1) {
    const hash = hashShingle(tokens.slice(index, index + SHINGLE_SIZE).join(" "));
    if (seen.has(hash)) continue;
    seen.add(hash);
    shingles.push(hash);
    // Retained so a shared shingle can be turned back into an excerpt.
    if (!firstIndexByHash.has(hash)) firstIndexByHash.set(hash, index);
  }

  const signature = new Array(SIGNATURE_LENGTH).fill(0xffffffff);
  for (const hash of shingles) {
    for (let slot = 0; slot < SIGNATURE_LENGTH; slot += 1) {
      const candidate = mix32(hash ^ SEEDS[slot]);
      if (candidate < signature[slot]) signature[slot] = candidate;
    }
  }

  return {
    algorithmVersion: ALGORITHM_VERSION,
    wordCount: tokens.length,
    shingles,
    signature,
    firstIndexByHash,
    comparable: shingles.length > 0,
  };
};

// Estimated Jaccard similarity from two signatures. Cheap enough to run against
// every archived report.
export const estimateSimilarity = (signatureA, signatureB) => {
  if (!Array.isArray(signatureA) || !Array.isArray(signatureB)) return 0;
  if (signatureA.length !== signatureB.length || signatureA.length === 0) return 0;

  let matches = 0;
  for (let index = 0; index < signatureA.length; index += 1) {
    if (signatureA[index] === signatureB[index]) matches += 1;
  }

  return matches / signatureA.length;
};

// Exact Jaccard similarity over the shingle sets. Only run on candidates the
// signature screen has already promoted.
export const exactSimilarity = (shinglesA, shinglesB) => {
  if (!Array.isArray(shinglesA) || !Array.isArray(shinglesB)) return { score: 0, shared: [] };
  if (shinglesA.length === 0 || shinglesB.length === 0) return { score: 0, shared: [] };

  const setB = new Set(shinglesB);
  const shared = [];
  for (const hash of shinglesA) {
    if (setB.has(hash)) shared.push(hash);
  }

  const union = new Set([...shinglesA, ...shinglesB]).size;
  return { score: union === 0 ? 0 : shared.length / union, shared, sharedCount: shared.length };
};

// A representative excerpt around a shared shingle.
//
// Deliberately a window rather than the whole matched passage: enough for a
// supervisor to recognise the reuse and judge whether it is a quotation, without
// turning the match table into a second copy of the corpus.
export const excerptAround = (tokens, startIndex, context = 25) => {
  if (!Array.isArray(tokens) || startIndex === undefined || startIndex === null) return null;
  const from = Math.max(0, startIndex - 3);
  const to = Math.min(tokens.length, from + context);
  return tokens.slice(from, to).join(" ");
};

export default {
  SHINGLE_SIZE,
  SIGNATURE_LENGTH,
  ALGORITHM_VERSION,
  tokenize,
  plainTextFromDocumentTree,
  fingerprintText,
  estimateSimilarity,
  exactSimilarity,
  excerptAround,
};
