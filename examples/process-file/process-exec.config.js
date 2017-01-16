module.exports = {
  apps : [{
    name               : 'HTTP-API',
    exec             : 'http.js',
    exec_mode          : 'cluster',
    instances          : 'max',
    max_memory_restart : '260M',

    ignore_watch       : ['node_modules'],
    watch              : true,
    env : {
      NODE_ENV : 'normal'
    },
    env_production : {
      NODE_ENV : 'production'
    }
  }, {
    name               : 'Worker',
    exec             : 'worker.js',
    err_file : 'toto-err.log'
  }, {
    name               : 'Checks',
    script             : 'connection_check.sh'
  }]
}
