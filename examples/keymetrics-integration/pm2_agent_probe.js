var axm = require('pmx');
var fs  = require('fs');
var path = require('path');

fs.readFile(path.join(process.env.HOME, '.pm2', 'agent.pid'), function(err, data) {

    var pid = data.toString();

    axm.configureModule({
          name             : 'PM2 Agent',
          version          : '0.12.1',
          pid              : pid,
          errors           : false,
          latency          : false,
          versioning       : false,
          show_module_meta : true,
          author           : 'Alexandre Strzelewicz',
          comment          : 'This module monitors PM2'
        });

  });


setInterval(function() {

}, 1000);
