const path = require('path');

const app = {
  script: './service.ts',
  cwd: __dirname,
  interpreter: 'node',
  node_args: ['--import', '@nubjs/loader'],
  wait_ready: true,
  listen_timeout: 5000,
  kill_timeout: 1000,
  env: {
    PORT: 45678,
  },
  merge_logs: true,
  log_file: path.join(__dirname, 'loader.log'),
};

const plainApp = {
  script: './service.js',
  cwd: __dirname,
  interpreter: 'node',
  wait_ready: true,
  listen_timeout: 5000,
  kill_timeout: 1000,
  env: {
    PORT: 45680,
  },
  merge_logs: true,
  log_file: path.join(__dirname, 'plain.log'),
};

module.exports = {
  apps: [
    {
      ...app,
      name: 'nub-loader-fork',
    },
    {
      ...app,
      name: 'nub-loader-cluster',
      env: {
        PORT: 45679,
      },
      instances: 2,
      exec_mode: 'cluster',
    },
    {
      ...plainApp,
      name: 'plain-js-cluster',
      instances: 2,
      exec_mode: 'cluster',
    },
  ],
};
