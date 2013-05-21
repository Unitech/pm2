
var pm = require('../').pm2;

pm.use('api').use('bus').start(function() {
    console.log('Processes has been started');
});
