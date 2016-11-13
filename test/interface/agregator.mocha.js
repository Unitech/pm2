
var should    = require('should');
var Aggregator = require('../../lib/Interactor/TransactionAgregator.js');
var Plan   = require('../helpers/plan.js');
var TraceFactory = require('./misc/trace_factory.js');

describe('Transactions Agregator', function() {
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

  describe('Transform spans to tree', function() {
    it('should correctly create the tree with one child', function(done) {
      aggregator.convertSpanListToTree(TraceFactory.staticTrace, function (tree) {
        should.exist(tree);
        tree.should.be.an.Object();
        tree.name.should.equal('/auth/signin');
        should.exist(tree.child);
        tree.child.should.be.an.Array();
        tree.child.length.should.be.exactly(1)
        should.exist(tree.child[0].name)
        tree.child[0].name.should.equal('mysql-query')
        done();
      })
    });
  });
});
