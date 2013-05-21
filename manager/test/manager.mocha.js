var debug = require('debug')('devops:test:manager');

var Manager = require('..');
var should = require('should');
var path = require('path');

var root = path.resolve(__dirname, 'fixtures');

// add test for json file
// fix path pb
describe('manager', function() {
   
 it('should be a function.', function() {
        Manager.should.be.a('function');
    });

    it('should be mixable.', function() {
        Manager.should.have.property('mixin');
        Manager.mixin.should.be.a('function');
    });

    it('should return a function.', function() {
        Manager().should.be.a('function');
    });

    it('should return a different instance.', function() {
        Manager().should.not.eql(Manager());
    });

    describe('An instance:', function() {
        var manager = Manager();

        it('should be a function.', function() {
            manager.should.be.a('function');
        });

        it('should be mixable.', function() {
            manager.should.have.property('mixin');
            manager.mixin.should.be.a('function');
        });
    });

    after(function(done) {
        manager.stopAll(done);
    });

    describe('use', function() {

        manager = Manager();
        it('should be contain none process in thread', function(done) {
            var processes = manager.getCurrentProcesses;
            processes.length.should.be.equal(0);
            done();
        });

        it('should run a echo process with object & stop', function(done){
            var o = {
                "path": "echo.js",
                "outFile": "out-echo.log",
                "errFile": "err-echo.log",
                "pidFile": "echo.log",
                "options": ""
            };
            manager.dir(root).use(o).start(function(){
                var processes = manager.getCurrentProcesses();
                manager.checkProcess(processes[0].child.pid).should.be.true;
                manager.stopAll(function() {
                    done();
                });
            })
        })

        it('should be run a echo & bus process ', function(done) {
                var o = {
                "path": "echo.js",
                "outFile": "out-echo.log",
                "errFile": "err-echo.log",
                "pidFile": "echo.log",
                "options": ""
            };
            manager = Manager();
            manager.dir(root).use(o).use(o).use(o).start(function(){
                var processes = manager.getCurrentProcesses();
                manager.checkProcess(processes[0].child.pid).should.be.true;
                manager.checkProcess(processes[1].child.pid).should.be.true;
                setTimeout(done, 1000);
            })
        });

    });
});
