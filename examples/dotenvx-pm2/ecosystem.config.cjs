module.exports = {
  apps: [
    {
      name: 'forked_app',
      script: './index.js',
      env: {
        PORT: 8001,
        PM: 'pm2',
        SH_PM: 'pm2',
        DE_PM: 'pm2',
        SH_DE_PM: 'pm2',
      },
    },
    {
      name: 'clustered_app',
      script: './index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        PORT: 8002,
        PM: 'pm2',
        SH_PM: 'pm2',
        DE_PM: 'pm2',
        SH_DE_PM: 'pm2',
      },
    },
  ],
};
