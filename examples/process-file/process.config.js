module.exports = {
  apps : [{
    name               : 'HTTP-API',
    script             : 'http.js',
    exec_mode          : 'cluster',
    instances          : 'max',
    max_memory_restart : '260M',

    ignore_watch       : ['node_modules'],
    env : {
      NODE_ENV : 'normal'
    },
    env_production : {
      NODE_ENV : 'production'
    }
  }, {
    name               : 'Worker',
    script             : 'worker.js',
    err_file : 'toto-err.log'
  }, {
    name               : 'Checks',
    script             : 'connection_check.sh'
  }]
}
