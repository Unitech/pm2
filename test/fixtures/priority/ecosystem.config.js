module.exports = {
  apps : [{
    name   : 'clustered_http',
    script : './http.js',
    instances : 'max',
    exec_mode : 'cluster',
    priority  : 1,
    stop_priority: 1,
    env : {
      PORT : 8002
    }
  }, {
    name : 'forked_app',
    script   : './http.js',
    priority: 2,
    stop_priority: 2,
    env : {
      PORT : 8001
    }
  }, {
    name : 'forked_app2',
    script   : './http.js',
    priority : 2,
    stop_priority: 2,
    env : {
      PORT : 8003
    }
  }, {
    name : 'forked_app_After2',
    script   : './http.js',
    env : {
      PORT : 8004
    }
  }, {
    name : 'forked_app_After1',
    script   : './http.js',
    priority : 2,
    stop_priority: 3,
    env : {
      PORT : 8005
    }
  }]
}
