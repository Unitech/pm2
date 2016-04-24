'use strict';

//method to perform the clone
function safeDeepClone(circularValue, refs, obj) {
  var copy, tmp;

  // object is a false or empty value, or otherwise not an object
  if (!obj || "object" !== typeof obj) return obj;

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array - or array-like items (Buffers)
  if (obj instanceof Array || obj.length) {
    //return Buffer as-is
    if (typeof Buffer === "function" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(obj)) {
      return new Buffer(obj);
    }

    refs.push(obj);
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      if (refs.indexOf(obj[i]) >= 0) {
        copy[i] = circularValue;
      } else {
        copy[i] = safeDeepClone(circularValue, refs, obj[i]);
      }
    }
    refs.pop();
    return copy;
  }

  // Handle Object
  refs.push(obj);
  copy = {};

  if (obj instanceof Error) {
    //raise inherited error properties for the clone
    copy.name = obj.name;
    copy.message = obj.message;
    copy.stack = obj.stack;
  }

  for (var attr in obj) {
    if (refs.indexOf(obj[attr]) >= 0) {
      copy[attr] = circularValue;
    } else {
      copy[attr] = safeDeepClone(circularValue, refs, obj[attr]);
    }
  }
  refs.pop();
  return copy;
}


//method to wrap the cloning method
function cloneWrap(obj, circularValue) {
  circularValue = safeDeepClone(undefined, [], circularValue);
  return safeDeepClone(circularValue, [], obj);
}

//value to use when a circular reference is found
cloneWrap.circularValue = undefined;

module.exports = cloneWrap;
