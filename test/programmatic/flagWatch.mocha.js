
var should = require('should');
var f_w    = require('../../lib/API/Modules/flagWatch.js');
var fs     = require('fs');

describe('Flag --ignore-watch', function() {

    it('should return not empty result', function() {
        var res = [];
        f_w.handleFolders('./', res);
        should(res).be.not.empty();
    });
    it('should not crash', function() {
        var res = []
        f_w.handleFolders();
        f_w.handleFolders(res);
        f_w.handleFolders('');
        f_w.handleFolders('lsdldmcsdf/amfkdmfk');
    });
    it('should give different results', function() {
        var tmp_res = [];
        var res = [];
        f_w.handleFolders('./lib', res);
        f_w.handleFolders('./examples', tmp_res);
        should(res).not.equal(tmp_res);
    });
    it('should not crash in case, when no access for file or directory by permissions', function() {
        var fileStream;

        if (!fs.existsSync("noAccessDir"))
            fs.mkdirSync("noAccessDir", 0777);
        if (!fs.existsSync("noAccessDir/checkPermissions.txt")) {
            fileStream = fs.createWriteStream("noAccessDir/checkPermissions.txt");
            fileStream.write("It's a temporary file for testing flag --ignore-watch in PM2");
            fileStream.end();
        }
        fs.chmodSync('noAccessDir/checkPermissions.txt', 0000);
        fs.chmodSync('noAccessDir', 0000);

        after(function () {
            fs.chmodSync('noAccessDir', 0777);
            fs.chmodSync('noAccessDir/checkPermissions.txt', 0777);
            fs.unlinkSync('noAccessDir/checkPermissions.txt');
            fs.rmdirSync('noAccessDir/');
        });

        f_w.handleFolders('noAccessDir/', []);
        f_w.handleFolders('noAccessDir/checkPermissions.txt', []);
    });
    it('should ignore node_modules folder', function() {
        var res = [];
        f_w.handleFolders('./node_modules', res);
        should(res).be.empty();
    });
});
