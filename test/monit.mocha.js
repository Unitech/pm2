
var Monit = require('../lib/Monit');
var should = require('should');
var assert = require('better-assert');

describe('Monit', function() {
  it('should have right properties', function() {
    Monit.should.have.property('init');
    Monit.should.have.property('refresh');
    Monit.should.have.property('drawRatio');
    Monit.should.have.property('stop');
  });

  var fixt1 = [{
    pid : 324,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 13357056,
      cpu: 0
    }
  },{
    pid : 3245,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 133570560,
      cpu: 0
    }
  },{
    pid : 3247,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 1335705600,
      cpu: 0
    }
  }];

  var fixt2 = [{
    pid : 324,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 23357096,
      cpu: 0
    }
  },{
    pid : 3245,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 233570560,
      cpu: 0
    }
  },{
    pid : 3247,
    opts : {
      script : 'asd'
    },
    monit: {
      memory: 2335705600,
      cpu: 0
    }
  }];

  it('should init', function() {
    Monit.init(fixt1);    
  });

  it('should refresh and handle processes with different sizes', function() {
    Monit.refresh(fixt2);    
  });

  it('should stop monitoring', function() {
    Monit.stop();
  });

});
