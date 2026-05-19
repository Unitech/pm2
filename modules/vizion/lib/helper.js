function trimNewLine(input) {
  return typeof(input) === 'string' ? input.replace(/\n/g, '') : input;
}

function get(object, path) {
  const pathArray = path.split('.');
  let result = object;
  while (result != null && pathArray.length) {
    const pathItem = pathArray.shift();
    if (pathItem in result) {
      result = result[pathItem];
    } else {
      return undefined;
    }
  }
  return result;
}

function last(array) {
  var length = array == null ? 0 : array.length;
  return length ? array[length - 1] : undefined;
}

module.exports = {
  get: get,
  last: last,
  trimNewLine: trimNewLine,
};
