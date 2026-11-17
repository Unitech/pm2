'use strict';

// Bounded brace expansion, replaces braces.expand() in WatchHelper#getDirParts
// (braces: GHSA-vfj7-8cjw-p6xm, no patched release).
// Supports `{a,b}` alternatives (nested, empty items) and `{x..y[..step]}`
// numeric (zero padded) and letter ranges, with the results of braces@3.0.3.
// Brace-free `[...]` / `(...)` chunks (globs, `Program Files (x86)`) pass
// through as text. Anything else, or past a limit, returns null: the caller
// then disables glob directory pruning (see VENDORED.md). Never throws.

const MAX_PATTERN_LENGTH = 10000;
const MAX_DEPTH = 10;
const MAX_EXPANSIONS = 256;
const MAX_OUTPUT_CHARS = 1e6;

// escapes, quotes and `${` follow braces-specific rules
const UNSUPPORTED_RE = /[\\'"`\u00a0\ufeff]|\$\{/;
// `[...]` / `(...)` without brace syntax are opaque literal text in braces
const OPAQUE_RE = /\[[^\][(){},.]*\]|\([^\][(){},.]*\)/g;
// any other bracket or paren: nested, unbalanced or wrapping brace syntax
const LEFTOVER_RE = /[[\]()]/;
const RANGE_RE = /^(-?\d+|[a-zA-Z])\.\.(-?\d+|[a-zA-Z])(?:\.\.(-?\d+))?$/;
const INT_RE = /^-?\d+$/;
const DOTS = '..';

// fill-range pads when a bound or the step is written with a leading zero
const isPadded = (str) => /^-?0\d/.test(str);

const pad = (str, len) => {
  const dash = str[0] === '-' ? '-' : '';
  return dash + str.slice(dash.length).padStart(len - dash.length, '0');
};

// `{from..to[..step]}`: string[], null if unsupported or too long
const fillRange = (from, to, stepStr = '1') => {
  const numeric = INT_RE.test(from) && INT_RE.test(to);
  // digit against letter: braces mixes char codes
  if (!numeric && (INT_RE.test(from) || INT_RE.test(to))) return null;
  const a = numeric ? Number(from) : from.charCodeAt(0);
  const b = numeric ? Number(to) : to.charCodeAt(0);
  const step = Math.abs(Number(stepStr)) || 1;
  if (![a, b, step].every(Number.isSafeInteger)) return null;
  if (Math.floor(Math.abs(b - a) / step) + 1 > MAX_EXPANSIONS) return null;
  const len = numeric && [from, to, stepStr].some(isPadded) ?
    Math.max(from.length, to.length, stepStr.length) : 0;
  const out = [];
  const desc = a > b;
  for (let i = a; desc ? i >= b : i <= b; i += desc ? -step : step) {
    out.push(numeric ? (len ? pad(String(i), len) : String(i)) : String.fromCharCode(i));
  }
  return out;
};

// Group tree: {parts: item[][]}, item = string | group. Nesting bounded by MAX_DEPTH
const scan = (str) => {
  const root = {parts: [[]]};
  const stack = [root];
  for (const ch of str) {
    const top = stack[stack.length - 1];
    const items = top.parts[top.parts.length - 1];
    if (ch === '{') {
      if (stack.length > MAX_DEPTH) return null;
      const group = {parts: [[]]};
      items.push(group);
      stack.push(group);
    } else if (ch === ',' && top !== root) {
      top.parts.push([]);
    } else if (ch === '}') {
      // stray `}`: kept literal by braces
      if (top === root) return null;
      stack.pop();
    } else if (typeof items[items.length - 1] === 'string') {
      items[items.length - 1] += ch;
    } else {
      items.push(ch);
    }
  }
  // unclosed `{`: kept literal by braces
  return stack.length === 1 ? root.parts[0] : null;
};

// Node: string | {seq: node[]} | {alt: node[]} | {range: string[]}
const toSeq = (items) => {
  const seq = [];
  for (const item of items) {
    const node = typeof item === 'string' ? item : toGroup(item);
    if (node === null) return null;
    seq.push(node);
  }
  return {seq};
};

const toGroup = ({parts}) => {
  if (parts.length === 1) {
    // single item braces (`{a}`, `{}`) are literal in braces
    const body = parts[0].length === 1 && typeof parts[0][0] === 'string' ? parts[0][0] : '';
    const m = RANGE_RE.exec(body);
    const range = m && fillRange(m[1], m[2], m[3]);
    return range ? {range} : null;
  }
  const alt = [];
  for (const part of parts) {
    // `..` inside an alternation goes through braces' range state machine
    if (part.some((item) => typeof item === 'string' && item.includes(DOTS))) return null;
    const seq = toSeq(part);
    if (seq === null) return null;
    alt.push(seq);
  }
  return {alt};
};

// Saturating {count, chars} computed before anything is built, null past a limit
const measure = (node) => {
  let count = 0;
  let chars = 0;
  if (typeof node === 'string') {
    count = 1;
    chars = node.length;
  } else if (node.range) {
    count = node.range.length;
    for (const s of node.range) chars += s.length;
  } else if (node.alt) {
    for (const part of node.alt) {
      const m = measure(part);
      if (m === null) return null;
      count += m.count;
      chars += m.chars;
      // early exit on long alternations, the enclosing seq checks too
      if (count > MAX_EXPANSIONS || chars > MAX_OUTPUT_CHARS) return null;
    }
  } else {
    count = 1;
    for (const item of node.seq) {
      const m = measure(item);
      if (m === null) return null;
      chars = chars * m.count + m.chars * count;
      count *= m.count;
      if (count > MAX_EXPANSIONS || chars > MAX_OUTPUT_CHARS) return null;
    }
  }
  return {count, chars};
};

// Cartesian product, left-major like braces, no dedupe
const materialize = (node) => {
  if (typeof node === 'string') return [node];
  if (node.range) return node.range;
  if (node.alt) return [].concat(...node.alt.map(materialize));
  let acc = [''];
  for (const item of node.seq) {
    const values = materialize(item);
    const next = [];
    for (const prefix of acc) {
      for (const value of values) next.push(prefix + value);
    }
    acc = next;
  }
  return acc;
};

/**
 * @param {String} str glob
 * @returns {String[]|null} expansions, or null if unsupported / over a limit
 */
const expandBraces = (str) => {
  // braces.expand('') is [], nothing to expand anyway
  if (typeof str !== 'string' || !str || str.length > MAX_PATTERN_LENGTH) return null;
  if (UNSUPPORTED_RE.test(str)) return null;
  if (LEFTOVER_RE.test(str.replace(OPAQUE_RE, ''))) return null;
  const items = scan(str);
  const tree = items && toSeq(items);
  if (!tree || measure(tree) === null) return null;
  return materialize(tree);
};

module.exports = expandBraces;
module.exports.MAX_PATTERN_LENGTH = MAX_PATTERN_LENGTH;
module.exports.MAX_DEPTH = MAX_DEPTH;
module.exports.MAX_EXPANSIONS = MAX_EXPANSIONS;
module.exports.MAX_OUTPUT_CHARS = MAX_OUTPUT_CHARS;
