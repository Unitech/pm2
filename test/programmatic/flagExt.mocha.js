
var should = require('should');
var f_e = require('../../lib/API/Modules/flagExt.js');
var fs = require('fs');

describe('Flag -ext', function() {

    var opts = {};
    var res = [];
    opts.ext = 'js,json';

    it('should return not empty result', function() {
        f_e.make_available_extension(opts, res);
        should(res).be.not.empty();
    });
    it('should not crash', function() {
        f_e.make_available_extension();
        f_e.make_available_extension(res);
        f_e.make_available_extension(opts);
    });
    it('should give different results', function() {
        var tmp_res = [];
        f_e.make_available_extension(opts, res);
        opts.ext = 'sh,py';
        f_e.make_available_extension(opts, tmp_res);
        should(res).not.equal(tmp_res);
    });
    it('should not crash in case, when no access for file or directory by permissions', function() {
        var dir = fs.mkdirSync("noAccessDir", 0777);
        opts.ext = 'txt'
        var fileStream = fs.createWriteStream("noAccessDir/checkPermissions.txt");
        fileStream.write("It's a temporary file for testing flag --ext in PM2");
        fileStream.end();
        fs.chmodSync('noAccessDir/checkPermissions.txt', 0000);
        fs.chmodSync('noAccessDir', 0000);
        f_e.make_available_extension(opts, []);
        f_e.make_available_extension(opts, []);
        fs.chmodSync('noAccessDir', 0777);
        fs.chmodSync('noAccessDir/checkPermissions.txt', 0777);
        fs.unlinkSync('noAccessDir/checkPermissions.txt');
        fs.rmdirSync('noAccessDir/');
    });
});
