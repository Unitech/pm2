'use strict'

/**
 * Convert value to boolean but false if undefined
 * @param {String} value
 * @param {String} fallback default value
 * @return {Boolean}
 */
const useIfDefined = (value, fallback) => {
  if (typeof value === 'undefined') {
    return fallback
  } else {
    return value === 'true'
  }
}

/**
 * Configuration for transporters
 * Configuration by transporter :
 * @param {Integer} enabled
 * @param {Object|String} endpoints sended as first arg with connect() method
 */
module.exports = {
  transporters: {
    websocket: {
      enabled: true, // useIfDefined(process.env.AGENT_TRANSPORT_WEBSOCKET, true),
      endpoints: process.env.AGENT_WEBSOCKET_ENDPOINT || 'ws'
    }
  }
}
