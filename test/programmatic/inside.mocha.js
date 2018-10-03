
var PM2 = require('../..');
var should = require('should');

describe('Call PM2 inside PM2', function() {
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures/inside'
  });

  after(function(done) {
    pm2.kill(function(){
      done();
    });
  });

  it('should start script that starts a script', function(done) {
    pm2.start('start_inside.js', function(err) {
      should(err).be.null();
      setTimeout(done, 1500);
    });
  });

  it('should list 2 processes and apps stabilized', function(done) {
    pm2.list(function(err, list) {
      should(err).be.null();
      should(list.length).eql(2);
      list.forEach(function(proc) {
        should(proc.pm2_env.restart_time).eql(0);
        should(proc.pm2_env.status).eql('online');
      });
      done();
    });
  });

  it('should start script that restart script', function(done) {
    pm2.start('restart_inside.js', function(err) {
      should(err).be.null();
      setTimeout(done, 1500);
    });
  });

  it('should list 3 processes and apps stabilized', function(done) {
    pm2.list(function(err, list) {
      should(err).be.null();
      should(list.length).eql(3);
      list.forEach(function(proc) {
        if (proc.name == 'echo') {
          should(proc.pm2_env.restart_time).eql(1);
          should(proc.pm2_env.status).eql('online');
        }
        else {
          should(proc.pm2_env.restart_time).eql(0);
          should(proc.pm2_env.status).eql('online');
        }
      });
      done();
    });
  });

  it('should start script that reload script', function(done) {
    pm2.start('reload_inside.js', function(err) {
      should(err).be.null();
      setTimeout(done, 1500);
    });
  });

  it('should list 4 processes and apps stabilized', function(done) {
    pm2.list(function(err, list) {
      should(err).be.null();
      should(list.length).eql(4);
      list.forEach(function(proc) {
        if (proc.name == 'echo') {
          should(proc.pm2_env.restart_time).eql(2);
          should(proc.pm2_env.status).eql('online');
        }
        else {
          should(proc.pm2_env.restart_time).eql(0);
          should(proc.pm2_env.status).eql('online');
        }
      });
      done();
    });
  });

});
