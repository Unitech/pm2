module.exports = {
  apps: [
    {
      name: 'forked_app',
      script: './index.js',
      env_initial: {
        PORT: 8001,
        PM: 'pm2_initial',
        SH_PM: 'pm2_initial',
        DE_PM: 'pm2_initial',
        SH_DE_PM: 'pm2_initial',
      },
      env_updated: {
        PORT: 8001,
        PM: 'pm2_updated',
        SH_PM: 'pm2_updated',
        DE_PM: 'pm2_updated',
        SH_DE_PM: 'pm2_updated',
      },
    },
    {
      name: 'clustered_app',
      script: './index.js',
      instances: 2,
      exec_mode: 'cluster',
      env_initial: {
        PORT: 8002,
        PM: 'pm2_initial',
        SH_PM: 'pm2_initial',
        DE_PM: 'pm2_initial',
        SH_DE_PM: 'pm2_initial',
      },
      env_updated: {
        PORT: 8002,
        PM: 'pm2_updated',
        SH_PM: 'pm2_updated',
        DE_PM: 'pm2_updated',
        SH_DE_PM: 'pm2_updated',
      },
    },
  ],
};
