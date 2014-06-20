
var should = require('should');
var util = require('util');
var axon = require('axon');
var path = require('path');

var Plan = require('../helpers/plan.js');
var APPS = require('../helpers/apps.js');
var Ipm2 = require('pm2-interface');

describe('PM2 BUS / RPC', function() {
  var pm2;
  var ipm2;

  after(function(done) {
    ipm2 = Ipm2();

    ipm2.once('ready', function() {
      ipm2.rpc.killMe({}, function() {
        ipm2.disconnect();
        done();
      });
    });
  });

  it('should fork PM2', function(done) {
    try {
      pm2 = APPS.forkPM2();
    } catch(e) {
    }
    done();
  });

  describe('Interface', function() {

    beforeEach(function(done) {
      ipm2 = Ipm2();

      ipm2.once('ready', function() {
        done();
      });
    });

    afterEach(function() {
      ipm2.disconnect();
    });

    it('should IPM2 have the right properties', function(done) {
      ipm2.bus.should.exist;
      ipm2.rpc.should.have.properties([
        'restartProcessId',
        'prepare',
        'prepareJson',
        'ping',
        'reloadLogs',
        'stopAll',
        'stopProcessId'
        //..
      ]);
      done();
    });

    it('should start a process via IPM2', function(done) {
      APPS.launchApp(ipm2, 'echo.js', 'echo', function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(1);
        procs[0].pm2_env.status.should.eql('online');
        procs[0].pm2_env.should.have.properties([
          'pm_id',
          'restart_time',
          'created_at',
          'pm_uptime',
          'pm_exec_path',
          'pm_err_log_path',
          'pm_out_log_path',
          'pm_pid_path'
        ]);
        done();
      });
    });

    it('should receive log:out and log:err messages', function(done) {
      var plan = new Plan(2, done);

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} data
       * @return
       */
      function rcpt(event, data) {
        if (event == 'log:out')
          plan.ok(true);
        if (event == 'log:err')
          plan.ok(true);
      }

      ipm2.bus.on('*', rcpt);
    });

    it('should receive process:exit and process:online signal on restart', function(done) {
      var plan = new Plan(3, done);

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} data
       * @return
       */
      function rcpt(event, data) {
        if (event == 'process:exit')
          plan.ok(true);
        if (event == 'process:online')
          plan.ok(true);
      }

      ipm2.bus.on('*', rcpt);

      ipm2.rpc.restartProcessName('echo', function(err, procs) {
        should(err).be.null;
        procs[0].pm2_env.restart_time.should.eql(1);
        plan.ok(true);
      });
    });

    it('should delete echo process', function(done) {
      ipm2.rpc.deleteProcessName('echo', function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(0);
        done();
      });
    });

    it('should start exception process', function(done) {
      APPS.launchApp(ipm2, 'throw.js', 'throw', function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(1);
        procs[0].pm2_env.status.should.eql('online');
        procs[0].pm2_env.should.have.properties([
          'pm_id',
          'restart_time',
          'created_at',
          'pm_uptime',
          'pm_exec_path',
          'pm_err_log_path',
          'pm_out_log_path',
          'pm_pid_path'
        ]);
        done();
      });
    });

    it('should receive process:exception message', function(done) {
      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} data
       * @return
       */
      function rcpt(event, data) {
        if (event == 'process:exception')
          done();
      }

      ipm2.bus.on('*', rcpt);
    });

    it('should delete throwing exception when calling stop method', function(done) {
      ipm2.rpc.stopProcessName('throw', function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(1);
        procs[0].pm2_env.status.should.eql('stopped');
        done();
      });
    });

    it('should delete all processes', function(done) {
      ipm2.rpc.deleteAll({}, function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(0);
        done();
      });
    });

    it('should no processes be present in pm2 db', function(done) {
      ipm2.rpc.getMonitorData({}, function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(0);
        done();
      });
    });

  });

  describe('Specific events in CLUSTER_MODE', function() {
    beforeEach(function(done) {
      ipm2 = Ipm2();

      ipm2.once('ready', function() {
        done();
      });
    });

    afterEach(function(done) {
      ipm2.rpc.deleteAll({}, function(err, procs) {
        ipm2.disconnect();
        done();
      });
    });

    it('should start process own_event and catch custom event', function(done) {
      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} data
       * @return
       */
      function rcpt(event, data) {
        if (event == 'user:register')
          done();
      }

      APPS.launchApp(ipm2, 'events/own_event.js', 'own_event', function(err, proc) {
        should(err).be.null;
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(1);
          ipm2.bus.on('*', rcpt);
        });
      });
    });

    it('should start process own_event and catch custom event', function(done) {
      var plan = new Plan(3, done);

      /**
       * Description
       * @method triggerMessage
       * @return
       */
      function triggerMessage() {
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(1);
          console.log('Triggering message');
          ipm2.rpc.msgProcess({
            id : procs[0].pm_id,
            msg : 'refresh:db'
          }, function(err, dt) {
            should(err).be.null;
            console.log('Message triggered');
            plan.ok(true);
          });
        });
      }

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} msg
       * @return
       */
      function rcpt(event, msg) {
        // This is the message that a new action will be registered
        if (event == 'axm:action') {
          msg.data.type.should.be.eql('axm:action');
          msg.data.data.action_name.should.eql('refresh:db');
          msg.process.should.have.properties([
            'process', 'pm2_env'
          ]);
          plan.ok(true);
          triggerMessage();
        }

        if (event == 'axm:reply') {
          msg.data.type.should.eql('axm:reply');
          msg.data.data.success.should.eql(true);
          msg.process.should.have.properties([
            'process', 'pm2_env'
          ]);
          plan.ok(true);
        }
      }

      ipm2.bus.on('*', rcpt);

      APPS.launchApp(ipm2, 'events/custom_action.js', 'custom_event', function(err, proc) {
        should(err).be.null;

        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(1);
        });
      });
    });
  });

  describe.skip('Specific event in FORK_MODE', function() {
    beforeEach(function(done) {
      ipm2 = Ipm2();

      ipm2.once('ready', function() {
        done();
      });
    });

    afterEach(function(done) {
      ipm2.disconnect();
      done();
    });

    it('should start process own_event and catch custom event', function(done) {
      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} data
       * @return
       */
      function rcpt(event, data) {
        if (event == 'user:register')
          done();
      }

      APPS.launchAppFork(ipm2, 'events/own_event.js', 'own_event', function(err, proc) {
        should(err).be.null;
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          ipm2.bus.on('*', rcpt);
        });
      });
    });

    it('should delete all apps', function(done) {
      ipm2.rpc.deleteAll({}, function(err, procs) {
        done();
      });
    });

    it('should start process own_event and catch custom event', function(done) {
      var plan = new Plan(3, done);

      /**
       * Description
       * @method triggerMessage
       * @return
       */
      function triggerMessage() {
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          console.log('Triggering message');
          ipm2.rpc.msgProcess({
            id : procs[0].pm_id,
            msg : 'refresh:db'
          }, function(err, dt) {
            should(err).be.null;
            console.log('Message triggered');
            plan.ok(true);
          });
        });
      }

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} msg
       * @return
       */
      function rcpt(event, msg) {
        // This is the message that a new action will be registered
        if (event == 'axm:action') {
          msg.data.type.should.be.eql('axm:action');
          msg.data.data.action_name.should.eql('refresh:db');
          msg.process.should.have.properties([
            'process', 'pm2_env'
          ]);
          plan.ok(true);
          triggerMessage();
        }

        if (event == 'axm:reply') {
          msg.data.type.should.eql('axm:reply');
          msg.data.data.success.should.eql(true);
          msg.process.should.have.properties([
            'process', 'pm2_env'
          ]);
          plan.ok(true);
        }
      }

      ipm2.bus.on('*', rcpt);

      APPS.launchAppFork(ipm2, 'events/custom_action.js', 'custom_event', function(err, proc) {
        should(err).be.null;
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(1);
        });
      });
    });

    it('should reference the new action into the pm2_env.axm_actions', function(done) {
      ipm2.rpc.getMonitorData({}, function(err, procs) {
        should(err).be.null;
        procs[0].pm2_env.axm_actions[0].action_name.should.eql('refresh:db');
        should(procs[0].pm2_env.axm_actions[0].opts).be.null;
        done();
      });
    });

    it('should on process stop not referenciate axm_actions anymore', function(done) {
      ipm2.rpc.stopAll({}, function(err, procs) {
        should(err).be.null;
        ipm2.rpc.getMonitorData({}, function(err, procs) {
          should(err).be.null;
          procs[0].pm2_env.axm_actions.length.should.eql(0);;
          done();
        });
      });
    });

    it('should start an APP and reference axm_action once axm:action message received', function(done) {

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} msg
       * @return
       */
      function rcpt(event, msg) {
        // This is the message that a new action will be registered
        if (event == 'axm:action') {
          ipm2.rpc.getMonitorData({}, function(err, procs) {
            should(err).be.null;
            procs[1].pm2_env.axm_actions[0].action_name.should.eql('refresh:db');
            should(procs[1].pm2_env.axm_actions[0].opts).be.null;
            done();
          });
        }
      }

      APPS.launchAppFork(ipm2, 'events/custom_action.js', 'custom_event', function(err, procs) {
        should(err).be.null;
        ipm2.bus.on('*', rcpt);
      });
    });

    it('should delete all apps', function(done) {
      ipm2.rpc.deleteAll({}, function(err, procs) {
        done();
      });
    });

  });

  describe.skip('Multiple axm_actions test', function() {
    beforeEach(function(done) {
      ipm2 = Ipm2();

      ipm2.once('ready', function() {
        done();
      });
    });

    afterEach(function(done) {
      ipm2.disconnect();
      done();
    });

    it('should start process in cluster_mode and get 3 axm:action + get comments', function(done) {
      var plan = new Plan(6, done);

      /**
       * Description
       * @method rcpt
       * @param {} event
       * @param {} msg
       * @return
       */
      function rcpt(event, msg) {
        if (event == 'axm:action') {
          plan.ok(true);
          if (msg.data.data.opts && msg.data.data.opts.comment) {
            plan.ok(true);
          }
        }
      }
      ipm2.bus.on('*', rcpt);

      APPS.launchAppFork(ipm2, 'events/custom_action_with_params.js', 'custom_action_params', function(err, procs) {
        should(err).be.null;
      });
    });
  });


});
