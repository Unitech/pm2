/*
 * https://github.com/hugorodrigues/questions/blob/master/questions.js
 */

module.exports = function (){

  var obj = {};

  obj.askMany = function (questions, callback) {

    var response = {};

    var pool = function(){

      for (i in questions)
      {
        obj.askOne( questions[i], function(data){
          response[i] = data
          delete questions[i]
          pool()
        });

        return;
      }

      callback(response);
    }

    pool();
  }

  obj.askOne = function (question, callback) {
    var stdin = process.stdin,
        stdout = process.stdout;

    stdin.resume();
    stdout.write(question.info + ": ");

    stdin.once('data', function(data) {
      result = data.toString().trim();

      if (question.required != false && result == '') {
        // Ask again
        obj.askOne(question, callback);
      } else {
        // Return result
        stdin.pause();
        callback(result);
      }
    })
  }

  obj.post = function(url, data, cb) {
    var http = require('http');

    var dt = JSON.stringify(data);

    var options = {
      host: url,
      path: '/new',
      port: 3000,
      method: 'POST',
      headers : {
        'Content-Length': dt.length,
        'Content-Type': 'application/json'
      }
    };

    var req = http.request(options, function(res) {
      res.setEncoding('utf8');

      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write(dt, 'utf8');
    req.end();

  };

  return obj;
}()
