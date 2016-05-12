'use strict';
var async = require('async');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var should = require('should');

var dumpDebugOutput = process.env.DEBUG_VERBOSE;


describe('Multiple Instance:', function () {

  var instance1 = new PM2Runner('pm2_home1');
  var instance2 = new PM2Runner('pm2_home2');
  var defaultProcess = path.resolve(__dirname, '../fixtures/echo.js');

  after(function (done) {
    // Kill any running instances
    instance1.kill();
    instance2.kill();
    // Cleanup any folders
    cleanupInstanceFiles(instance1, instance2, done);
  });

  describe('Given two instances of PM2 which are each managing one unique process', function () {
    var instance1List;
    var instance2List;

    before(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();

      // Start a task on each instance
      instance1.startProcess(defaultProcess, 'test1');
      instance2.startProcess(defaultProcess, 'test2');

      // Get a list of tasks
      instance1List = JSON.parse(instance1.jlist().stdout);
      instance2List = JSON.parse(instance2.jlist().stdout);
    });

    after(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();
    });


    it('Then two instances of PM2 should be running', function () {
      should(instance1List.length).equal(1);
      should(instance1List[0].name).equal('test1');
      should(instance2List.length).equal(1);
      should(instance2List[0].name).equal('test2');
    });
  });

  describe('Given two instances of PM2 which are each managing two unique processes', function () {
    //var instance1 = new PM2Runner('pm2_home3');
    //var instance2 = new PM2Runner('pm2_home4');
    var instance1List;
    var instance2List;

    before(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();

      // Start a prccess on each instance
      instance1.startProcess(defaultProcess, 'test1');
      instance2.startProcess(defaultProcess, 'test2');
      instance2.startProcess(defaultProcess, 'test3');
      instance1.startProcess(defaultProcess, 'test4');
    });

    after(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();
    });


    describe('When one process is deleted from the first PM2 instance', function () {

      before(function () {
        instance1.deleteProcess('test1');

        // Get a list of processes
        instance1List = JSON.parse(instance1.jlist().stdout);
        instance2List = JSON.parse(instance2.jlist().stdout);
      });


      it('Then first PM2 instance should have only one process while the second PM2 instance still has two processes', function () {
        should(instance1List.length).equal(1);
        should(instance1List[0].name).equal('test4');
        should(instance2List.length).equal(2);
        should(instance2List[0].name).equal('test2');
        should(instance2List[1].name).equal('test3');
      });
    });
  });

  describe('Given two instances of PM2 which are each managing one unique process', function () {
    //var instance1 = new PM2Runner('pm2_home5');
    //var instance2 = new PM2Runner('pm2_home6');
    var instance1List;
    var instance2List;

    before(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();

      // Start a process on each instance
      instance1.startProcess(defaultProcess, 'test1');
      instance2.startProcess(defaultProcess, 'test2');
    });

    after(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();
    });

    describe('When a process is added to the first PM2 instance', function () {

      before(function () {
        instance1.startProcess(defaultProcess, 'test3');
        // Get a list of tasks
        instance1List = JSON.parse(instance1.jlist().stdout);
        instance2List = JSON.parse(instance2.jlist().stdout);
      });

      it('Then the first instance should have two processes and the second instance should have one process', function () {
        should(instance1List.length).equal(2);
        should(instance1List[0].name).equal('test1');
        should(instance1List[1].name).equal('test3');
        should(instance2List.length).equal(1);
        should(instance2List[0].name).equal('test2');
      });
    });
  });


  describe('Given two instances of PM2 which are each managing one unique process', function () {
    //var instance1 = new PM2Runner('pm2_home7');
    //var instance2 = new PM2Runner('pm2_home8');
    var instanceOutput;
    var instance2List;

    before(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();

      // Start a process on each instance
      instance1.startProcess(defaultProcess, 'test1');
      instance2.startProcess(defaultProcess, 'test2');
    });

    after(function () {
      // Kill any running instances
      instance1.kill();
      instance2.kill();
    });

    describe('When the first PM2 instance is killed', function () {

      before(function () {
        // Get a list of tasks
        instanceOutput = instance1.kill().stdout;
        instance2List = JSON.parse(instance2.jlist().stdout);
      });

      it('Then the first PM2 instance should be stopped while the second PM2 instance should still be running and managing its process', function () {
        var pm2Stopped = instanceOutput.match(/stopped/g);
        should(pm2Stopped.length).above(0);  // linux has final line with PM2 stopped, windows does not
        should(instance2List.length).equal(1);
        should(instance2List[0].name).equal('test2');
      });
    });
  });
});


function PM2Runner(pm2Home, pm2Path) {
  this.pm2Home = pm2Home;
  if (pm2Path) {
    this.pm2Path = pm2Path;
  }
  else {
    this.pm2Path = path.resolve(__dirname, '../../bin/pm2');
  }
}

PM2Runner.prototype.startProcess = function (app, name) {
  var args = [];
  args.push('start');
  args.push(process.execPath); // Run node as the process, nodist on test machine cause the test to keep restart
  args.push('--name');
  args.push(name);
  args.push('-f');  // Force start
  args.push('--');
  args.push(app);

  return this.spawnPm2(args);

}

PM2Runner.prototype.deleteProcess = function (name) {
  var args = [];
  args.push('delete');
  args.push(name);
  return this.spawnPm2(args);

}

PM2Runner.prototype.kill = function () {
  var args = [];
  args.push('kill');
  return this.spawnPm2(args);
}

PM2Runner.prototype.jlist = function () {
  var args = [];
  args.push('jlist');
  return this.spawnPm2(args);
}

PM2Runner.prototype.list = function () {
  var args = [];
  args.push('list');
  return this.spawnPm2(args);
}



PM2Runner.prototype.getPM2Home = function () {
  return this.pm2Home;
}


PM2Runner.prototype.spawnPm2 = function (args) {
  // Setup the arguments

  var commandLine = [this.pm2Path];

  commandLine = commandLine.concat(args);

  // Copy the env
  var envVars = {};
  var key;
  for (key in process.env) {
    envVars[key] = process.env[key];
  }
  envVars['PM2_HOME'] = this.pm2Home;

  // Run the command
  var output = child_process.spawnSync(process.execPath, commandLine, {env: envVars});

  if ( dumpDebugOutput ) {
    console.log('Exe:' + process.execPath);
    console.log('Command:' + JSON.stringify(commandLine));
    console.log('Pm2 Env:' + JSON.stringify(envVars.PM2_HOME));
    console.log('StdOut:')
    console.log(output.stdout.toString());
    console.log('StdErr:')
    console.log(output.stderr.toString());
    console.log('Exit Status:' + output.status.toString());
  }


  return {
    stdout: output.stdout.toString(),
    stderr: output.stderr.toString(),
    status: output.status,
    signal: output.signal,
    error: output.error
  };
}


var deleteFolderRecursive = function (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

function cleanupInstanceFiles(instance1, instance2, callback)
{
  if ( !dumpDebugOutput )
  {
    setTimeout(function() {
      deleteFolderRecursive(instance1.getPM2Home());
      deleteFolderRecursive(instance2.getPM2Home());
      callback(null);
    }, 1000);
  }
  else
  {
    callback(null);
  }
}
