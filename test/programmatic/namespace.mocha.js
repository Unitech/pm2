

process.chdir(__dirname);

var PM2 = require('../..');
var should = require('should');

describe('NAMESPACE app management', function() {
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  before(function(done) {
    pm2.delete('all', function() { done() });
  });

  after(function(done) {
    pm2.kill(done);
  });

  it('should start 2 app in NS1', (done) => {
    pm2.start({
      script: './echo.js',
      name: 'echo1-ns1',
      namespace: 'NS1'
    }, (err, procs) => {
      should(err).be.null()
      procs[0].pm2_env.namespace.should.eql('NS1')
      pm2.start({
        script: './echo.js',
        namespace: 'NS1',
        name: 'echo2-ns1'
      }, (err, procs) => {
        should(err).be.null()
        procs[0].pm2_env.namespace.should.eql('NS1')
        done()
      })
    })
  })

  it('should start 2 app in NS2', (done) => {
    pm2.start({
      script: './echo.js',
      name: 'echo1-ns2',
      namespace: 'NS2'
    }, (err, procs) => {
      should(err).be.null()
      procs[0].pm2_env.namespace.should.eql('NS2')
      pm2.start({
        script: './echo.js',
        name: 'echo2-ns2',
        namespace: 'NS2'
      }, (err, procs) => {
        should(err).be.null()
        procs[0].pm2_env.namespace.should.eql('NS2')
        done()
      })
    })
  })

  it('should restart only app in NS1', function(done) {
    pm2.restart('NS1', () => {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(4);
        list.forEach(l => {
          if (l.name == 'echo1-ns1')
            should(l.pm2_env.restart_time).eql(1)
          if (l.name == 'echo2-ns1')
            should(l.pm2_env.restart_time).eql(1)
          if (l.name == 'echo1-ns2')
            should(l.pm2_env.restart_time).eql(0)
          if (l.name == 'echo2-ns2')
            should(l.pm2_env.restart_time).eql(0)
        })
        done();
      });
    })
  })

  it('should restart all', function(done) {
    pm2.restart('all', () => {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(4);
        list.forEach(l => {
          if (l.name == 'echo1-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo2-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo1-ns2')
            should(l.pm2_env.restart_time).eql(1)
          if (l.name == 'echo2-ns2')
            should(l.pm2_env.restart_time).eql(1)
        })
        done();
      });
    })
  })

  it('should restart NS2', function(done) {
    pm2.restart('NS2', () => {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(4);
        list.forEach(l => {
          if (l.name == 'echo1-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo2-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo1-ns2')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo2-ns2')
            should(l.pm2_env.restart_time).eql(2)
        })
        done();
      });
    })
  })

  it('should stop NS2', function(done) {
    pm2.stop('NS2', () => {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(4);
        list.forEach(l => {
          if (l.name == 'echo1-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo2-ns1')
            should(l.pm2_env.restart_time).eql(2)
          if (l.name == 'echo1-ns2')
            should(l.pm2_env.status).eql('stopped')
          if (l.name == 'echo2-ns2')
            should(l.pm2_env.status).eql('stopped')
        })
        done();
      });
    })
  })

  it('should delete NS2', function(done) {
    pm2.delete('NS2', () => {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2);
        done();
      });
    })
  })

})
