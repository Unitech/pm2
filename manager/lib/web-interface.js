var express = require('express');
var http = require('http');
var forever = require('../forever');
var usage = require('usage');
var os = require('os');

var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.errorHandler());
app.use(express.logger('dev'));

app.get('/', function(req, res) {
    var json = [];

    forever.getAllProcesses(function(dt) {
        if (dt) {
            dt.forEach(function(pro) {
                usage.lookup(pro.pid, function(err, res) {
                    pro.monit = {};
                    pro.monit.cpu = res.cpu;
                    pro.monit.memory = res.memory;
                    delete pro.spawnWith;
                    json.push(pro);
                });
            });
        }
        setTimeout(function() {
            // Computer API point
            data = {
                system_info: {
                    hostname: os.hostname(),
                    uptime: os.uptime()
                },
                processes: json,
                monit: {
                    loadavg: os.loadavg(),
                    total_mem: os.totalmem(),
                    free_mem: os.freemem(),
                    cpu: os.cpus(),
                    interfaces: os.networkInterfaces()
                }
            };
            res.send(data);
        }, 100);
    });
});

var server = http.createServer(app);

server.listen(4000, function() {
    console.log("Web server enabled on port 4000");
});