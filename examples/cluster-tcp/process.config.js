module.exports = {
  apps : [{
    name   : 'clustered_tcp',
    script : './tcp.js',
    instances : 'max',
    exec_mode : 'cluster',
    env : {
      PORT : 8002
    }
  }, {
    name : 'forked_tcp',
    script : './tcp.js',
    env : {
      PORT : 8001
    }
  }]
}
