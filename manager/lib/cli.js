#!/usr/bin/env node

var forever = require('../forever');
var path = require('path');
var program = require('commander');
var monit = require('./monitor.js');
var log_stream = require('./logger.js');
var fs = require('fs');
var _ = require('underscore');
var watch = require('watch');

const EXIT_ERR_CODE = 1;
const VERSION = '0.3.2';
const SAMPLE_FILE_PATH = 'apps/sample.json';
const CLI_PREFIX = '\x1B[32m% PM2\x1B[39m';
//
// Process Manager
//
PManager = module.exports = {};

PManager.cliGenerate = function(name) {
    var sample = fs.readFileSync(path.join(__dirname, SAMPLE_FILE_PATH));
    var dt = sample.toString().replace(/VARIABLE/g, name);
    var f_name = name + '-pm2.json';

    fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
    console.info('Sample generated on current folder\n%s :\n', f_name);
    console.info(dt);
    process.exit(0);
};

PManager.cliStart = function(app) {
    var self = this;
    var appConf, scriptPath;

    forever.getAllProcesses(function(processes) {
        // Open app configuration (JSON or env folder APP)
        appConf = self.openAppConf(app);

        if (_.isArray(appConf)) {
            // Is a multiple application JSON, execute each one

            function exec(apps) {
                if (apps[0]) {

                    if (forever.findByScript(apps[0].path, processes) && !program.force) {
                        console.log(CLI_PREFIX, apps[0].path + ' ALREADY LAUNCHED\nAdd -f option to force');
                        process.exit(EXIT_ERR_CODE);
                    };

                    run(apps[0], function() {
                        apps.shift();
                        exec(apps);
                    });

                }
            }
            return exec(appConf);
        };

        // Single application JSON, verify double execution and execute it
        if (forever.findByScript(appConf.path, processes) && !program.force) {
            console.log(CLI_PREFIX, appConf.path + ' ALREADY LAUNCHED\nAdd -f option to force');
            process.exit(EXIT_ERR_CODE);
        }

        return run(appConf);
    });
};

PManager.cliMonit = function() {
    monit();
};

PManager.cliLogs = function() {
    this.getAllProcesses(function(processes) {
        if (processes.length == 0) {
            console.info(CLI_PREFIX, 'No process launched');
            process.exit(EXIT_ERR_CODE);
        }
        processes.forEach(function(process) {
            if (process.logFile) log_stream(process.file + ' l', process.logFile);
            if (process.outFile) log_stream(process.file + ' o', process.outFile);
            if (process.errFile) log_stream(process.file + ' e', process.errFile);
        });
    });
};

PManager.cliStop = function() {
    forever.cli.stopall();
};

PManager.cliList = function() {
    forever.cli.list();
};

PManager.cliJsonList = function() {
    this.getAllProcesses(function(processes) {
        console.log(processes);
    });
};

PManager.openAppConf = function(app) {
    var appConf;
    // If it is a JSON configuration
    if (app.indexOf('.js') > -1) {
        var data = fs.readFileSync(app);
        appConf = JSON.parse(data);
    } else {
        var prefix = process.env.PM_PATH ? process.env.PM_PATH : '../apps/';
        appConf = require(prefix + app + '.json');
    }
    return appConf;
};

PManager.getAllProcesses = function(cb) {
    forever.getAllProcesses(function(dt) {
        if (!dt) return cb([]);
        else return cb(dt);
    });
};

PManager.cliRestart = function() {
    forever.restart();
    console.log(CLI_PREFIX, 'All apps are restarted');
};

PManager.cliWatch = function() {
    console.log(CLI_PREFIX, 'Watching for changes in ' + process.env.PWD);
    PManager.cliLogs();
    watch.watchTree(process.env.PWD, function(f, curr, prev) {
        console.log(CLI_PREFIX, 'File changed, restarting');
        forever.restart();
    });
};

PManager.start = function() {

    program.version(VERSION)
        .option('-v --verbose', 'Display all data')
        .option('-f --force', 'Force actions')
        .usage('[cmd] app');

    program.command('start <part>')
        .description('start specific part')
        .action(function(cmd) {
        PManager.cliStart(cmd);
    });

    program.command('s <part>')
        .description('start specific part')
        .action(function(cmd) {
        PManager.cliStart(cmd);
    });

    program.command('watch')
        .description('watch and restart process when file changing in current folder')
        .action(function() {
        PManager.cliWatch();
    });

    program.command('restart')
        .description('restart all apps')
        .action(function() {
        PManager.cliRestart();
    });

    program.command('monit')
        .description('display process and memory usage of different processes')
        .action(function() {
        PManager.cliMonit();
    });

    program.command('m')
        .description('display process and memory usage of different processes')
        .action(function() {
        PManager.cliMonit();
    });

    program.command('startup <app>')
        .description('launch script at machine startup')
        .action(function() {
        console.log('not implemented yet');
    });

    program.command('list')
        .description('list processes')
        .action(function(cmd) {
        PManager.cliJsonList();
    });

    program.command('logs')
        .description('stream logs')
        .action(function() {
        PManager.cliLogs();
    });

    program.command('lo')
        .description('stream logs')
        .action(function() {
        PManager.cliLogs();
    });

    program.command('jlist')
        .description('list processes in json')
        .action(function(cmd) {
        PManager.cliJsonList();
    });

    program.command('l')
        .description('list processes in json')
        .action(function(cmd) {
        PManager.cliJsonList();
    });

    program.command('generate <cmd>')
        .description('generate sample application.json')
        .action(function(cmd) {
        PManager.cliGenerate(cmd);
    });

    program.command('stop')
        .description('stop processes')
        .action(function(cmd) {
        console.log('Stopping all processes');
        PManager.cliStop();
    });

    if (process.argv.length == 2) {
        program.outputHelp();
        process.exit(EXIT_ERR_CODE);
    }

    program.parse(process.argv);
};

//
// Internal methods
//

function run(appConf, cb) {
    scriptPath = appConf.path;

    console.log(CLI_PREFIX, 'Starting ' + scriptPath);

    forever.startDaemon(scriptPath, appConf, function(err, log_file, monitor) {
        if (err) {
            console.error(CLI_PREFIX, '++ Error\nScript not deamonized : ' + scriptPath);
            console.error(CLI_PREFIX, 'Check logs in ', log_file);
            process.exit(EXIT_ERR_CODE);
        }
        console.info(CLI_PREFIX, 'App ' + scriptPath + ' successfully launched');
        if (cb) cb();
    });
};

function findScript(script, cb) {
    forever.getAllProcesses(function(dt) {
        cb(forever.findByScript(script, dt));
    });
};