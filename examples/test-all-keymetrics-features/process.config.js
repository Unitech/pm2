module.exports = {
  "pm2" : [{
    "script" : "pm2_probe.js"
  }, {
    "script" : "event.js"
  }, {
    "script" : "http_app.js",
    "instances" : 4
  }, {
    "script" : "probes.js"
  }, {
    "script" : "http_transaction.js"
  }, {
    "script" : "process-transpose.js"
  }, {
    "script" : "scoped-actions.js"
  }, {
    "script" : "custom_action.js"
  }, {
    "script" : "custom_action_with_params.js"
  }, {
    "script" : "http_transaction.js"
  }, {
    "script" : "throw.js"
  }]
}
