'use strict'

function wrap (nodule, name, wrapper) {
  const original = nodule[name]
  const wrapped = wrapper(original, name)
  wrapped.__wrapped = true
  wrapped.__original = original
  wrapped.__unwrap = function () { nodule[name] = original }
  nodule[name] = wrapped
  return wrapped
}

function unwrap (nodule, name) {
  if (nodule[name] && nodule[name].__unwrap) {
    nodule[name].__unwrap()
  }
}

module.exports = { wrap, unwrap }
