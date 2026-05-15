'use strict'

module.exports = {
  METRIC_INTERVAL: 990,
  // Max number of in-flight (un-acked) IPC sends before back-pressure kicks
  // in and further messages are dropped. Bounds retained callbacks / queued
  // messages so a saturated-but-connected pipe cannot grow memory unbounded.
  IPC_MAX_INFLIGHT: 100
}

module.exports.canUseInspector = function canUseInspector () {
  const isBun = typeof Bun !== 'undefined'
  return !isBun
}
