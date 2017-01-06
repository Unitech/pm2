
var should    = require('should');
var Aggregator = require('../../lib/Interactor/TransactionAggregator.js');
var Plan   = require('../helpers/plan.js');
var TraceFactory = require('./misc/trace_factory.js');

describe('Transactions Aggregator', function() {
  var aggregator;

  describe('Basic testing', function() {
    it('should instanciate aggregator', function() {
      aggregator = new Aggregator();
    });

    it('should factory generate a trace', function() {
      var trace = TraceFactory.generateTrace('/', 4);
      trace.spans.length.should.eql(5);
    });

    it('should factory generate a random trace', function() {
      var trace = TraceFactory.generateTrace();
      trace.spans.length.should.not.eql(1);
    });
  });

  describe('identification of identifier', function() {
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

  describe('aggregate trace via path', function() {
    var routes = {
      '/bucket/6465577': { spans: true },
      '/admin/bucket/8787': { spans: true },
    };

    it('should match first route', function(done) {
      aggregator.matchPath('/bucket/67754', routes, function (match) {
        should.exist(match);
        match.should.be.a.String();
        match.should.equal('bucket/*');
        should.exist(routes['bucket/*'])
        done()
      })
    });

    it('should NOT match any route', function(done) {
      aggregator.matchPath('/toto/67754', routes, function (match) {
        should.not.exist(match);
        done()
      })
    });

    it('should match aggregated route with *', function(done) {
      aggregator.matchPath('/bucket/87998', routes, function (match) {
        should.exist(match);
        match.should.be.a.String();
        match.should.equal('bucket/*');
        should.exist(routes['bucket/*'])
        done()
      })
    });
  });

  describe('merging trace together', function() {
    var trace = TraceFactory.generateTrace('/yoloswag/swag', 2), ROUTES = { '/yoloswag/swag': {} };

    it('should add a trace', function() {
      aggregator.mergeTrace(ROUTES['/yoloswag/swag'], trace)
      ROUTES['/yoloswag/swag'].meta.count.should.be.equal(1);
      ROUTES['/yoloswag/swag'].variances.length.should.be.equal(1);
      ROUTES['/yoloswag/swag'].variances[0].spans.length.should.be.equal(3);
    });

    it('should merge with the first variance', function() {
      aggregator.mergeTrace(ROUTES['/yoloswag/swag'], trace); 
      ROUTES['/yoloswag/swag'].variances.length.should.be.equal(1);
      ROUTES['/yoloswag/swag'].variances[0].count.should.be.equal(2);
    });

    it('should merge as a new variance with the same route', function () {
      var trace2 = TraceFactory.generateTrace('/yoloswag/swag', 3)
      trace2.spans.forEach(function (span) {
        span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime));
      })
      aggregator.mergeTrace(ROUTES['/yoloswag/swag'], trace2);
      ROUTES['/yoloswag/swag'].meta.count.should.be.equal(3);
      ROUTES['/yoloswag/swag'].variances.length.should.be.equal(2);
      ROUTES['/yoloswag/swag'].variances[0].count.should.be.equal(2);
      ROUTES['/yoloswag/swag'].variances[1].count.should.be.equal(1);
      ROUTES['/yoloswag/swag'].variances[1].spans.length.should.be.equal(4);
    });
  });
});
