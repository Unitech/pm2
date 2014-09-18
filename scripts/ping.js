
var cst       = require('../constants.js');
var fs = require('fs');

try {
  var pm2_pid = fs.readFileSync(cst.PM2_PID_FILE_PATH);
} catch(e) {
  process.exit(1);
}

if (pm2_pid) {
  try {
    process.kill(parseInt(pm2_pid), 0);
    console.log('[PM2] PM2 online. Processing.');
    process.exit(0);
  }
  catch (err) {
    process.exit(1);
  }
}
