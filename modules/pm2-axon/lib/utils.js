
/**
 * Slice helper.
 *
 * @api private
 * @param {Arguments} args
 * @return {Array}
 */

exports.slice = function(args){
  var len = args.length;
  var ret = new Array(len);

  for (var i = 0; i < len; i++) {
    ret[i] = args[i];
  }

  return ret;
};