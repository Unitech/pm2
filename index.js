
process.env.PM2_PROGRAMMATIC = 'true';

var API = require('./lib/API.js');

module.exports = new API;
module.exports.custom = API;
