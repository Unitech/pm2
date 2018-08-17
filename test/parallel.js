
const forEachLimit = require('async/forEachLimit')
const fs = require('fs')
const exec = require('child_process').exec
const path = require('path')
const chalk = require('chalk')
const Table = require('cli-table-redemption');

const testFolder = './test/e2e/'

const CONCURRENT_TEST = 3
const DOCKER_IMAGE_NAME = 'pm2-test'

var timings = {};

function run(cmd, cb) {
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      console.log(`Retrying ${cmd}`)
      return exec(cmd, function(err, stdout, stderr) {
        if (err) return cb(stdout.split('\n'));
        return cb(null);
      })
    }
    return cb(null)
  })
}

function buildContainer(cb) {
  exec(`docker build -t ${DOCKER_IMAGE_NAME} -f test/Dockerfile .`, cb)
}

function listAllTest(cb) {
  var test_suite = []

  fs.readdir(testFolder, (err, folders) => {
    forEachLimit(folders, 4, (folder, next) => {
      var fold = path.join(testFolder, folder)
      fs.readdir(fold, (err, files) => {
        if (err) return next()
        files.forEach((file) => {
          test_suite.push(path.join(fold, file))
        })
        next()
      })
    }, function() {
      launchTestSuite(test_suite, cb)
    })
  })
}

function launchTestSuite(files, cb) {
  forEachLimit(files, CONCURRENT_TEST, function(file, next) {
    var cmd = `docker run -v ${path.resolve(__dirname, '..')}:/var/pm2 ${DOCKER_IMAGE_NAME} bash ${file}`

    console.log(chalk.bold(`Running test ${file}`))
    timings[file] = new Date().getTime()

    run(cmd, function(err) {
      if (err) {
        // Display Error
        console.error(chalk.bold.red(`${'='.repeat(25)} Test File ${file} has failed ${'='.repeat(25)}`))
        console.error(chalk.bold('Output (stderr):'))
        err.forEach(function(line) {
          console.error(line)
        })
        console.error(chalk.bold.red(`${'='.repeat(80)}`))
        return next(err)
      }

      timings[file] = new Date().getTime() - timings[file]

      console.log(chalk.bold.green(`✓ Test ${file} success`))
      return next();
    })
  }, (err) => {
    if (err) {
      console.log('Test Suite has failed')
      cb(err)
    }
    console.log('Test Suite passed succesfully')
    cb()
  })
}

buildContainer(function(err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Container ${DOCKER_IMAGE_NAME} has been built`)

  return listAllTest(function(err) {

    var table = new Table({
      head: ['Test', 'Duration'],
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    })

    Object.keys(timings).forEach(function(test) {
      table.push([test, timings[test]])
    })

    console.log(table.toString());

    if (err) {
      return console.error(chalk.bold.red('Test suite failed'))
    }
    console.log(chalk.bold.blue('Test suite succeeded'))
  })
})
