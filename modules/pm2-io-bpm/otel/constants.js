'use strict'

const Constants = {
  MINIMUM_TRACE_DURATION: process.env.NODE_ENV === 'test' ? 0 : 1000,
}

module.exports = { Constants }
