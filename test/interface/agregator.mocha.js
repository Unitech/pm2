
var should    = require('should');
var Agregator = require('../../lib/Interactor/TransactionAgregator.js');
var agregator = new Agregator();
var Plan   = require('../helpers/plan.js');

describe('Transactions Agregator', function() {
  
  describe('Transform spans to tree', function() {

    var SPANS_SIMPLE = { 
      "spans": [
        {
          "name":"/auth/signin",
          "parentSpanId":"0",
          "spanId":9,
          "kind":"RPC_SERVER",
          "labels":{
            "http/method":"POST",
            "http/path":"/auth/signin",
            "express/request.route.path":"/signin",
            "http/status_code":"200"
          },
          "startTime":"2016-11-11T14:03:18.449Z",
          "endTime":"2016-11-11T14:03:18.792Z"
        },
        {  
          "name":"mysql-query",
          "parentSpanId": 9,
          "spanId": 10,
          "kind":"RPC_CLIENT",
          "labels": {  
            "sql":"SELECT * FROM users WHERE mail = ?",
            "values":"XXXXX",
            "result":"XXXX"
          },
          "startTime":"2016-11-11T14:03:18.558Z",
          "endTime":"2016-11-11T14:03:18.568Z"
        }
      ]
    }

    it('should correctly create the tree with one child', function(done) {
      agregator.convertSpanListToTree(SPANS_SIMPLE, function (tree) {
        should.exist(tree);
        tree.should.be.an.Object;
        tree.name.should.equal('/auth/signin');
        should.exist(tree.child);
        tree.child.should.be.an.Array;
        tree.child.length.should.be.exactly(1)
        should.exist(tree.child[0].name)
        tree.child[0].name.should.equal('mysql-query')
        done();
      })
    });


  });

});
