module.exports = {
  apps : [{
    name: 'Custom Metrics',
    script: 'custom-metrics.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
