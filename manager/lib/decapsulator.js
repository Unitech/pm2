//
// Decapsulator.js
//

var fs = require('fs');
var path = require('path');
var uuid = require('./uuid.js');
var forever = require('../forever');
var os = require('os');

const TMP_FOLDER = "../tmp_exec";

var Decap = module.exports = function(func) {
    var f1_uuid = uuid.v4();
    var f1_name = functionName(func);
    var f1_path = path.join(__dirname, TMP_FOLDER, f1_name + "-" + f1_uuid + ".js");
    var tmp_folder = path.join(__dirname, TMP_FOLDER);

    fs.mkdir(tmp_folder, function(e) {
        //console.log(e);
        //if (!e || (e && e.code == 'EEXIST')
    });

    var script_content = func.toString() + '\n' + f1_name + '();';

    fs.writeFile(f1_path, script_content, function(err) {
        if (err) return console.error("Error when trying to save %s", f1_path);
        console.info("Writing %s function to %s file", f1_name, f1_path);

        forever.startDaemon(f1_path, {
            outFile: 'out-' + f1_name + '.log',
            errFile: 'err-' + f1_name + '.log',
            pidFile: f1_name + '.pid',
            options: ''
        }, function(err, monitor) {
            if (err) return console.error('%s not daemonized', f1_name);
            console.info('App %s successfully launched', f1_name);
            return true;
        });
        return true;
    });
};

function functionName(fun) {
    var ret = fun.toString();
    ret = ret.substr('function '.length);
    ret = ret.substr(0, ret.indexOf('('));
    return ret;
}