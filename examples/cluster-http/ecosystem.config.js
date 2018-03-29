module.exports = {
  apps : [{
    name   : 'clustered_http',
    script : './http.js',
    instances : 'max',
    exec_mode : 'cluster',
    env : {
      PORT : 8002
    }
  }, {
    name : 'forked_app',
    script : './http.js',
    env : {
      PORT : 8001
    }
  }]
}
