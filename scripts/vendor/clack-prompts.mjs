var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/sisteransi/src/index.js
var require_src = __commonJS({
  "node_modules/sisteransi/src/index.js"(exports, module) {
    "use strict";
    var ESC2 = "\x1B";
    var CSI2 = `${ESC2}[`;
    var beep = "\x07";
    var cursor3 = {
      to(x, y) {
        if (!y) return `${CSI2}${x + 1}G`;
        return `${CSI2}${y + 1};${x + 1}H`;
      },
      move(x, y) {
        let ret = "";
        if (x < 0) ret += `${CSI2}${-x}D`;
        else if (x > 0) ret += `${CSI2}${x}C`;
        if (y < 0) ret += `${CSI2}${-y}A`;
        else if (y > 0) ret += `${CSI2}${y}B`;
        return ret;
      },
      up: (count = 1) => `${CSI2}${count}A`,
      down: (count = 1) => `${CSI2}${count}B`,
      forward: (count = 1) => `${CSI2}${count}C`,
      backward: (count = 1) => `${CSI2}${count}D`,
      nextLine: (count = 1) => `${CSI2}E`.repeat(count),
      prevLine: (count = 1) => `${CSI2}F`.repeat(count),
      left: `${CSI2}G`,
      hide: `${CSI2}?25l`,
      show: `${CSI2}?25h`,
      save: `${ESC2}7`,
      restore: `${ESC2}8`
    };
    var scroll = {
      up: (count = 1) => `${CSI2}S`.repeat(count),
      down: (count = 1) => `${CSI2}T`.repeat(count)
    };
    var erase3 = {
      screen: `${CSI2}2J`,
      up: (count = 1) => `${CSI2}1J`.repeat(count),
      down: (count = 1) => `${CSI2}J`.repeat(count),
      line: `${CSI2}2K`,
      lineEnd: `${CSI2}K`,
      lineStart: `${CSI2}1K`,
      lines(count) {
        let clear = "";
        for (let i2 = 0; i2 < count; i2++)
          clear += this.line + (i2 < count - 1 ? cursor3.up() : "");
        if (count)
          clear += cursor3.left;
        return clear;
      }
    };
    module.exports = { cursor: cursor3, scroll, erase: erase3, beep };
  }
});

// node_modules/@clack/core/dist/index.mjs
import { stdout, stdin } from "node:process";
import * as l from "node:readline";
import l__default from "node:readline";

// node_modules/fast-string-truncated-width/dist/utils.js
var getCodePointsLength = /* @__PURE__ */ (() => {
  const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  return (input) => {
    let surrogatePairsNr = 0;
    SURROGATE_PAIR_RE.lastIndex = 0;
    while (SURROGATE_PAIR_RE.test(input)) {
      surrogatePairsNr += 1;
    }
    return input.length - surrogatePairsNr;
  };
})();
var isFullWidth = (x) => {
  return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
var isWideNotCJKTNotEmoji = (x) => {
  return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};

// node_modules/fast-string-truncated-width/dist/index.js
var ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
var CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
var TAB_RE = /\t{1,1000}/y;
var EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/yu;
var LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var MODIFIER_RE = /\p{M}+/gu;
var NO_TRUNCATION = { limit: Infinity, ellipsis: "" };
var getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
  const LIMIT = truncationOptions.limit ?? Infinity;
  const ELLIPSIS = truncationOptions.ellipsis ?? "";
  const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
  const ANSI_WIDTH = 0;
  const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
  const TAB_WIDTH = widthOptions.tabWidth ?? 8;
  const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
  const FULL_WIDTH_WIDTH = 2;
  const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
  const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
  const PARSE_BLOCKS = [
    [LATIN_RE, REGULAR_WIDTH],
    [ANSI_RE, ANSI_WIDTH],
    [CONTROL_RE, CONTROL_WIDTH],
    [TAB_RE, TAB_WIDTH],
    [EMOJI_RE, EMOJI_WIDTH],
    [CJKT_WIDE_RE, WIDE_WIDTH]
  ];
  let indexPrev = 0;
  let index = 0;
  let length = input.length;
  let lengthExtra = 0;
  let truncationEnabled = false;
  let truncationIndex = length;
  let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
  let unmatchedStart = 0;
  let unmatchedEnd = 0;
  let width = 0;
  let widthExtra = 0;
  outer: while (true) {
    if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
      const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
      lengthExtra = 0;
      for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
        const codePoint = char.codePointAt(0) || 0;
        if (isFullWidth(codePoint)) {
          widthExtra = FULL_WIDTH_WIDTH;
        } else if (isWideNotCJKTNotEmoji(codePoint)) {
          widthExtra = WIDE_WIDTH;
        } else {
          widthExtra = REGULAR_WIDTH;
        }
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        lengthExtra += char.length;
        width += widthExtra;
      }
      unmatchedStart = unmatchedEnd = 0;
    }
    if (index >= length) {
      break outer;
    }
    for (let i2 = 0, l2 = PARSE_BLOCKS.length; i2 < l2; i2++) {
      const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i2];
      BLOCK_RE.lastIndex = index;
      if (BLOCK_RE.test(input)) {
        lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
        widthExtra = lengthExtra * BLOCK_WIDTH;
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        width += widthExtra;
        unmatchedStart = indexPrev;
        unmatchedEnd = index;
        index = indexPrev = BLOCK_RE.lastIndex;
        continue outer;
      }
    }
    index += 1;
  }
  return {
    width: truncationEnabled ? truncationLimit : width,
    index: truncationEnabled ? truncationIndex : length,
    truncated: truncationEnabled,
    ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
  };
};
var dist_default = getStringTruncatedWidth;

// node_modules/fast-string-width/dist/index.js
var NO_TRUNCATION2 = {
  limit: Infinity,
  ellipsis: "",
  ellipsisWidth: 0
};
var fastStringWidth = (input, options = {}) => {
  return dist_default(input, NO_TRUNCATION2, options).width;
};
var dist_default2 = fastStringWidth;

// node_modules/fast-wrap-ansi/lib/main.js
var ESC = "\x1B";
var CSI = "\x9B";
var END_CODE = 39;
var ANSI_ESCAPE_BELL = "\x07";
var ANSI_CSI = "[";
var ANSI_OSC = "]";
var ANSI_SGR_TERMINATOR = "m";
var ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
var GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
var getClosingCode = (openingCode) => {
  if (openingCode >= 30 && openingCode <= 37)
    return 39;
  if (openingCode >= 90 && openingCode <= 97)
    return 39;
  if (openingCode >= 40 && openingCode <= 47)
    return 49;
  if (openingCode >= 100 && openingCode <= 107)
    return 49;
  if (openingCode === 1 || openingCode === 2)
    return 22;
  if (openingCode === 3)
    return 23;
  if (openingCode === 4)
    return 24;
  if (openingCode === 7)
    return 27;
  if (openingCode === 8)
    return 28;
  if (openingCode === 9)
    return 29;
  if (openingCode === 0)
    return 0;
  return void 0;
};
var wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
var wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
var wrapWord = (rows, word, columns) => {
  const characters = word[Symbol.iterator]();
  let isInsideEscape = false;
  let isInsideLinkEscape = false;
  let lastRow = rows.at(-1);
  let visible = lastRow === void 0 ? 0 : dist_default2(lastRow);
  let currentCharacter = characters.next();
  let nextCharacter = characters.next();
  let rawCharacterIndex = 0;
  while (!currentCharacter.done) {
    const character = currentCharacter.value;
    const characterLength = dist_default2(character);
    if (visible + characterLength <= columns) {
      rows[rows.length - 1] += character;
    } else {
      rows.push(character);
      visible = 0;
    }
    if (character === ESC || character === CSI) {
      isInsideEscape = true;
      isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
    }
    if (isInsideEscape) {
      if (isInsideLinkEscape) {
        if (character === ANSI_ESCAPE_BELL) {
          isInsideEscape = false;
          isInsideLinkEscape = false;
        }
      } else if (character === ANSI_SGR_TERMINATOR) {
        isInsideEscape = false;
      }
    } else {
      visible += characterLength;
      if (visible === columns && !nextCharacter.done) {
        rows.push("");
        visible = 0;
      }
    }
    currentCharacter = nextCharacter;
    nextCharacter = characters.next();
    rawCharacterIndex += character.length;
  }
  lastRow = rows.at(-1);
  if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) {
    rows[rows.length - 2] += rows.pop();
  }
};
var stringVisibleTrimSpacesRight = (string) => {
  const words = string.split(" ");
  let last = words.length;
  while (last) {
    if (dist_default2(words[last - 1])) {
      break;
    }
    last--;
  }
  if (last === words.length) {
    return string;
  }
  return words.slice(0, last).join(" ") + words.slice(last).join("");
};
var exec = (string, columns, options = {}) => {
  if (options.trim !== false && string.trim() === "") {
    return "";
  }
  let returnValue = "";
  let escapeCode;
  let escapeUrl;
  const words = string.split(" ");
  let rows = [""];
  let rowLength = 0;
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (options.trim !== false) {
      const row = rows.at(-1) ?? "";
      const trimmed = row.trimStart();
      if (row.length !== trimmed.length) {
        rows[rows.length - 1] = trimmed;
        rowLength = dist_default2(trimmed);
      }
    }
    if (index !== 0) {
      if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
        rows.push("");
        rowLength = 0;
      }
      if (rowLength || options.trim === false) {
        rows[rows.length - 1] += " ";
        rowLength++;
      }
    }
    const wordLength = dist_default2(word);
    if (options.hard && wordLength > columns) {
      const remainingColumns = columns - rowLength;
      const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
      const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
      if (breaksStartingNextLine < breaksStartingThisLine) {
        rows.push("");
      }
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    if (rowLength + wordLength > columns && rowLength && wordLength) {
      if (options.wordWrap === false && rowLength < columns) {
        wrapWord(rows, word, columns);
        rowLength = dist_default2(rows.at(-1) ?? "");
        continue;
      }
      rows.push("");
      rowLength = 0;
    }
    if (rowLength + wordLength > columns && options.wordWrap === false) {
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    rows[rows.length - 1] += word;
    rowLength += wordLength;
  }
  if (options.trim !== false) {
    rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
  }
  const preString = rows.join("\n");
  let inSurrogate = false;
  for (let i2 = 0; i2 < preString.length; i2++) {
    const character = preString[i2];
    returnValue += character;
    if (!inSurrogate) {
      inSurrogate = character >= "\uD800" && character <= "\uDBFF";
      if (inSurrogate) {
        continue;
      }
    } else {
      inSurrogate = false;
    }
    if (character === ESC || character === CSI) {
      GROUP_REGEX.lastIndex = i2 + 1;
      const groupsResult = GROUP_REGEX.exec(preString);
      const groups = groupsResult?.groups;
      if (groups?.code !== void 0) {
        const code = Number.parseFloat(groups.code);
        escapeCode = code === END_CODE ? void 0 : code;
      } else if (groups?.uri !== void 0) {
        escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
      }
    }
    if (preString[i2 + 1] === "\n") {
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink("");
      }
      const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
      if (escapeCode && closingCode) {
        returnValue += wrapAnsiCode(closingCode);
      }
    } else if (character === "\n") {
      if (escapeCode && getClosingCode(escapeCode)) {
        returnValue += wrapAnsiCode(escapeCode);
      }
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink(escapeUrl);
      }
    }
  }
  return returnValue;
};
var CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
  return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}

// node_modules/@clack/core/dist/index.mjs
var import_sisteransi = __toESM(require_src(), 1);
import { ReadStream } from "node:tty";
function findCursor(s, o, l2) {
  if (!l2.some((r2) => !r2.disabled))
    return s;
  const t2 = s + o, n3 = Math.max(l2.length - 1, 0), e = t2 < 0 ? n3 : t2 > n3 ? 0 : t2;
  return l2[e]?.disabled ? findCursor(e, o < 0 ? -1 : 1, l2) : e;
}
var a$1 = ["up", "down", "left", "right", "space", "enter", "cancel"];
var t = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var settings = {
  actions: new Set(a$1),
  aliases: /* @__PURE__ */ new Map([
    // vim support
    ["k", "up"],
    ["j", "down"],
    ["h", "left"],
    ["l", "right"],
    ["", "cancel"],
    // opinionated defaults!
    ["escape", "cancel"]
  ]),
  messages: {
    cancel: "Canceled",
    error: "Something went wrong"
  },
  withGuide: true,
  date: {
    monthNames: [...t],
    messages: {
      required: "Please enter a valid date",
      invalidMonth: "There are only 12 months in a year",
      invalidDay: (n3, e) => `There are only ${n3} days in ${e}`,
      afterMin: (n3) => `Date must be on or after ${n3.toISOString().slice(0, 10)}`,
      beforeMax: (n3) => `Date must be on or before ${n3.toISOString().slice(0, 10)}`
    }
  }
};
function isActionKey(n3, e) {
  if (typeof n3 == "string")
    return settings.aliases.get(n3) === e;
  for (const s of n3)
    if (s !== void 0 && isActionKey(s, e))
      return true;
  return false;
}
function diffLines(i2, s) {
  if (i2 === s) return;
  const e = i2.split(`
`), t2 = s.split(`
`), r2 = Math.max(e.length, t2.length), f = [];
  for (let n3 = 0; n3 < r2; n3++)
    e[n3] !== t2[n3] && f.push(n3);
  return {
    lines: f,
    numLinesBefore: e.length,
    numLinesAfter: t2.length,
    numLines: r2
  };
}
var R = globalThis.process.platform.startsWith("win");
var CANCEL_SYMBOL = /* @__PURE__ */ Symbol("clack:cancel");
function isCancel(e) {
  return e === CANCEL_SYMBOL;
}
function setRawMode(e, r2) {
  const o = e;
  o.isTTY && o.setRawMode(r2);
}
function block({
  input: e = stdin,
  output: r2 = stdout,
  overwrite: o = true,
  hideCursor: t2 = true
} = {}) {
  const s = l.createInterface({
    input: e,
    output: r2,
    prompt: "",
    tabSize: 1
  });
  l.emitKeypressEvents(e, s), e instanceof ReadStream && e.isTTY && e.setRawMode(true);
  const n3 = (f, { name: a2, sequence: p }) => {
    const c2 = String(f);
    if (isActionKey([c2, a2, p], "cancel")) {
      t2 && r2.write(import_sisteransi.cursor.show), process.exit(0);
      return;
    }
    if (!o) return;
    const i2 = a2 === "return" ? 0 : -1, m = a2 === "return" ? -1 : 0;
    l.moveCursor(r2, i2, m, () => {
      l.clearLine(r2, 1, () => {
        e.once("keypress", n3);
      });
    });
  };
  return t2 && r2.write(import_sisteransi.cursor.hide), e.once("keypress", n3), () => {
    e.off("keypress", n3), t2 && r2.write(import_sisteransi.cursor.show), e instanceof ReadStream && e.isTTY && !R && e.setRawMode(false), s.terminal = false, s.close();
  };
}
var getColumns = (e) => "columns" in e && typeof e.columns == "number" ? e.columns : 80;
var getRows = (e) => "rows" in e && typeof e.rows == "number" ? e.rows : 20;
function wrapTextWithPrefix(e, r2, o, t2 = o, s = o, n3) {
  const f = getColumns(e ?? stdout);
  return wrapAnsi(r2, f - o.length, {
    hard: true,
    trim: false
  }).split(`
`).map((c2, i2, m) => {
    const d = n3 ? n3(c2, i2) : c2;
    return i2 === 0 ? `${t2}${d}` : i2 === m.length - 1 ? `${s}${d}` : `${o}${d}`;
  }).join(`
`);
}
function runValidation(e, n3) {
  if ("~standard" in e) {
    const a2 = e["~standard"].validate(n3);
    if (a2 instanceof Promise)
      throw new TypeError(
        "Schema validation must be synchronous. Update `validate()` and remove any asynchronous logic."
      );
    return a2.issues?.at(0)?.message;
  }
  return e(n3);
}
var V = class {
  input;
  output;
  _abortSignal;
  rl;
  opts;
  _render;
  _track = false;
  _prevFrame = "";
  _subscribers = /* @__PURE__ */ new Map();
  _cursor = 0;
  state = "initial";
  error = "";
  value;
  userInput = "";
  constructor(t2, e = true) {
    const { input: i2 = stdin, output: n3 = stdout, render: s, signal: r2, ...o } = t2;
    this.opts = o, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = s.bind(this), this._track = e, this._abortSignal = r2, this.input = i2, this.output = n3;
  }
  /**
   * Unsubscribe all listeners
   */
  unsubscribe() {
    this._subscribers.clear();
  }
  /**
   * Set a subscriber with opts
   * @param event - The event name
   */
  setSubscriber(t2, e) {
    const i2 = this._subscribers.get(t2) ?? [];
    i2.push(e), this._subscribers.set(t2, i2);
  }
  /**
   * Subscribe to an event
   * @param event - The event name
   * @param cb - The callback
   */
  on(t2, e) {
    this.setSubscriber(t2, { cb: e });
  }
  /**
   * Subscribe to an event once
   * @param event - The event name
   * @param cb - The callback
   */
  once(t2, e) {
    this.setSubscriber(t2, { cb: e, once: true });
  }
  /**
   * Emit an event with data
   * @param event - The event name
   * @param data - The data to pass to the callback
   */
  emit(t2, ...e) {
    const i2 = this._subscribers.get(t2) ?? [], n3 = [];
    for (const s of i2)
      s.cb(...e), s.once && n3.push(() => i2.splice(i2.indexOf(s), 1));
    for (const s of n3)
      s();
  }
  prompt() {
    return new Promise((t2) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted)
          return this.state = "cancel", this.close(), t2(CANCEL_SYMBOL);
        this._abortSignal.addEventListener(
          "abort",
          () => {
            this.state = "cancel", this.close();
          },
          { once: true }
        );
      }
      this.rl = l__default.createInterface({
        input: this.input,
        tabSize: 2,
        prompt: "",
        escapeCodeTimeout: 50,
        terminal: true
      }), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), setRawMode(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(CANCEL_SYMBOL);
      });
    });
  }
  _isActionKey(t2, e) {
    return t2 === "	";
  }
  _shouldSubmit(t2, e) {
    return true;
  }
  _setValue(t2) {
    this.value = t2, this.emit("value", this.value);
  }
  _setUserInput(t2, e) {
    this.userInput = t2 ?? "", this.emit("userInput", this.userInput), e && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
  }
  _clearUserInput() {
    this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
  }
  onKeypress(t2, e) {
    if (this._track && e.name !== "return" && (e.name && this._isActionKey(t2, e) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), e?.name && (!this._track && settings.aliases.has(e.name) && this.emit("cursor", settings.aliases.get(e.name)), settings.actions.has(e.name) && this.emit("cursor", e.name)), t2 && (t2.toLowerCase() === "y" || t2.toLowerCase() === "n") && this.emit("confirm", t2.toLowerCase() === "y"), this.emit("key", t2, e), e?.name === "return" && this._shouldSubmit(t2, e)) {
      if (this.opts.validate) {
        const i2 = runValidation(this.opts.validate, this.value);
        i2 && (this.error = i2 instanceof Error ? i2.message : i2, this.state = "error", this.rl?.write(this.userInput));
      }
      this.state !== "error" && (this.state = "submit");
    }
    isActionKey([t2, e?.name, e?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), setRawMode(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const t2 = wrapAnsi(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, t2 * -1));
  }
  render() {
    const t2 = wrapAnsi(this._render(this) ?? "", process.stdout.columns, {
      hard: true,
      trim: false
    });
    if (t2 !== this._prevFrame) {
      if (this.state === "initial")
        this.output.write(import_sisteransi.cursor.hide);
      else {
        const e = diffLines(this._prevFrame, t2), i2 = getRows(this.output);
        if (this.restoreCursor(), e) {
          const n3 = Math.max(0, e.numLinesAfter - i2), s = Math.max(0, e.numLinesBefore - i2);
          let r2 = e.lines.find((o) => o >= n3);
          if (r2 === void 0) {
            this._prevFrame = t2;
            return;
          }
          if (e.lines.length === 1) {
            this.output.write(import_sisteransi.cursor.move(0, r2 - s)), this.output.write(import_sisteransi.erase.lines(1));
            const o = t2.split(`
`);
            this.output.write(o[r2]), this._prevFrame = t2, this.output.write(import_sisteransi.cursor.move(0, o.length - r2 - 1));
            return;
          } else if (e.lines.length > 1) {
            if (n3 < s)
              r2 = n3;
            else {
              const h2 = r2 - s;
              h2 > 0 && this.output.write(import_sisteransi.cursor.move(0, h2));
            }
            this.output.write(import_sisteransi.erase.down());
            const f = t2.split(`
`).slice(r2);
            this.output.write(f.join(`
`)), this._prevFrame = t2;
            return;
          }
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(t2), this.state === "initial" && (this.state = "active"), this._prevFrame = t2;
    }
  }
};
var r = class extends V {
  get cursor() {
    return this.value ? 0 : 1;
  }
  get _value() {
    return this.cursor === 0;
  }
  constructor(t2) {
    super(t2, false), this.value = !!t2.initialValue, this.on("userInput", () => {
      this.value = this._value;
    }), this.on("confirm", (i2) => {
      this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = i2, this.state = "submit", this.close();
    }), this.on("cursor", () => {
      this.value = !this.value;
    });
  }
};
var n$1 = class n extends V {
  options;
  cursor = 0;
  get _selectedValue() {
    return this.options[this.cursor];
  }
  changeValue() {
    const e = this._selectedValue;
    this.value = e === void 0 ? void 0 : e.value;
  }
  constructor(e) {
    super(e, false), this.options = e.options;
    const o = this.options.findIndex(({ value: s }) => s === e.initialValue), t2 = o === -1 ? 0 : o;
    this.cursor = this.options[t2]?.disabled ? findCursor(t2, 1, this.options) : t2, this.changeValue(), this.on("cursor", (s) => {
      switch (s) {
        case "left":
        case "up":
          this.cursor = findCursor(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = findCursor(this.cursor, 1, this.options);
          break;
      }
      this.changeValue();
    });
  }
};

// node_modules/@clack/prompts/dist/index.mjs
import { styleText, stripVTControlCharacters } from "node:util";
import process$1 from "node:process";
var import_sisteransi2 = __toESM(require_src(), 1);
function isUnicodeSupported() {
  if (process$1.platform !== "win32") {
    return process$1.env.TERM !== "linux";
  }
  return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) || Boolean(process$1.env.TERMINUS_SUBLIME) || process$1.env.ConEmuTask === "{cmd::Cmder}" || process$1.env.TERM_PROGRAM === "Terminus-Sublime" || process$1.env.TERM_PROGRAM === "vscode" || process$1.env.TERM === "xterm-256color" || process$1.env.TERM === "alacritty" || process$1.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var unicode = isUnicodeSupported();
var isCI = () => process.env.CI === "true";
var unicodeOr = (o, e) => unicode ? o : e;
var S_STEP_ACTIVE = unicodeOr("\u25C6", "*");
var S_STEP_CANCEL = unicodeOr("\u25A0", "x");
var S_STEP_ERROR = unicodeOr("\u25B2", "x");
var S_STEP_SUBMIT = unicodeOr("\u25C7", "o");
var S_BAR_START = unicodeOr("\u250C", "T");
var S_BAR = unicodeOr("\u2502", "|");
var S_BAR_END = unicodeOr("\u2514", "\u2014");
var S_BAR_START_RIGHT = unicodeOr("\u2510", "T");
var S_BAR_END_RIGHT = unicodeOr("\u2518", "\u2014");
var S_RADIO_ACTIVE = unicodeOr("\u25CF", ">");
var S_RADIO_INACTIVE = unicodeOr("\u25CB", " ");
var S_CHECKBOX_ACTIVE = unicodeOr("\u25FB", "[\u2022]");
var S_CHECKBOX_SELECTED = unicodeOr("\u25FC", "[+]");
var S_CHECKBOX_INACTIVE = unicodeOr("\u25FB", "[ ]");
var S_PASSWORD_MASK = unicodeOr("\u25AA", "\u2022");
var S_BAR_H = unicodeOr("\u2500", "-");
var S_CORNER_TOP_RIGHT = unicodeOr("\u256E", "+");
var S_CONNECT_LEFT = unicodeOr("\u251C", "+");
var S_CORNER_BOTTOM_RIGHT = unicodeOr("\u256F", "+");
var S_CORNER_BOTTOM_LEFT = unicodeOr("\u2570", "+");
var S_CORNER_TOP_LEFT = unicodeOr("\u256D", "+");
var S_INFO = unicodeOr("\u25CF", "\u2022");
var S_SUCCESS = unicodeOr("\u25C6", "*");
var S_WARN = unicodeOr("\u25B2", "!");
var S_ERROR = unicodeOr("\u25A0", "x");
var symbol = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText("cyan", S_STEP_ACTIVE);
    case "cancel":
      return styleText("red", S_STEP_CANCEL);
    case "error":
      return styleText("yellow", S_STEP_ERROR);
    case "submit":
      return styleText("green", S_STEP_SUBMIT);
  }
};
var symbolBar = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText("cyan", S_BAR);
    case "cancel":
      return styleText("red", S_BAR);
    case "error":
      return styleText("yellow", S_BAR);
    case "submit":
      return styleText("green", S_BAR);
  }
};
function formatInstructionFooter(o, e) {
  const r2 = [`${e ? `${styleText("cyan", S_BAR)}  ` : ""}${o.join(" \u2022 ")}`];
  return e && r2.push(styleText("cyan", S_BAR_END)), r2;
}
var I = (l2, e, w, p, b, C2 = false) => {
  let r2 = e, O = 0;
  if (C2)
    for (let i2 = p - 1; i2 >= w; i2--) {
      const m = l2[i2];
      if (m && (r2 -= m.length), O++, r2 <= b) break;
    }
  else
    for (let i2 = w; i2 < p; i2++) {
      const m = l2[i2];
      if (m && (r2 -= m.length), O++, r2 <= b) break;
    }
  return { lineCount: r2, removals: O };
};
var limitOptions = ({
  cursor: l2,
  options: e,
  style: w,
  output: p = process.stdout,
  maxItems: b = Number.POSITIVE_INFINITY,
  columnPadding: C2 = 0,
  rowPadding: r2 = 4
}) => {
  const i2 = getColumns(p) - C2, m = getRows(p), M = styleText("dim", "..."), v = Math.max(m - r2, 0), a2 = Math.max(Math.min(b, v), 5);
  let f = 0;
  l2 >= a2 - 3 && (f = Math.max(
    Math.min(l2 - a2 + 3, e.length - a2),
    0
  ));
  let d = a2 < e.length && f > 0, c2 = a2 < e.length && f + a2 < e.length;
  const W2 = Math.min(
    f + a2,
    e.length
  ), s = [];
  let g = 0;
  d && g++, c2 && g++;
  const T = f + (d ? 1 : 0), y = W2 - (c2 ? 1 : 0);
  for (let t2 = T; t2 < y; t2++) {
    const n3 = e[t2], o = n3 ? w(n3, t2 === l2) : "", h2 = wrapAnsi(o, i2, {
      hard: true,
      trim: false
    }).split(`
`);
    s.push(h2), g += h2.length;
  }
  if (g > v) {
    let t2 = 0, n3 = 0, o = g;
    const h2 = l2 - T;
    let u3 = v;
    const L = () => I(s, o, 0, h2, u3), E = () => I(
      s,
      o,
      h2 + 1,
      s.length,
      u3,
      true
    );
    d ? ({ lineCount: o, removals: t2 } = L(), o > u3 && (c2 || (u3 -= 1), { lineCount: o, removals: n3 } = E())) : (c2 || (u3 -= 1), { lineCount: o, removals: n3 } = E(), o > u3 && (u3 -= 1, { lineCount: o, removals: t2 } = L())), t2 > 0 && (d = true, s.splice(0, t2)), n3 > 0 && (c2 = true, s.splice(s.length - n3, n3));
  }
  const x = [];
  d && x.push(M);
  for (const t2 of s)
    for (const n3 of t2)
      x.push(n3);
  return c2 && x.push(M), x;
};
var confirm = (i2) => {
  const a2 = i2.active ?? "Yes", s = i2.inactive ?? "No";
  return new r({
    active: a2,
    inactive: s,
    signal: i2.signal,
    input: i2.input,
    output: i2.output,
    initialValue: i2.initialValue ?? true,
    render() {
      const e = i2.withGuide ?? settings.withGuide, u3 = `${symbol(this.state)}  `, l2 = e ? `${styleText("gray", S_BAR)}  ` : "", f = wrapTextWithPrefix(
        i2.output,
        i2.message,
        l2,
        u3
      ), o = `${e ? `${styleText("gray", S_BAR)}
` : ""}${f}
`, c2 = this.value ? a2 : s;
      switch (this.state) {
        case "submit": {
          const r2 = e ? `${styleText("gray", S_BAR)}  ` : "";
          return `${o}${r2}${styleText("dim", c2)}`;
        }
        case "cancel": {
          const r2 = e ? `${styleText("gray", S_BAR)}  ` : "";
          return `${o}${r2}${styleText(["strikethrough", "dim"], c2)}${e ? `
${styleText("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r2 = e ? `${styleText("cyan", S_BAR)}  ` : "", g = e ? styleText("cyan", S_BAR_END) : "";
          return `${o}${r2}${this.value ? `${styleText("green", S_RADIO_ACTIVE)} ${a2}` : `${styleText("dim", S_RADIO_INACTIVE)} ${styleText("dim", a2)}`}${i2.vertical ? e ? `
${styleText("cyan", S_BAR)}  ` : `
` : ` ${styleText("dim", "/")} `}${this.value ? `${styleText("dim", S_RADIO_INACTIVE)} ${styleText("dim", s)}` : `${styleText("green", S_RADIO_ACTIVE)} ${s}`}
${g}
`;
        }
      }
    }
  }).prompt();
};
var MULTISELECT_INSTRUCTIONS = [
  `${styleText("dim", "\u2191/\u2193")} to navigate`,
  `${styleText("dim", "Space:")} select`,
  `${styleText("dim", "Enter:")} confirm`
];
var log = {
  message: (s = [], {
    symbol: e = styleText("gray", S_BAR),
    secondarySymbol: r2 = styleText("gray", S_BAR),
    output: m = process.stdout,
    spacing: l2 = 1,
    withGuide: c2
  } = {}) => {
    const t2 = [], o = c2 ?? settings.withGuide, f = o ? r2 : "", O = o ? `${e}  ` : "", u3 = o ? `${r2}  ` : "";
    for (let i2 = 0; i2 < l2; i2++)
      t2.push(f);
    const g = Array.isArray(s) ? s : s.split(`
`);
    if (g.length > 0) {
      const [i2, ...y] = g;
      i2.length > 0 ? t2.push(`${O}${i2}`) : t2.push(o ? e : "");
      for (const p of y)
        p.length > 0 ? t2.push(`${u3}${p}`) : t2.push(o ? r2 : "");
    }
    m.write(`${t2.join(`
`)}
`);
  },
  info: (s, e) => {
    log.message(s, { ...e, symbol: styleText("blue", S_INFO) });
  },
  success: (s, e) => {
    log.message(s, { ...e, symbol: styleText("green", S_SUCCESS) });
  },
  step: (s, e) => {
    log.message(s, { ...e, symbol: styleText("green", S_STEP_SUBMIT) });
  },
  warn: (s, e) => {
    log.message(s, { ...e, symbol: styleText("yellow", S_WARN) });
  },
  /** alias for `log.warn()`. */
  warning: (s, e) => {
    log.warn(s, e);
  },
  error: (s, e) => {
    log.message(s, { ...e, symbol: styleText("red", S_ERROR) });
  }
};
var cancel = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText("gray", S_BAR_END)}  ` : "";
  i2.write(`${e}${styleText("red", o)}

`);
};
var intro = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText("gray", S_BAR_START)}  ` : "";
  i2.write(`${e}${o}
`);
};
var outro = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText("gray", S_BAR)}
${styleText("gray", S_BAR_END)}  ` : "";
  i2.write(`${e}${o}

`);
};
var W$1 = (o) => o;
var C = (o, e, s) => {
  const a2 = {
    hard: true,
    trim: false
  }, i2 = wrapAnsi(o, e, a2).split(`
`), c2 = i2.reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), u3 = i2.map(s).reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), g = e - (u3 - c2);
  return wrapAnsi(o, g, a2);
};
var note = (o = "", e = "", s) => {
  const a2 = s?.output ?? process$1.stdout, i2 = s?.withGuide ?? settings.withGuide, c2 = s?.format ?? W$1, g = ["", ...C(o, getColumns(a2) - 6, c2).split(`
`).map(c2), ""], n3 = dist_default2(e), t2 = Math.max(
    g.reduce((m, F) => {
      const O = dist_default2(F);
      return O > m ? O : m;
    }, 0),
    n3
  ) + 2, h2 = g.map(
    (m) => `${styleText("gray", S_BAR)}  ${m}${" ".repeat(t2 - dist_default2(m))}${styleText("gray", S_BAR)}`
  ).join(`
`), T = i2 ? `${styleText("gray", S_BAR)}
` : "", l$1 = i2 ? S_CONNECT_LEFT : S_CORNER_BOTTOM_LEFT;
  a2.write(
    `${T}${styleText("green", S_STEP_SUBMIT)}  ${styleText("reset", e)} ${styleText(
      "gray",
      S_BAR_H.repeat(Math.max(t2 - n3 - 1, 1)) + S_CORNER_TOP_RIGHT
    )}
${h2}
${styleText("gray", l$1 + S_BAR_H.repeat(t2 + 2) + S_CORNER_BOTTOM_RIGHT)}
`
  );
};
var W = (l2) => styleText("magenta", l2);
var spinner = ({
  indicator: l2 = "dots",
  onCancel: h2,
  output: n3 = process.stdout,
  cancelMessage: G,
  errorMessage: O,
  frames: E = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"],
  delay: F = unicode ? 80 : 120,
  signal: m,
  ...I2
} = {}) => {
  const u3 = isCI();
  let M, T, d = false, S = false, s = "", p, w = performance.now();
  const x = getColumns(n3), k = I2?.styleFrame ?? W, g = (e) => {
    const r2 = e > 1 ? O ?? settings.messages.error : G ?? settings.messages.cancel;
    S = e === 1, d && (a2(r2, e), S && typeof h2 == "function" && h2());
  }, f = () => g(2), i2 = () => g(1), A = () => {
    process.on("uncaughtExceptionMonitor", f), process.on("unhandledRejection", f), process.on("SIGINT", i2), process.on("SIGTERM", i2), process.on("exit", g), m && m.addEventListener("abort", i2);
  }, H = () => {
    process.removeListener("uncaughtExceptionMonitor", f), process.removeListener("unhandledRejection", f), process.removeListener("SIGINT", i2), process.removeListener("SIGTERM", i2), process.removeListener("exit", g), m && m.removeEventListener("abort", i2);
  }, y = () => {
    if (p === void 0) return;
    u3 && n3.write(`
`);
    const r2 = wrapAnsi(p, x, {
      hard: true,
      trim: false
    }).split(`
`);
    r2.length > 1 && n3.write(import_sisteransi2.cursor.up(r2.length - 1)), n3.write(import_sisteransi2.cursor.to(0)), n3.write(import_sisteransi2.erase.down());
  }, C2 = (e) => e.replace(/\.+$/, ""), _ = (e) => {
    const r2 = (performance.now() - e) / 1e3, t2 = Math.floor(r2 / 60), o = Math.floor(r2 % 60);
    return t2 > 0 ? `[${t2}m ${o}s]` : `[${o}s]`;
  }, N = I2.withGuide ?? settings.withGuide, P = (e = "") => {
    d = true, M = block({ output: n3 }), s = C2(e), w = performance.now(), N && n3.write(`${styleText("gray", S_BAR)}
`);
    let r2 = 0, t2 = 0;
    A(), T = setInterval(() => {
      if (u3 && s === p)
        return;
      y(), p = s;
      const o = k(E[r2]);
      let v;
      if (u3)
        v = `${o}  ${s}...`;
      else if (l2 === "timer")
        v = `${o}  ${s} ${_(w)}`;
      else {
        const B = ".".repeat(Math.floor(t2)).slice(0, 3);
        v = `${o}  ${s}${B}`;
      }
      const j = wrapAnsi(v, x, {
        hard: true,
        trim: false
      });
      n3.write(j), r2 = r2 + 1 < E.length ? r2 + 1 : 0, t2 = t2 < 4 ? t2 + 0.125 : 0;
    }, F);
  }, a2 = (e = "", r2 = 0, t2 = false) => {
    if (!d) return;
    d = false, clearInterval(T), y();
    const o = r2 === 0 ? styleText("green", S_STEP_SUBMIT) : r2 === 1 ? styleText("red", S_STEP_CANCEL) : styleText("red", S_STEP_ERROR);
    s = e ?? s, t2 || (l2 === "timer" ? n3.write(`${o}  ${s} ${_(w)}
`) : n3.write(`${o}  ${s}
`)), H(), M();
  };
  return {
    start: P,
    stop: (e = "") => a2(e, 0),
    message: (e = "") => {
      s = C2(e ?? s);
    },
    cancel: (e = "") => a2(e, 1),
    error: (e = "") => a2(e, 2),
    clear: () => a2("", 0, true),
    get isCancelled() {
      return S;
    }
  };
};
var u2 = {
  light: unicodeOr("\u2500", "-"),
  heavy: unicodeOr("\u2501", "="),
  block: unicodeOr("\u2588", "#")
};
var SELECT_INSTRUCTIONS = [
  `${styleText("dim", "\u2191/\u2193")} to navigate`,
  `${styleText("dim", "Enter:")} confirm`
];
var c = (t2, o) => t2.includes(`
`) ? t2.split(`
`).map((d) => o(d)).join(`
`) : o(t2);
var select = (t2) => {
  const o = (n3, m) => {
    if (n3 === void 0)
      return "";
    const s = n3.label ?? String(n3.value);
    switch (m) {
      case "disabled":
        return `${styleText("gray", S_RADIO_INACTIVE)} ${c(s, (i2) => styleText("gray", i2))}${n3.hint ? ` ${styleText("dim", `(${n3.hint ?? "disabled"})`)}` : ""}`;
      case "selected":
        return `${c(s, (i2) => styleText("dim", i2))}`;
      case "active":
        return `${styleText("green", S_RADIO_ACTIVE)} ${s}${n3.hint ? ` ${styleText("dim", `(${n3.hint})`)}` : ""}`;
      case "cancelled":
        return `${c(s, (i2) => styleText(["strikethrough", "dim"], i2))}`;
      default:
        return `${styleText("dim", S_RADIO_INACTIVE)} ${c(s, (i2) => styleText("dim", i2))}`;
    }
  }, d = t2.showInstructions ?? true;
  return new n$1({
    options: t2.options,
    signal: t2.signal,
    input: t2.input,
    output: t2.output,
    initialValue: t2.initialValue,
    render() {
      const n3 = t2.withGuide ?? settings.withGuide, m = `${symbol(this.state)}  `, s = `${symbolBar(this.state)}  `, i2 = wrapTextWithPrefix(
        t2.output,
        t2.message,
        s,
        m
      ), u3 = `${n3 ? `${styleText("gray", S_BAR)}
` : ""}${i2}
`;
      switch (this.state) {
        case "submit": {
          const r2 = n3 ? `${styleText("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
            t2.output,
            o(this.options[this.cursor], "selected"),
            r2
          );
          return `${u3}${a2}`;
        }
        case "cancel": {
          const r2 = n3 ? `${styleText("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
            t2.output,
            o(this.options[this.cursor], "cancelled"),
            r2
          );
          return `${u3}${a2}${n3 ? `
${styleText("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r2 = n3 ? `${styleText("cyan", S_BAR)}  ` : "", a2 = u3.split(`
`).length, p = d ? formatInstructionFooter(SELECT_INSTRUCTIONS, n3) : n3 ? [styleText("cyan", S_BAR_END)] : [], b = p.join(`
`), f = p.length + 1;
          return `${u3}${r2}${limitOptions({
            output: t2.output,
            cursor: this.cursor,
            options: this.options,
            maxItems: t2.maxItems,
            columnPadding: r2.length,
            rowPadding: a2 + f,
            style: (g, x) => o(g, g.disabled ? "disabled" : x ? "active" : "inactive")
          }).join(`
${r2}`)}
${b}
`;
        }
      }
    }
  }).prompt();
};
var i = `${styleText("gray", S_BAR)}  `;
export {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  settings,
  spinner
};
