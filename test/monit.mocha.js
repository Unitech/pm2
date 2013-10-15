
var Monit = require('../lib/Monit');
var should = require('should');
var assert = require('better-assert');
var os = require('os');

describe('Monit', function() {
  it('should have right properties', function() {
    Monit.should.have.property('init');
    Monit.should.have.property('refresh');
    Monit.should.have.property('drawRatio');
    Monit.should.have.property('stop');
  });

  var fixt1 = [{
    pid : 324,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'online'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 50,
      cpu: 0
    }
  },{
    pid : 3245,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'online'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 10,
      cpu: 0
    }
  },{
    pid : 3247,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'stopped'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 2,
      cpu: 0
    }
  }];

  var fixt2 = [{
    pid : 324,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'online'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 25,
      cpu: 0
    }
  },{
    pid : 3245,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'stopped'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 5,
      cpu: 0
    }
  },{
    pid : 3247,
    pm2_env : {
      pm_exec_path : 'asd',
      name : 'test',
      status : 'stopped'
      ,pm_id : 666
      ,exec_mode : 'fork_mode'
    },
    monit: {
      memory: os.totalmem() / 8,
      cpu: 0
    }
  }];

  it('should init', function(done) {
    Monit.init(fixt1);
    done()
  });

  it('should refresh and handle processes with different sizes', function(done) {
    setTimeout(function() {
      Monit.refresh(fixt2);
      done();
    }, 400);
  });

  it('should stop monitoring', function() {
    Monit.stop();
  });

});
