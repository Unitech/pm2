
var CLI = require('./lib/CLI.js');

/**
 * Ensure that PM2 has been inited when using it programmatically
 */
CLI.pm2Init();

module.exports = CLI;
