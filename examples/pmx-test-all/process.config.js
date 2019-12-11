module.exports = {
  pm2 : [{
    script : './elements/error.js'
  }, {
    script : './elements/metric.js'
  }, {
    script : './elements/counter.js'
  }, {
    script : './elements/meter.js'
  }, {
    script : './elements/histogram.js'
  }, {
    script : './elements/event.js'
  }, {
    script : './elements/notify.js'
  }, {
    script : './elements/log.js'
  }, {
    script : './elements/log-cluster.js',
    instances : 2
  }, {
    script : './elements/http.js'
  }, {
    script : './elements/cluster.js',
    instances : 4,
    env : {
      PORT : 9803
    }
  }, {
    script : './elements/trace.js',
    trace : true
  }]
}
