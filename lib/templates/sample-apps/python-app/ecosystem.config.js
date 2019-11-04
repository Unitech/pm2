module.exports = {
  apps : [{
    name: 'API',
    script: 'echo.py',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
