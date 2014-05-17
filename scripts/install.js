
var q        = require('./question.js');
var WatchDog = require('../lib/WatchDog.js');
var fs       = require('fs');
var cst      = require('../constants.js');

if (fs.existsSync(cst.WATCHDOG_FILE)) {
  process.exit(0);
}

(function pre_init() {
  fs.exists(cst.DEFAULT_FILE_PATH, function(exist) {
    try {
      if (!exist) {
        fs.mkdirSync(cst.DEFAULT_FILE_PATH);
        fs.mkdirSync(cst.DEFAULT_LOG_PATH);
        fs.mkdirSync(cst.DEFAULT_PID_PATH);
      }
    } catch(e) {
      process.exit(0);
    };
  });
})();

function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

var t = setTimeout(function() {
  console.log('\nQuestion canceled, you can still enable pm2 monitoring via `$ pm2 subscribe`');
  WatchDog.refuse(function() {
    process.exit(0);
  });
}, 10000);

q.askOne({ info: 'Would you like to be notified by email when a problem is detected on your server (server offline) ? (y/n)', required : false }, function(result){
  clearTimeout(t);

  if (result == 'y' || result == 'Y') {

    function get_email() {
      q.askOne({ info: 'Email' }, function(email){
        if (!validateEmail(email)) {
          console.log('Wrong email format, please retry');
          return get_email();
        }
        WatchDog.createConfFile(email, function() {
          console.log('Thanks for your subscription, you will receive a mail shortly once pm2 is online and/or updated.');
          process.exit(0);
        });
      });
    }

    get_email();
  }
  else {
    WatchDog.refuse(function() {
      console.log('\nSubscription canceled, you can still enable pm2 simple monitoring via \n$ pm2 subscribe my@email.com\n');
      process.exit(0);
    });
  }
});
