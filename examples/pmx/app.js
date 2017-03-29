
const PM2 = require('../..');

var pm2 = new PM2.custom({
  cwd : __dirname + '/elements'
});


pm2.start([{
  script : 'error.js'
}, {
  script : 'metric.js'
}, {
  script : 'counter.js'
}, {
  script : 'meter.js'
}, {
  script : 'histogram.js'
}, {
  script : 'event.js'
}, {
  script : 'notify.js'
}, {
  script : 'log.js'
}, {
  script : 'log-cluster.js',
  instances : 2
}, {
  script : 'http.js'
}, {
  script : 'cluster.js',
  instances : 4,
  env : {
    PORT : 9803
  }
}, {
  script : 'trace.js',
  trace : true
}], (err, procs) => {
  console.log(`${procs.length} test apps started`);
  pm2.disconnect();
});
