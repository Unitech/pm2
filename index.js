

var CLI = require('./lib/CLI.js');

process.env.PM2_PROGRAMMATIC = 'true';

/**
 * Default singleton for
 * module.exports = new CLI;
 * module.exports.instance = CLI
 */
module.exports = CLI;
