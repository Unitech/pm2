process.chdir(__dirname)

var PM2 = require('../..')
var should = require('should')
const fs = require("fs");

describe('When a post_start_hook is configured', function() {
  before(function(done) {
    PM2.delete('all', function() { done() })
  })

  after(function(done) {
    PM2.kill(done)
  })

  afterEach(function(done) {
    PM2.delete('all', done)
  })

  function defineTestsForMode(mode) {
    describe('when running app in ' + mode + ' mode', function() {
      it('should start app and run the post_start_hook script', function(done) {
        PM2.start({
          script: './../fixtures/post_start_hook/echo.js',
          post_start_hook: './../fixtures/post_start_hook/post_start_hook_normal.js',
          exec_mode: mode,
          env: {
            post_start_hook_test: 'true'
          }
        }, (err) => {
          should(err).be.null()
          PM2.list(function(err, list) {
            try {
              should(err).be.null()
              should(list.length).eql(1)
              should.exists(list[0].pm2_env.post_start_hook_info)
              should(list[0].pm2_env.post_start_hook_info.pid).eql(list[0].pid)
              should(list[0].pm2_env.post_start_hook_info.have_env).eql('true')
              var log_file = list[0].pm2_env.PM2_HOME + '/pm2.log';
              fs.readFileSync(log_file).toString().should.containEql('hello-from-post-start-hook-' + list[0].pid)
              if (mode === 'fork') {
                should.exist(list[0].pm2_env.post_start_hook_info.stdin)
                should.exist(list[0].pm2_env.post_start_hook_info.stdout)
                should.exist(list[0].pm2_env.post_start_hook_info.stderr)
                var out_file = list[0].pm2_env.pm_out_log_path;
                setTimeout(function() {
                  fs.readFileSync(out_file).toString().should.containEql('post-start-hook-hello-to-' + list[0].pid)
                  done()
                }, 100)
              } else {
                done();
              }
            } catch(e) {
              done(e)
            }
          })
        })
      })

      it('should log error in pm2 log but keep app running when post_start_hook script throws', function(done) {
        PM2.start({
          script: './../fixtures/post_start_hook/echo.js',
          post_start_hook: './../fixtures/post_start_hook/post_start_hook_throws.js',
          exec_mode: mode,
        }, (err) => {
          should(err).be.null()
          PM2.list(function(err, list) {
            try {
              should(err).be.null()
              should(list.length).eql(1)
              var log_file = list[0].pm2_env.PM2_HOME + '/pm2.log';
              fs.readFileSync(log_file).toString().should.containEql('thrown-from-post-start-hook-' + list[0].pid)
              done()
            } catch(e) {
              done(e)
            }
          })
        })
      })

      it('should log error in pm2 log but keep app running when post_start_hook script returns error', function(done) {
        PM2.start({
          script: './../fixtures/post_start_hook/echo.js',
          post_start_hook: './../fixtures/post_start_hook/post_start_hook_errors.js',
          exec_mode: mode,
        }, (err) => {
          should(err).be.null()
          PM2.list(function(err, list) {
            try {
              should(err).be.null()
              should(list.length).eql(1)
              var log_file = list[0].pm2_env.PM2_HOME + '/pm2.log';
              fs.readFileSync(log_file).toString().should.containEql('error-from-post-start-hook-' + list[0].pid)
              done()
            } catch(e) {
              done(e)
            }
          })
        })
      })

      it('should log error in pm2 log but keep app running when post_start_hook script is not found', function(done) {
        PM2.start({
          script: './../fixtures/post_start_hook/echo.js',
          post_start_hook: './../fixtures/post_start_hook/post_start_hook_nonexistent.js',
          exec_mode: mode,
        }, (err) => {
          should(err).be.null()
          PM2.list(function(err, list) {
            try {
              should(err).be.null()
              should(list.length).eql(1)
              var log_file = list[0].pm2_env.PM2_HOME + '/pm2.log';
              fs.readFileSync(log_file).toString().should.match(/PM2 error: executing post_start_hook failed: Cannot find module .*post_start_hook_nonexistent\.js/)
              done()
            } catch(e) {
              done(e)
            }
          })
        })
      })
    })
  }
  defineTestsForMode('fork')
  defineTestsForMode('cluster')
})
