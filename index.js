
var CLI = require('./lib/CLI.js');

process.env.PM2_PROGRAMMATIC = 'true';

/**
 * Ensure that PM2 has been inited when using it programmatically
 */
CLI.pm2Init();

module.exports = CLI;
