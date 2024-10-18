module.exports = {
  apps: [
    {
      name: 'update_env_app',
      script: './update-env.js',
      instances: 2,
      exec_mode: 'cluster',
      out_file: 'out-env.log',
      merge_logs: true,
      env_initial: {
        NODE_ENV: 'test',
        PM: 'pm2_initial',
        SH_PM: 'pm2_initial',
      },
      env_updated: {
        NODE_ENV: 'test',
        PM: 'pm2_updated',
        SH_PM: 'pm2_updated',
      },
    },
  ],
};
