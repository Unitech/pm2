process.env.NODE_ENV = 'test';

const PM2    = require('../../lib/API.js');
const sorter = require('../../lib/tools/Config.js');
const God    = require('../../lib/God');
const should = require('should');
const fs = require('fs');

var pm2 = new PM2;
var cluster = [{
    name   : 'clustered_http',
    script : __dirname + '/../fixtures/priority/http.js',
    instances : 'max',
    exec_mode : 'cluster',
    priority  : 34,
    stop_priority: 86,
    env : {
      PORT : 8002
    }
  }, {
    name : 'forked_app',
    script   : __dirname + '/../fixtures/priority/http.js',
    stop_priority: 2,
    env : {
      PORT : 8001
    }
  }, {
    name : 'forked_app2',
    script   : __dirname + '/../fixtures/priority/http.js',
    priority : 1,
    stop_priority: 1,
    env : {
      PORT : 8003
    }
  }, {
    name : 'forked_app3',
    script   : __dirname + '/../fixtures/priority/http.js',
    priority: 3,
    env : {
      PORT : 8004
    }
  }, {
    name : 'forked_app4',
    script   : __dirname + '/../fixtures/priority/http.js',
    priority : 2,
    stop_priority: 3,
    env : {
      PORT : 8005
    }
}];
var same_prior = [
	{
		name : 'first',
		script   : __dirname + '/../fixtures/priority/http.js',
		priority : 3,
		env : {
			PORT : 8001
		}
	}, {
		name : 'second',
		script   : __dirname + '/../fixtures/priority/http.js',
		priority : 1,
		env : {
			PORT : 8002
			}
		}, {
			name : 'third',
			script   : __dirname + '/../fixtures/priority/http.js',
			priority : 1,
			env : {
				PORT : 8003
		}
	}, {
			name : 'fourth',
			script   : __dirname + '/../fixtures/priority/http.js',
			priority : 2,
			env : {
				PORT : 8004
			}
	}];
	var without_prior = [
		{
			name : 'first',
			script   : __dirname + '/../fixtures/priority/http.js',
			env : {
				PORT : 8001
			}
		}, {
			name : 'second',
			script   : __dirname + '/../fixtures/priority/http.js',
			env : {
				PORT : 8002
				}
			}, {
				name : 'third',
				script   : __dirname + '/../fixtures/priority/http.js',
				env : {
					PORT : 8003
			}
		}];

describe('Start/restart/stop priority', function() {
	after(function() {
	//	fs.unlinkSync(__dirname.concat('/../fixtures/priority/test.json'));
		pm2.killDaemon();
	});
	
	if(fs.existsSync(__dirname.concat('/../fixtures/priority/test.json')))
		fs.unlinkSync(__dirname.concat('/../fixtures/priority/test.json'));
	fs.appendFileSync(__dirname.concat('/../fixtures/priority/test.json'),JSON.stringify(cluster));
	it('should start in order by priority', function(done) {
		pm2.start(__dirname.concat('/../fixtures/priority/test.json'), function(err) {
			pm2.Client.executeRemote('getMonitorData', {}, function(err, list) {
				list[0].name.should.be.equal('forked_app2');
				list[1].name.should.be.equal('forked_app4');
				list[2].name.should.be.equal('forked_app3');
				list[3].name.should.be.equal('clustered_http');
				list[4].name.should.be.equal('clustered_http');
				list[5].name.should.be.equal('clustered_http');
				list[6].name.should.be.equal('clustered_http');
				list[7].name.should.be.equal('forked_app');
				done();
			});
		});
	});

	it('should restart in order by start priority', function(done) {
		pm2.restart(__dirname.concat('/../fixtures/priority/test.json'), function(err) {
			pm2.Client.executeRemote('getMonitorData', {}, function(err, list) {
				list[0].name.should.be.equal('forked_app2');
				list[1].name.should.be.equal('forked_app4');
				list[2].name.should.be.equal('forked_app3');
				list[3].name.should.be.equal('clustered_http');
				list[4].name.should.be.equal('clustered_http');
				list[5].name.should.be.equal('clustered_http');
				list[6].name.should.be.equal('clustered_http');
				list[7].name.should.be.equal('forked_app');
				done();
			});
		});
	});

	it('should start in order with same start priorities', function(done) {
		pm2.killDaemon(function()
		{
			var res = sorter.checkPriority(same_prior, 'start');
			res[0][0].name.should.be.equal('second');
			res[0][1].name.should.be.equal('third');
			res[1].name.should.be.equal('fourth');
			res[2].name.should.be.equal('first');
			pm2.start(same_prior, function(err){
				done();
			});
		});
	});

	it('should start in order without start priorities', function(done) {
			var res = sorter.checkPriority(without_prior, 'start');
			res[0].name.should.be.equal('first');
			res[1].name.should.be.equal('second');
			res[2].name.should.be.equal('third');
			var stop_res = sorter.checkPriority(without_prior, 'stop');
			done();
	});

	it('should restart in order with same start priorities', function(done) {
		pm2.restart(same_prior, function(err) {
			pm2.Client.executeRemote('getMonitorData', {}, function(err, list) {
				list[0].name.should.be.equal('second');
				list[1].name.should.be.equal('third');
				list[2].name.should.be.equal('fourth');
				list[3].name.should.be.equal('first');
				done();
			});
		});
	});
});