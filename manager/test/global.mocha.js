var Manager = require('..');

var should = require('should');

describe('manger', function() {
    it('should have all right properties', function(done) {
        var manager = Manager();
        manager.should.have.property('use');
        manager.should.have.property('start');
        manager.should.have.property('stopAll');
        manager.should.have.property('getCurrentProcesses');
        manager.should.have.property('checkProcess');
        manager.should.have.property('clear');
        done();
    });


    it('should cli have all right properties', function(done) {
        var cli = Manager.cli;

        cli.should.have.property('cliGenerate');
        cli.should.have.property('cliStart');
        cli.should.have.property('cliMonit');
        cli.should.have.property('cliLogs');
        cli.should.have.property('cliStop');
        cli.should.have.property('cliJsonList');

        cli.should.have.property('openAppConf');
        cli.should.have.property('getAllProcesses');

        done();
    });
});