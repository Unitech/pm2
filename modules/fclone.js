'use strict';

function fclone(obj, refs) {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj);
  if (Buffer.isBuffer(obj)) return Buffer.from(obj);
  if (ArrayBuffer.isView(obj)) return obj.slice(0);

  if (!refs) refs = [];

  // handle array-like objects (arguments, NodeList, etc.)
  let isArr = Array.isArray(obj);
  if (!isArr) {
    let len = obj.length;
    isArr = typeof len === 'number' && (len === 0 || (len - 1) in obj) && typeof obj.indexOf === 'function';
  }

  if (isArr) {
    refs.push(obj);
    let copy = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      let v = obj[i];
      copy[i] = (v && typeof v === 'object' && refs.indexOf(v) !== -1) ? '[Circular]' : fclone(v, refs);
    }
    refs.pop();
    return copy;
  }

  refs.push(obj);
  let copy = {};

  if (obj instanceof Error) {
    copy.name = obj.name;
    copy.message = obj.message;
    copy.stack = obj.stack;
  }

  let keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    let v = obj[keys[i]];
    copy[keys[i]] = (v && typeof v === 'object' && refs.indexOf(v) !== -1) ? '[Circular]' : fclone(v, refs);
  }

  refs.pop();
  return copy;
}

module.exports = fclone;
