
var multimeter = require('multimeter');
var forever = require('../forever');
var usage = require('usage');
var logger = require('./logger');

var bars = {};
var monit_data = [];

function get_all(cb) {
    forever.getAllProcesses(function(dt) {
        if (!dt || dt.length == 0) {
            console.log('No processes launched');
            process.exit(1);
        }
        // Async instead
        dt.forEach(function(pro) {
            usage.lookup(pro.pid, function(err, res) {
                if (err) console.error(err);
                if (!err) {
                    pro.monit = {};
                    pro.monit.cpu = res.cpu;
                    pro.monit.memory = res.memory;
                    delete pro.spawnWith;

                    var spll = pro.file.split('/');
                    pro.file = spll[spll.length - 1];

                    monit_data.push(pro);
                }
            });
        });
    });

    setTimeout(function() {
        cb(monit_data);
    }, 500);
}

function bytesToSize(bytes, precision) {
    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;

    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';
    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' KB';
    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' MB';
    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' GB';
    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' TB';
    } else {
        return bytes + ' B';
    }
}

function launch() {
    var multi = multimeter(process);

    multi.on('^C', process.exit);
    multi.charm.reset();

    multi.write('PM2 monitoring :\n\n');

    get_all(function(dt) {

        dt.forEach(function(data, i) {

            //logger(data.pid, data.outFile);

            multi.write(data.file + ' [' + data.pid + '] ' + ' \n\n');

            var bar_cpu = multi(40, (i * 2) + 3 + i, {
                width: 30,
                solid: {
                    text: '|',
                    foreground: 'white',
                    background: 'blue'
                },
                empty: {
                    text: ' '
                }
            });

            var bar_memory = multi(40, (i * 2) + 4 + i, {
                width: 30,
                solid: {
                    text: '|',
                    foreground: 'white',
                    background: 'red'
                },
                empty: {
                    text: ' '
                }
            });

            bar_cpu.percent(0);
            bar_memory.percent(0);

            bars[data.pid] = {};
            bars[data.pid].memory = bar_memory;
            bars[data.pid].cpu = bar_cpu;
            multi.write('\n');
        });


        setInterval(function() {
            monit_data = [];

            get_all(function(dt) {
                dt.forEach(function(data, i) {
                    if (data && data.monit && bars[data.pid]) {

                        bars[data.pid].cpu.percent(data.monit.cpu);
                        bars[data.pid].memory.ratio(data.monit.memory,
                        300000000,
                        bytesToSize(data.monit.memory, 3));
                    }
                });
            });
        }, 100);
    });
}

module.exports = launch;
