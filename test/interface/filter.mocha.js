
var Filter = require('../../lib/Interactor/Filter.js');
var should = require('should');
var os = require('os');

describe('Filter Utility', function() {
  it('should .status works as expected', function() {
    var filtered = Filter.status([], {
      REVERSE_INTERACT : true,
      PM2_VERSION : '2.2.0'
    });
    filtered.server.should.have.properties(['loadavg', 'total_mem', 'free_mem']);
    should(filtered.server.total_mem).eql(os.totalmem());
    should(filtered.server.arch).eql(os.arch());
  });

  it('should .monitoring works as expected', function() {
    var filtered = Filter.monitoring([], {});
    filtered.should.have.properties(['loadavg', 'total_mem', 'free_mem', 'processes']);
    filtered.total_mem.should.eql(os.totalmem());
  });

});
