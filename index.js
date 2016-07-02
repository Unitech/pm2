
process.env.PM2_PROGRAMMATIC = 'true';

var CLI = require('./lib/CLI.js');

module.exports = new CLI;
module.exports.custom = CLI;
