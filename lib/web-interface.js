
  try {
    var express = require('express');
  }
catch (e) {
  console.error('[GOD] In order to use the web interface, Install express');
  process.exit(1);
}

var http = require('http');
var os = require('os');
var Satan = require('../satan.js');

var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.errorHandler());
app.use(express.logger('dev'));

app.get('/', function(req, res) {
  var json = [];

  Satan.executeRemote('list', {}, function(err, data_proc) {

    // Computer API point
    var data = {
      processes: data_proc,
      system_info: { hostname: os.hostname(),
                     uptime: os.uptime()
                   },
      monit: { loadavg: os.loadavg(),
               total_mem: os.totalmem(),
               free_mem: os.freemem(),
               cpu: os.cpus(),
               interfaces: os.networkInterfaces()
             }
    };

    return res.send(data);
  });
});

var server = http.createServer(app);

server.listen(4000, function() {
  console.log("Web server enabled on port 4000");
});
