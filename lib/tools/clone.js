/** by @soyuka inspired by @tracker1 **/
function clone(obj, refs) {
  if (!obj || "object" !== typeof obj) return obj;
  if (obj instanceof Date) {
    var copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }
  if (Buffer !== undefined && Buffer.isBuffer(obj)) {
    return new Buffer(obj);
  }
  if (!refs) { refs = []; }
  if (Array.isArray(obj)) {
    refs.push(obj);
    var l = obj.length
    var copy = []
    for (var i = 0; i < l; i++) {
      copy[i] = ~refs.indexOf(obj[i]) ? '[Circular]' : clone(obj[i], refs);
    }
    refs.pop();
    return copy;
  }
  refs.push(obj);
  var copy = {}
  if (obj instanceof Error) {
    copy.name = obj.name
    copy.message = obj.message
    copy.stack = obj.stack
    refs.pop()
    return copy;
  }
  for(var i in obj) {
    copy[i] = ~refs.indexOf(obj[i]) ? '[Circular]' : clone(obj[i], refs)
  }
  refs.pop()
  return copy;
}
module.exports = clone
