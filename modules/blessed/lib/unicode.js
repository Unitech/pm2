/**
 * unicode.js - east asian width and surrogate pairs
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 * Borrowed from vangie/east-asian-width, komagata/eastasianwidth,
 * and mathiasbynens/String.prototype.codePointAt. Licenses below.
 */

// east-asian-width
//
// Copyright (c) 2015 Vangie Du
// https://github.com/vangie/east-asian-width
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

// eastasianwidth
//
// Copyright (c) 2013, Masaki Komagata
// https://github.com/komagata/eastasianwidth
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// String.prototype.codePointAt
//
// Copyright Mathias Bynens <https://mathiasbynens.be/>
// https://github.com/mathiasbynens/String.prototype.codePointAt
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// String.fromCodePoint
//
// Copyright Mathias Bynens <https://mathiasbynens.be/>
// https://github.com/mathiasbynens/String.fromCodePoint
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var stringFromCharCode = String.fromCharCode;
var floor = Math.floor;

/**
 * Wide, Surrogates, and Combining
 */

exports.charWidth = function(str, i) {
  var point = typeof str !== 'number'
    ? exports.codePointAt(str, i || 0)
    : str;

  // nul
  if (point === 0) return 0;

  // tab
  if (point === 0x09) {
    if (!exports.blessed) {
      exports.blessed = require('../');
    }
    return exports.blessed.screen.global
      ? exports.blessed.screen.global.tabc.length
      : 8;
  }

  // 8-bit control characters (2-width according to unicode??)
  if (point < 32 || (point >= 0x7f && point < 0xa0)) {
    return 0;
  }

  // search table of non-spacing characters
  // is ucs combining or C0/C1 control character
  if (exports.combining[point]) {
    return 0;
  }

  // check for double-wide
  // if (point >= 0x1100
  //     && (point <= 0x115f // Hangul Jamo init. consonants
  //     || point === 0x2329 || point === 0x232a
  //     || (point >= 0x2e80 && point <= 0xa4cf
  //     && point !== 0x303f) // CJK ... Yi
  //     || (point >= 0xac00 && point <= 0xd7a3) // Hangul Syllables
  //     || (point >= 0xf900 && point <= 0xfaff) // CJK Compatibility Ideographs
  //     || (point >= 0xfe10 && point <= 0xfe19) // Vertical forms
  //     || (point >= 0xfe30 && point <= 0xfe6f) // CJK Compatibility Forms
  //     || (point >= 0xff00 && point <= 0xff60) // Fullwidth Forms
  //     || (point >= 0xffe0 && point <= 0xffe6)
  //     || (point >= 0x20000 && point <= 0x2fffd)
  //     || (point >= 0x30000 && point <= 0x3fffd))) {
  //   return 2;
  // }

  // check for double-wide
  if ((0x3000 === point)
      || (0xFF01 <= point && point <= 0xFF60)
      || (0xFFE0 <= point && point <= 0xFFE6)) {
    return 2;
  }

  if ((0x1100 <= point && point <= 0x115F)
      || (0x11A3 <= point && point <= 0x11A7)
      || (0x11FA <= point && point <= 0x11FF)
      || (0x2329 <= point && point <= 0x232A)
      || (0x2E80 <= point && point <= 0x2E99)
      || (0x2E9B <= point && point <= 0x2EF3)
      || (0x2F00 <= point && point <= 0x2FD5)
      || (0x2FF0 <= point && point <= 0x2FFB)
      || (0x3001 <= point && point <= 0x303E)
      || (0x3041 <= point && point <= 0x3096)
      || (0x3099 <= point && point <= 0x30FF)
      || (0x3105 <= point && point <= 0x312D)
      || (0x3131 <= point && point <= 0x318E)
      || (0x3190 <= point && point <= 0x31BA)
      || (0x31C0 <= point && point <= 0x31E3)
      || (0x31F0 <= point && point <= 0x321E)
      || (0x3220 <= point && point <= 0x3247)
      || (0x3250 <= point && point <= 0x32FE)
      || (0x3300 <= point && point <= 0x4DBF)
      || (0x4E00 <= point && point <= 0xA48C)
      || (0xA490 <= point && point <= 0xA4C6)
      || (0xA960 <= point && point <= 0xA97C)
      || (0xAC00 <= point && point <= 0xD7A3)
      || (0xD7B0 <= point && point <= 0xD7C6)
      || (0xD7CB <= point && point <= 0xD7FB)
      || (0xF900 <= point && point <= 0xFAFF)
      || (0xFE10 <= point && point <= 0xFE19)
      || (0xFE30 <= point && point <= 0xFE52)
      || (0xFE54 <= point && point <= 0xFE66)
      || (0xFE68 <= point && point <= 0xFE6B)
      || (0x1B000 <= point && point <= 0x1B001)
      || (0x1F200 <= point && point <= 0x1F202)
      || (0x1F210 <= point && point <= 0x1F23A)
      || (0x1F240 <= point && point <= 0x1F248)
      || (0x1F250 <= point && point <= 0x1F251)
      || (0x20000 <= point && point <= 0x2F73F)
      || (0x2B740 <= point && point <= 0x2FFFD)
      || (0x30000 <= point && point <= 0x3FFFD)) {
    return 2;
  }

  // Emoji rendered on two columns by modern terminals (Unicode >= 9,
  // East_Asian_Width=W). The original table predates them: an emoji
  // counted as 1 cell shifts every following cell of the line by one on
  // the real terminal, and the shifted cells are never redrawn (pm2 #5397).
  if (exports.isWideEmoji(point)) {
    return 2;
  }

  // CJK Ambiguous
  // http://www.unicode.org/reports/tr11/
  // http://www.unicode.org/reports/tr11/#Ambiguous
  if (process.env.NCURSES_CJK_WIDTH) {
    if ((0x00A1 === point)
        || (0x00A4 === point)
        || (0x00A7 <= point && point <= 0x00A8)
        || (0x00AA === point)
        || (0x00AD <= point && point <= 0x00AE)
        || (0x00B0 <= point && point <= 0x00B4)
        || (0x00B6 <= point && point <= 0x00BA)
        || (0x00BC <= point && point <= 0x00BF)
        || (0x00C6 === point)
        || (0x00D0 === point)
        || (0x00D7 <= point && point <= 0x00D8)
        || (0x00DE <= point && point <= 0x00E1)
        || (0x00E6 === point)
        || (0x00E8 <= point && point <= 0x00EA)
        || (0x00EC <= point && point <= 0x00ED)
        || (0x00F0 === point)
        || (0x00F2 <= point && point <= 0x00F3)
        || (0x00F7 <= point && point <= 0x00FA)
        || (0x00FC === point)
        || (0x00FE === point)
        || (0x0101 === point)
        || (0x0111 === point)
        || (0x0113 === point)
        || (0x011B === point)
        || (0x0126 <= point && point <= 0x0127)
        || (0x012B === point)
        || (0x0131 <= point && point <= 0x0133)
        || (0x0138 === point)
        || (0x013F <= point && point <= 0x0142)
        || (0x0144 === point)
        || (0x0148 <= point && point <= 0x014B)
        || (0x014D === point)
        || (0x0152 <= point && point <= 0x0153)
        || (0x0166 <= point && point <= 0x0167)
        || (0x016B === point)
        || (0x01CE === point)
        || (0x01D0 === point)
        || (0x01D2 === point)
        || (0x01D4 === point)
        || (0x01D6 === point)
        || (0x01D8 === point)
        || (0x01DA === point)
        || (0x01DC === point)
        || (0x0251 === point)
        || (0x0261 === point)
        || (0x02C4 === point)
        || (0x02C7 === point)
        || (0x02C9 <= point && point <= 0x02CB)
        || (0x02CD === point)
        || (0x02D0 === point)
        || (0x02D8 <= point && point <= 0x02DB)
        || (0x02DD === point)
        || (0x02DF === point)
        || (0x0300 <= point && point <= 0x036F)
        || (0x0391 <= point && point <= 0x03A1)
        || (0x03A3 <= point && point <= 0x03A9)
        || (0x03B1 <= point && point <= 0x03C1)
        || (0x03C3 <= point && point <= 0x03C9)
        || (0x0401 === point)
        || (0x0410 <= point && point <= 0x044F)
        || (0x0451 === point)
        || (0x2010 === point)
        || (0x2013 <= point && point <= 0x2016)
        || (0x2018 <= point && point <= 0x2019)
        || (0x201C <= point && point <= 0x201D)
        || (0x2020 <= point && point <= 0x2022)
        || (0x2024 <= point && point <= 0x2027)
        || (0x2030 === point)
        || (0x2032 <= point && point <= 0x2033)
        || (0x2035 === point)
        || (0x203B === point)
        || (0x203E === point)
        || (0x2074 === point)
        || (0x207F === point)
        || (0x2081 <= point && point <= 0x2084)
        || (0x20AC === point)
        || (0x2103 === point)
        || (0x2105 === point)
        || (0x2109 === point)
        || (0x2113 === point)
        || (0x2116 === point)
        || (0x2121 <= point && point <= 0x2122)
        || (0x2126 === point)
        || (0x212B === point)
        || (0x2153 <= point && point <= 0x2154)
        || (0x215B <= point && point <= 0x215E)
        || (0x2160 <= point && point <= 0x216B)
        || (0x2170 <= point && point <= 0x2179)
        || (0x2189 === point)
        || (0x2190 <= point && point <= 0x2199)
        || (0x21B8 <= point && point <= 0x21B9)
        || (0x21D2 === point)
        || (0x21D4 === point)
        || (0x21E7 === point)
        || (0x2200 === point)
        || (0x2202 <= point && point <= 0x2203)
        || (0x2207 <= point && point <= 0x2208)
        || (0x220B === point)
        || (0x220F === point)
        || (0x2211 === point)
        || (0x2215 === point)
        || (0x221A === point)
        || (0x221D <= point && point <= 0x2220)
        || (0x2223 === point)
        || (0x2225 === point)
        || (0x2227 <= point && point <= 0x222C)
        || (0x222E === point)
        || (0x2234 <= point && point <= 0x2237)
        || (0x223C <= point && point <= 0x223D)
        || (0x2248 === point)
        || (0x224C === point)
        || (0x2252 === point)
        || (0x2260 <= point && point <= 0x2261)
        || (0x2264 <= point && point <= 0x2267)
        || (0x226A <= point && point <= 0x226B)
        || (0x226E <= point && point <= 0x226F)
        || (0x2282 <= point && point <= 0x2283)
        || (0x2286 <= point && point <= 0x2287)
        || (0x2295 === point)
        || (0x2299 === point)
        || (0x22A5 === point)
        || (0x22BF === point)
        || (0x2312 === point)
        || (0x2460 <= point && point <= 0x24E9)
        || (0x24EB <= point && point <= 0x254B)
        || (0x2550 <= point && point <= 0x2573)
        || (0x2580 <= point && point <= 0x258F)
        || (0x2592 <= point && point <= 0x2595)
        || (0x25A0 <= point && point <= 0x25A1)
        || (0x25A3 <= point && point <= 0x25A9)
        || (0x25B2 <= point && point <= 0x25B3)
        || (0x25B6 <= point && point <= 0x25B7)
        || (0x25BC <= point && point <= 0x25BD)
        || (0x25C0 <= point && point <= 0x25C1)
        || (0x25C6 <= point && point <= 0x25C8)
        || (0x25CB === point)
        || (0x25CE <= point && point <= 0x25D1)
        || (0x25E2 <= point && point <= 0x25E5)
        || (0x25EF === point)
        || (0x2605 <= point && point <= 0x2606)
        || (0x2609 === point)
        || (0x260E <= point && point <= 0x260F)
        || (0x2614 <= point && point <= 0x2615)
        || (0x261C === point)
        || (0x261E === point)
        || (0x2640 === point)
        || (0x2642 === point)
        || (0x2660 <= point && point <= 0x2661)
        || (0x2663 <= point && point <= 0x2665)
        || (0x2667 <= point && point <= 0x266A)
        || (0x266C <= point && point <= 0x266D)
        || (0x266F === point)
        || (0x269E <= point && point <= 0x269F)
        || (0x26BE <= point && point <= 0x26BF)
        || (0x26C4 <= point && point <= 0x26CD)
        || (0x26CF <= point && point <= 0x26E1)
        || (0x26E3 === point)
        || (0x26E8 <= point && point <= 0x26FF)
        || (0x273D === point)
        || (0x2757 === point)
        || (0x2776 <= point && point <= 0x277F)
        || (0x2B55 <= point && point <= 0x2B59)
        || (0x3248 <= point && point <= 0x324F)
        || (0xE000 <= point && point <= 0xF8FF)
        || (0xFE00 <= point && point <= 0xFE0F)
        || (0xFFFD === point)
        || (0x1F100 <= point && point <= 0x1F10A)
        || (0x1F110 <= point && point <= 0x1F12D)
        || (0x1F130 <= point && point <= 0x1F169)
        || (0x1F170 <= point && point <= 0x1F19A)
        || (0xE0100 <= point && point <= 0xE01EF)
        || (0xF0000 <= point && point <= 0xFFFFD)
        || (0x100000 <= point && point <= 0x10FFFD)) {
      return +process.env.NCURSES_CJK_WIDTH || 1;
    }
  }

  return 1;
};

// Emoji code points with a default emoji (wide) presentation, plus the
// BMP symbols terminals render wide (✅ ❌ ⚡ ⭐ …). Ranges follow
// emoji-data.txt Extended_Pictographic ∩ East_Asian_Width=W. Regional
// indicators (flags) are left at 1 so a pair takes 2 cells, like wcwidth.
// Known limits: ZWJ sequences (👨‍👩‍👧) and U+FE0F presentation selectors
// (❤️) are still measured per code point.
exports.wideEmojiTable = [
  [0x231A, 0x231B],   [0x23E9, 0x23EC],   [0x23F0, 0x23F0],
  [0x23F3, 0x23F3],   [0x25FD, 0x25FE],   [0x2614, 0x2615],
  [0x2648, 0x2653],   [0x267F, 0x267F],   [0x2693, 0x2693],
  [0x26A1, 0x26A1],   [0x26AA, 0x26AB],   [0x26BD, 0x26BE],
  [0x26C4, 0x26C5],   [0x26CE, 0x26CE],   [0x26D4, 0x26D4],
  [0x26EA, 0x26EA],   [0x26F2, 0x26F3],   [0x26F5, 0x26F5],
  [0x26FA, 0x26FA],   [0x26FD, 0x26FD],   [0x2705, 0x2705],
  [0x270A, 0x270B],   [0x2728, 0x2728],   [0x274C, 0x274C],
  [0x274E, 0x274E],   [0x2753, 0x2755],   [0x2757, 0x2757],
  [0x2795, 0x2797],   [0x27B0, 0x27B0],   [0x27BF, 0x27BF],
  [0x2B1B, 0x2B1C],   [0x2B50, 0x2B50],   [0x2B55, 0x2B55],
  [0x1F004, 0x1F004], [0x1F0CF, 0x1F0CF], [0x1F18E, 0x1F18E],
  [0x1F191, 0x1F19A], [0x1F201, 0x1F201],
  [0x1F21A, 0x1F21A], [0x1F22F, 0x1F22F], [0x1F232, 0x1F236],
  [0x1F238, 0x1F23A], [0x1F250, 0x1F251], [0x1F300, 0x1F320],
  [0x1F32D, 0x1F335], [0x1F337, 0x1F37C], [0x1F37E, 0x1F393],
  [0x1F3A0, 0x1F3CA], [0x1F3CF, 0x1F3D3], [0x1F3E0, 0x1F3F0],
  [0x1F3F4, 0x1F3F4], [0x1F3F8, 0x1F43E], [0x1F440, 0x1F440],
  [0x1F442, 0x1F4FC], [0x1F4FF, 0x1F53D], [0x1F54B, 0x1F54E],
  [0x1F550, 0x1F567], [0x1F57A, 0x1F57A], [0x1F595, 0x1F596],
  [0x1F5A4, 0x1F5A4], [0x1F5FB, 0x1F64F], [0x1F680, 0x1F6C5],
  [0x1F6CC, 0x1F6CC], [0x1F6D0, 0x1F6D2], [0x1F6D5, 0x1F6D7],
  [0x1F6DC, 0x1F6DF], [0x1F6EB, 0x1F6EC], [0x1F6F4, 0x1F6FC],
  [0x1F7E0, 0x1F7EB], [0x1F7F0, 0x1F7F0], [0x1F90C, 0x1F93A],
  [0x1F93C, 0x1F945], [0x1F947, 0x1F9FF], [0x1FA70, 0x1FA7C],
  [0x1FA80, 0x1FA89], [0x1FA8F, 0x1FAC6], [0x1FACE, 0x1FADC],
  [0x1FADF, 0x1FAE9], [0x1FAF0, 0x1FAF8]
];

exports.isWideEmoji = function(point) {
  var table = exports.wideEmojiTable;
  var lo = 0, hi = table.length - 1;
  if (point < table[0][0] || point > table[hi][1]) return false;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    if (point < table[mid][0]) hi = mid - 1;
    else if (point > table[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
};

exports.strWidth = function(str) {
  var width = 0;
  for (var i = 0; i < str.length; i++) {
    width += exports.charWidth(str, i);
    if (exports.isSurrogate(str, i)) i++;
  }
  return width;
};

exports.isSurrogate = function(str, i) {
  var point = typeof str !== 'number'
    ? exports.codePointAt(str, i || 0)
    : str;
  return point > 0x00ffff;
};

exports.combiningTable = [
  [0x0300, 0x036F],   [0x0483, 0x0486],   [0x0488, 0x0489],
  [0x0591, 0x05BD],   [0x05BF, 0x05BF],   [0x05C1, 0x05C2],
  [0x05C4, 0x05C5],   [0x05C7, 0x05C7],   [0x0600, 0x0603],
  [0x0610, 0x0615],   [0x064B, 0x065E],   [0x0670, 0x0670],
  [0x06D6, 0x06E4],   [0x06E7, 0x06E8],   [0x06EA, 0x06ED],
  [0x070F, 0x070F],   [0x0711, 0x0711],   [0x0730, 0x074A],
  [0x07A6, 0x07B0],   [0x07EB, 0x07F3],   [0x0901, 0x0902],
  [0x093C, 0x093C],   [0x0941, 0x0948],   [0x094D, 0x094D],
  [0x0951, 0x0954],   [0x0962, 0x0963],   [0x0981, 0x0981],
  [0x09BC, 0x09BC],   [0x09C1, 0x09C4],   [0x09CD, 0x09CD],
  [0x09E2, 0x09E3],   [0x0A01, 0x0A02],   [0x0A3C, 0x0A3C],
  [0x0A41, 0x0A42],   [0x0A47, 0x0A48],   [0x0A4B, 0x0A4D],
  [0x0A70, 0x0A71],   [0x0A81, 0x0A82],   [0x0ABC, 0x0ABC],
  [0x0AC1, 0x0AC5],   [0x0AC7, 0x0AC8],   [0x0ACD, 0x0ACD],
  [0x0AE2, 0x0AE3],   [0x0B01, 0x0B01],   [0x0B3C, 0x0B3C],
  [0x0B3F, 0x0B3F],   [0x0B41, 0x0B43],   [0x0B4D, 0x0B4D],
  [0x0B56, 0x0B56],   [0x0B82, 0x0B82],   [0x0BC0, 0x0BC0],
  [0x0BCD, 0x0BCD],   [0x0C3E, 0x0C40],   [0x0C46, 0x0C48],
  [0x0C4A, 0x0C4D],   [0x0C55, 0x0C56],   [0x0CBC, 0x0CBC],
  [0x0CBF, 0x0CBF],   [0x0CC6, 0x0CC6],   [0x0CCC, 0x0CCD],
  [0x0CE2, 0x0CE3],   [0x0D41, 0x0D43],   [0x0D4D, 0x0D4D],
  [0x0DCA, 0x0DCA],   [0x0DD2, 0x0DD4],   [0x0DD6, 0x0DD6],
  [0x0E31, 0x0E31],   [0x0E34, 0x0E3A],   [0x0E47, 0x0E4E],
  [0x0EB1, 0x0EB1],   [0x0EB4, 0x0EB9],   [0x0EBB, 0x0EBC],
  [0x0EC8, 0x0ECD],   [0x0F18, 0x0F19],   [0x0F35, 0x0F35],
  [0x0F37, 0x0F37],   [0x0F39, 0x0F39],   [0x0F71, 0x0F7E],
  [0x0F80, 0x0F84],   [0x0F86, 0x0F87],   [0x0F90, 0x0F97],
  [0x0F99, 0x0FBC],   [0x0FC6, 0x0FC6],   [0x102D, 0x1030],
  [0x1032, 0x1032],   [0x1036, 0x1037],   [0x1039, 0x1039],
  [0x1058, 0x1059],   [0x1160, 0x11FF],   [0x135F, 0x135F],
  [0x1712, 0x1714],   [0x1732, 0x1734],   [0x1752, 0x1753],
  [0x1772, 0x1773],   [0x17B4, 0x17B5],   [0x17B7, 0x17BD],
  [0x17C6, 0x17C6],   [0x17C9, 0x17D3],   [0x17DD, 0x17DD],
  [0x180B, 0x180D],   [0x18A9, 0x18A9],   [0x1920, 0x1922],
  [0x1927, 0x1928],   [0x1932, 0x1932],   [0x1939, 0x193B],
  [0x1A17, 0x1A18],   [0x1B00, 0x1B03],   [0x1B34, 0x1B34],
  [0x1B36, 0x1B3A],   [0x1B3C, 0x1B3C],   [0x1B42, 0x1B42],
  [0x1B6B, 0x1B73],   [0x1DC0, 0x1DCA],   [0x1DFE, 0x1DFF],
  [0x200B, 0x200F],   [0x202A, 0x202E],   [0x2060, 0x2063],
  [0x206A, 0x206F],   [0x20D0, 0x20EF],   [0x302A, 0x302F],
  [0x3099, 0x309A],   [0xA806, 0xA806],   [0xA80B, 0xA80B],
  [0xA825, 0xA826],   [0xFB1E, 0xFB1E],   [0xFE00, 0xFE0F],
  [0xFE20, 0xFE23],   [0xFEFF, 0xFEFF],   [0xFFF9, 0xFFFB],
  [0x10A01, 0x10A03], [0x10A05, 0x10A06], [0x10A0C, 0x10A0F],
  [0x10A38, 0x10A3A], [0x10A3F, 0x10A3F], [0x1D167, 0x1D169],
  [0x1D173, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD],
  [0x1D242, 0x1D244], [0xE0001, 0xE0001], [0xE0020, 0xE007F],
  [0xE0100, 0xE01EF]
];

exports.combining = exports.combiningTable.reduce(function(out, row) {
  for (var i = row[0]; i <= row[1]; i++) {
    out[i] = true;
  }
  return out;
}, {});

exports.isCombining = function(str, i) {
  var point = typeof str !== 'number'
    ? exports.codePointAt(str, i || 0)
    : str;
  return exports.combining[point] === true;
};

/**
 * Code Point Helpers
 */

exports.codePointAt = function(str, position) {
  if (str == null) {
    throw TypeError();
  }
  var string = String(str);
  if (string.codePointAt) {
    return string.codePointAt(position);
  }
  var size = string.length;
  // `ToInteger`
  var index = position ? Number(position) : 0;
  if (index !== index) { // better `isNaN`
    index = 0;
  }
  // Account for out-of-bounds indices:
  if (index < 0 || index >= size) {
    return undefined;
  }
  // Get the first code unit
  var first = string.charCodeAt(index);
  var second;
  if ( // check if it’s the start of a surrogate pair
    first >= 0xD800 && first <= 0xDBFF && // high surrogate
    size > index + 1 // there is a next code unit
  ) {
    second = string.charCodeAt(index + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
};

// exports.codePointAt = function(str, position) {
//   position = +position || 0;
//   var x = str.charCodeAt(position);
//   var y = str.length > 1 ? str.charCodeAt(position + 1) : 0;
//   var point = x;
//   if ((0xD800 <= x && x <= 0xDBFF) && (0xDC00 <= y && y <= 0xDFFF)) {
//     x &= 0x3FF;
//     y &= 0x3FF;
//     point = (x << 10) | y;
//     point += 0x10000;
//   }
//   return point;
// };

exports.fromCodePoint = function() {
  if (String.fromCodePoint) {
    return String.fromCodePoint.apply(String, arguments);
  }
  var MAX_SIZE = 0x4000;
  var codeUnits = [];
  var highSurrogate;
  var lowSurrogate;
  var index = -1;
  var length = arguments.length;
  if (!length) {
    return '';
  }
  var result = '';
  while (++index < length) {
    var codePoint = Number(arguments[index]);
    if (
      !isFinite(codePoint) ||       // `NaN`, `+Infinity`, or `-Infinity`
      codePoint < 0 ||              // not a valid Unicode code point
      codePoint > 0x10FFFF ||       // not a valid Unicode code point
      floor(codePoint) !== codePoint // not an integer
    ) {
      throw RangeError('Invalid code point: ' + codePoint);
    }
    if (codePoint <= 0xFFFF) { // BMP code point
      codeUnits.push(codePoint);
    } else { // Astral code point; split in surrogate halves
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      codePoint -= 0x10000;
      highSurrogate = (codePoint >> 10) + 0xD800;
      lowSurrogate = (codePoint % 0x400) + 0xDC00;
      codeUnits.push(highSurrogate, lowSurrogate);
    }
    if (index + 1 === length || codeUnits.length > MAX_SIZE) {
      result += stringFromCharCode.apply(null, codeUnits);
      codeUnits.length = 0;
    }
  }
  return result;
};

/**
 * Regexes
 */

exports.chars = {};

// Double width characters that are _not_ surrogate pairs.
// NOTE: 0x20000 - 0x2fffd and 0x30000 - 0x3fffd are not necessary for this
// regex anyway. This regex is used to put a blank char after wide chars to
// be eaten, however, if this is a surrogate pair, parseContent already adds
// the extra one char because its length equals 2 instead of 1.
exports.chars.wide = new RegExp('(['
  + '\\u1100-\\u115f' // Hangul Jamo init. consonants
  + '\\u2329\\u232a'
  + '\\u2e80-\\u303e\\u3040-\\ua4cf' // CJK ... Yi
  + '\\uac00-\\ud7a3' // Hangul Syllables
  + '\\uf900-\\ufaff' // CJK Compatibility Ideographs
  + '\\ufe10-\\ufe19' // Vertical forms
  + '\\ufe30-\\ufe6f' // CJK Compatibility Forms
  + '\\uff00-\\uff60' // Fullwidth Forms
  + '\\uffe0-\\uffe6'
  + '])', 'g');

// Regex sources for the wide emoji table (see charWidth): a BMP character
// class and surrogate pair alternatives for the astral ranges.
function hex4(n) {
  return '\\u' + ('0000' + n.toString(16)).slice(-4);
}

function emojiSources() {
  var bmp = '';
  var astral = [];
  exports.wideEmojiTable.forEach(function(row) {
    var lo = row[0], hi = row[1];
    if (hi <= 0xFFFF) {
      bmp += lo === hi ? hex4(lo) : hex4(lo) + '-' + hex4(hi);
      return;
    }
    // split the range on high surrogate boundaries
    while (lo <= hi) {
      var high = 0xD800 + ((lo - 0x10000) >> 10);
      var last = Math.min(hi, ((high - 0xD800 + 1) << 10) + 0x10000 - 1);
      var l = 0xDC00 + ((lo - 0x10000) & 0x3FF);
      var h = 0xDC00 + ((last - 0x10000) & 0x3FF);
      astral.push(hex4(high) + (l === h ? hex4(l) : '[' + hex4(l) + '-' + hex4(h) + ']'));
      lo = last + 1;
    }
  });
  return { bmp: bmp, astral: astral.join('|') };
}

var emoji = emojiSources();

exports.chars.wide = new RegExp('(['
  + exports.chars.wide.source.slice(2, -2)
  + emoji.bmp
  + '])', 'g');

// All surrogate pair wide chars.
exports.chars.swide = new RegExp('('
  // 0x20000 - 0x2fffd:
  + '[\\ud840-\\ud87f][\\udc00-\\udffd]'
  + '|'
  // 0x30000 - 0x3fffd:
  + '[\\ud880-\\ud8bf][\\udc00-\\udffd]'
  + '|'
  // emoji
  + emoji.astral
  + ')', 'g');

// All wide chars including surrogate pairs.
exports.chars.all = new RegExp('('
  + exports.chars.swide.source.slice(1, -1)
  + '|'
  + exports.chars.wide.source.slice(1, -1)
  + ')', 'g');

// Regex to detect a surrogate pair.
exports.chars.surrogate = /[\ud800-\udbff][\udc00-\udfff]/g;

// Regex to find combining characters.
exports.chars.combining = exports.combiningTable.reduce(function(out, row) {
  var low, high, range;
  if (row[0] > 0x00ffff) {
    low = exports.fromCodePoint(row[0]);
    low = [
      hexify(low.charCodeAt(0)),
      hexify(low.charCodeAt(1))
    ];
    high = exports.fromCodePoint(row[1]);
    high = [
      hexify(high.charCodeAt(0)),
      hexify(high.charCodeAt(1))
    ];
    range = '[\\u' + low[0] + '-' + '\\u' + high[0] + ']'
          + '[\\u' + low[1] + '-' + '\\u' + high[1] + ']';
    if (!~out.indexOf('|')) out += ']';
    out += '|' + range;
  } else {
    low = hexify(row[0]);
    high = hexify(row[1]);
    low = '\\u' + low;
    high = '\\u' + high;
    out += low + '-' + high;
  }
  return out;
}, '[');

exports.chars.combining = new RegExp(exports.chars.combining, 'g');

function hexify(n) {
  n = n.toString(16);
  while (n.length < 4) n = '0' + n;
  return n;
}

/*
exports.chars.combining = new RegExp(
  '['
  + '\\u0300-\\u036f'
  + '\\u0483-\\u0486'
  + '\\u0488-\\u0489'
  + '\\u0591-\\u05bd'
  + '\\u05bf-\\u05bf'
  + '\\u05c1-\\u05c2'
  + '\\u05c4-\\u05c5'
  + '\\u05c7-\\u05c7'
  + '\\u0600-\\u0603'
  + '\\u0610-\\u0615'
  + '\\u064b-\\u065e'
  + '\\u0670-\\u0670'
  + '\\u06d6-\\u06e4'
  + '\\u06e7-\\u06e8'
  + '\\u06ea-\\u06ed'
  + '\\u070f-\\u070f'
  + '\\u0711-\\u0711'
  + '\\u0730-\\u074a'
  + '\\u07a6-\\u07b0'
  + '\\u07eb-\\u07f3'
  + '\\u0901-\\u0902'
  + '\\u093c-\\u093c'
  + '\\u0941-\\u0948'
  + '\\u094d-\\u094d'
  + '\\u0951-\\u0954'
  + '\\u0962-\\u0963'
  + '\\u0981-\\u0981'
  + '\\u09bc-\\u09bc'
  + '\\u09c1-\\u09c4'
  + '\\u09cd-\\u09cd'
  + '\\u09e2-\\u09e3'
  + '\\u0a01-\\u0a02'
  + '\\u0a3c-\\u0a3c'
  + '\\u0a41-\\u0a42'
  + '\\u0a47-\\u0a48'
  + '\\u0a4b-\\u0a4d'
  + '\\u0a70-\\u0a71'
  + '\\u0a81-\\u0a82'
  + '\\u0abc-\\u0abc'
  + '\\u0ac1-\\u0ac5'
  + '\\u0ac7-\\u0ac8'
  + '\\u0acd-\\u0acd'
  + '\\u0ae2-\\u0ae3'
  + '\\u0b01-\\u0b01'
  + '\\u0b3c-\\u0b3c'
  + '\\u0b3f-\\u0b3f'
  + '\\u0b41-\\u0b43'
  + '\\u0b4d-\\u0b4d'
  + '\\u0b56-\\u0b56'
  + '\\u0b82-\\u0b82'
  + '\\u0bc0-\\u0bc0'
  + '\\u0bcd-\\u0bcd'
  + '\\u0c3e-\\u0c40'
  + '\\u0c46-\\u0c48'
  + '\\u0c4a-\\u0c4d'
  + '\\u0c55-\\u0c56'
  + '\\u0cbc-\\u0cbc'
  + '\\u0cbf-\\u0cbf'
  + '\\u0cc6-\\u0cc6'
  + '\\u0ccc-\\u0ccd'
  + '\\u0ce2-\\u0ce3'
  + '\\u0d41-\\u0d43'
  + '\\u0d4d-\\u0d4d'
  + '\\u0dca-\\u0dca'
  + '\\u0dd2-\\u0dd4'
  + '\\u0dd6-\\u0dd6'
  + '\\u0e31-\\u0e31'
  + '\\u0e34-\\u0e3a'
  + '\\u0e47-\\u0e4e'
  + '\\u0eb1-\\u0eb1'
  + '\\u0eb4-\\u0eb9'
  + '\\u0ebb-\\u0ebc'
  + '\\u0ec8-\\u0ecd'
  + '\\u0f18-\\u0f19'
  + '\\u0f35-\\u0f35'
  + '\\u0f37-\\u0f37'
  + '\\u0f39-\\u0f39'
  + '\\u0f71-\\u0f7e'
  + '\\u0f80-\\u0f84'
  + '\\u0f86-\\u0f87'
  + '\\u0f90-\\u0f97'
  + '\\u0f99-\\u0fbc'
  + '\\u0fc6-\\u0fc6'
  + '\\u102d-\\u1030'
  + '\\u1032-\\u1032'
  + '\\u1036-\\u1037'
  + '\\u1039-\\u1039'
  + '\\u1058-\\u1059'
  + '\\u1160-\\u11ff'
  + '\\u135f-\\u135f'
  + '\\u1712-\\u1714'
  + '\\u1732-\\u1734'
  + '\\u1752-\\u1753'
  + '\\u1772-\\u1773'
  + '\\u17b4-\\u17b5'
  + '\\u17b7-\\u17bd'
  + '\\u17c6-\\u17c6'
  + '\\u17c9-\\u17d3'
  + '\\u17dd-\\u17dd'
  + '\\u180b-\\u180d'
  + '\\u18a9-\\u18a9'
  + '\\u1920-\\u1922'
  + '\\u1927-\\u1928'
  + '\\u1932-\\u1932'
  + '\\u1939-\\u193b'
  + '\\u1a17-\\u1a18'
  + '\\u1b00-\\u1b03'
  + '\\u1b34-\\u1b34'
  + '\\u1b36-\\u1b3a'
  + '\\u1b3c-\\u1b3c'
  + '\\u1b42-\\u1b42'
  + '\\u1b6b-\\u1b73'
  + '\\u1dc0-\\u1dca'
  + '\\u1dfe-\\u1dff'
  + '\\u200b-\\u200f'
  + '\\u202a-\\u202e'
  + '\\u2060-\\u2063'
  + '\\u206a-\\u206f'
  + '\\u20d0-\\u20ef'
  + '\\u302a-\\u302f'
  + '\\u3099-\\u309a'
  + '\\ua806-\\ua806'
  + '\\ua80b-\\ua80b'
  + '\\ua825-\\ua826'
  + '\\ufb1e-\\ufb1e'
  + '\\ufe00-\\ufe0f'
  + '\\ufe20-\\ufe23'
  + '\\ufeff-\\ufeff'
  + '\\ufff9-\\ufffb'
  + ']'
  + '|[\\ud802-\\ud802][\\ude01-\\ude03]'
  + '|[\\ud802-\\ud802][\\ude05-\\ude06]'
  + '|[\\ud802-\\ud802][\\ude0c-\\ude0f]'
  + '|[\\ud802-\\ud802][\\ude38-\\ude3a]'
  + '|[\\ud802-\\ud802][\\ude3f-\\ude3f]'
  + '|[\\ud834-\\ud834][\\udd67-\\udd69]'
  + '|[\\ud834-\\ud834][\\udd73-\\udd82]'
  + '|[\\ud834-\\ud834][\\udd85-\\udd8b]'
  + '|[\\ud834-\\ud834][\\uddaa-\\uddad]'
  + '|[\\ud834-\\ud834][\\ude42-\\ude44]'
  + '|[\\udb40-\\udb40][\\udc01-\\udc01]'
  + '|[\\udb40-\\udb40][\\udc20-\\udc7f]'
  + '|[\\udb40-\\udb40][\\udd00-\\uddef]'
, 'g');
*/
