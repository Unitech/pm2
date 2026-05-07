'use strict'

module.exports = {
  METRIC_INTERVAL: 990
}

module.exports.canUseInspector = function canUseInspector () {
  const isBun = typeof Bun !== 'undefined'
  return !isBun
}
