module.exports = {
  apps : [{
    name: 'echo-python-1',
    cmd: 'echo.py',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  },{
    name: 'echo-python-max',
    cmd: 'echo.py',
    instances: 4,
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }]
};
