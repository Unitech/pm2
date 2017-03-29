
process.env.DEBUG='pm2:aggregator';
var should    = require('should');
var Aggregator = require('../../lib/Interactor/TransactionAggregator.js');
var Utility = require('../../lib/Interactor/Utility.js');
var Plan   = require('../helpers/plan.js');
var TraceFactory = require('./misc/trace_factory.js');
var TraceMock = require('./misc/trace.json');
var path = require('path');
var fs = require('fs');

describe('Transactions Aggregator', function() {
  var aggregator;
  var stackParser;

  it('should instanciate context cache', function() {
    var cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key));
          return content.toString().split(/\r?\n/);
        } catch (err) {
          return undefined;
        }
      }
    })

    stackParser = new Utility.StackTraceParser({ cache: cache, context: 2});
  });

  it('should instanciate aggregator', function() {
    aggregator = new Aggregator({ stackParser: stackParser});
  });

  describe('.censorSpans', function() {
    var trace = TraceFactory.generateTrace('/yoloswag/swag', 2);

    it('should not fail', function() {
      aggregator.censorSpans(null);
    });

    it('should censor span', function() {
      should.exist(trace.spans[1].labels.results);
      aggregator.censorSpans(trace.spans);
      should.not.exist(trace.spans[1].labels.results);
      trace.spans[1].labels.cmd.should.containEql('?');
    });
  });

  describe('.isIdentifier', function() {
    it('should be an identifier (api version)', function() {
      aggregator.isIdentifier('v1').should.equal(true);
    });

    it('should be an identifier (number)', function() {
      aggregator.isIdentifier('123').should.equal(true);
    });

    it('should be an identifier (random str)', function() {
      aggregator.isIdentifier('65f4ez656').should.equal(true);
    });

    it('should be an identifier (uuid)', function() {
      aggregator.isIdentifier('123e4567-e89b-12d3-a456-426655440000').should.equal(true);
    });

    it('should be an identifier (uuid w/o dash)', function() {
      aggregator.isIdentifier('123e4567e89b12d3a456426655440000').should.equal(true);
    });

    it('should be NOT an identifier', function() {
      aggregator.isIdentifier('bucket').should.equal(false);
    });

    it('should be NOT an identifier', function() {
      aggregator.isIdentifier('admin').should.equal(false);
    });

    it('should be NOT an identifier', function() {
      aggregator.isIdentifier('auth').should.equal(false);
    });
  });

  describe('.matchPath - aggregate', function() {
    var routes = {
      'bucket/6465577': { spans: true }
    };

    it('should match first route', function() {
      var match = aggregator.matchPath('bucket/67754', routes);
      should.exist(match);
      match.should.be.a.String();
      match.should.equal('bucket/*');
      should.exist(routes['bucket/*'])
    });

    it('should NOT match any route', function() {
      should.not.exist(aggregator.matchPath('toto/67754', routes));
    });

    it('should match aggregated route with *', function() {
      var match = aggregator.matchPath('bucket/87998', routes);
      should.exist(match);
      match.should.be.a.String();
      match.should.equal('bucket/*');
      should.exist(routes['bucket/*'])
    });
  });

  describe('merging trace together', function() {
    var trace = TraceFactory.generateTrace('yoloswag/swag', 2);
    var ROUTES = {
      'yoloswag/swag': {}
    };

    it('should not fail', function() {
      aggregator.mergeTrace(null, trace)
    });

    it('should add a trace', function() {
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace)
      ROUTES['yoloswag/swag'].meta.histogram.getCount().should.be.equal(1);
      ROUTES['yoloswag/swag'].variances.length.should.be.equal(1);
      ROUTES['yoloswag/swag'].variances[0].spans.length.should.be.equal(3);
    });

    it('should merge with the first variance', function() {
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace);
      ROUTES['yoloswag/swag'].variances.length.should.be.equal(1);
      ROUTES['yoloswag/swag'].variances[0].histogram.getCount().should.be.equal(2);
    });

    it('should merge as a new variance with the same route', function () {
      var trace2 = TraceFactory.generateTrace('yoloswag/swag', 3)
      trace2.spans.forEach(function (span) {
        span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      })
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace2);
      ROUTES['yoloswag/swag'].meta.histogram.getCount().should.be.equal(3);
      ROUTES['yoloswag/swag'].variances.length.should.be.equal(2);
      ROUTES['yoloswag/swag'].variances[0].histogram.getCount().should.be.equal(2);
      ROUTES['yoloswag/swag'].variances[1].histogram.getCount().should.be.equal(1);
      ROUTES['yoloswag/swag'].variances[1].spans.length.should.be.equal(4);
    });
  });

  describe('.aggregate', function() {
    it('should not fail', function() {
      var dt = aggregator.aggregate(null);
      should(dt).be.false();
    });

    it('should aggregate', function() {
      // Simulate some data
      var packet = TraceFactory.generatePacket('yoloswag/swag', 'appname');
      aggregator.aggregate(packet);
      packet = TraceFactory.generatePacket('yoloswag/swag', 'appname');
      aggregator.aggregate(packet);
      packet = TraceFactory.generatePacket('yoloswag/swag', 'appname');
      aggregator.aggregate(packet);
      packet = TraceFactory.generatePacket('sisi/aight', 'appname');
      aggregator.aggregate(packet);
      packet = TraceFactory.generatePacket('sisi/aight', 'APP2');

      var agg = aggregator.aggregate(packet);

      // should get 2 apps in agg
      should.exist(agg['appname']);
      should.exist(agg['APP2']);

      // should contain 2 routes for appname
      Object.keys(agg['appname'].routes).length.should.eql(2);
      should.exist(agg['appname'].process);
      agg['appname'].meta.trace_count.should.eql(4);
      should.exist(agg['appname'].meta.histogram.percentiles([0.5])[0.5]);

      // should pm_id not taken into account
      should.not.exist(agg['appname'].process.pm_id);
    });
  });


  describe('.normalizeAggregation', function() {
    it('should get normalized aggregattion', function(done) {
      var ret = aggregator.prepareAggregationforShipping();
      should.exist(ret['appname'].process.server);
      should.exist(ret['APP2'].process.server);
      done();
    });
  });

});
