
const PM2 = require('../..');
const should = require('should');

describe('Internal PM2 configuration', function() {
  var pm2

  before(function() {
    pm2 = new PM2.custom();
  })

  it('should set pm2:registry', function(done) {
    pm2.set('pm2:registry', 'http://thing.com', done)
  })

  it('should new instance have the configuration', function() {
    var pm3 = new PM2.custom();

    pm3.connect(() => {
      should(pm2.user_conf.registry).eql('http://thing.com')
    })
  })
})
