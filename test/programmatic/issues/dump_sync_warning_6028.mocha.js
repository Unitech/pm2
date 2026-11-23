var fs = require('fs')
var os = require('os')
var path = require('path')
var should = require('should')

var originalPM2Home = process.env.PM2_HOME
var pm2Home = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-6028-'))
process.env.PM2_HOME = pm2Home
fs.writeFileSync(path.join(pm2Home, 'module_conf.json'), '{}')

var cst = require('../../../constants')
cst.PM2_MODULE_CONF_FILE = path.join(pm2Home, 'module_conf.json')
cst.DUMP_FILE_PATH = path.join(pm2Home, 'dump.pm2')
var Common = require('../../../lib/Common')
var listProcesses = require('../../../lib/API/UX/pm2-ls')

var originalWarn = Common.warn
var originalLog = console.log

function makeProcess(name, id) {
  return {
    name: name,
    pid: 1000 + id,
    monit: { cpu: 0, memory: 0 },
    pm2_env: {
      pm_id: id,
      name: name,
      namespace: null,
      version: null,
      exec_mode: 'fork_mode',
      status: 'online',
      restart_time: 0,
      pm_uptime: null,
      watch: false,
      username: process.env.USER,
      pmx_module: false
    }
  }
}

function writeDump(names) {
  fs.mkdirSync(path.dirname(cst.DUMP_FILE_PATH), { recursive: true })
  fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(names.map(function(name) {
    return { name: name }
  })))
}

function removeDump() {
  try {
    fs.unlinkSync(cst.DUMP_FILE_PATH)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

function warningsFor(dumpNames, runningNames) {
  if (dumpNames === null)
    removeDump()
  else
    writeDump(dumpNames)

  var warnings = []
  Common.warn = function(message) {
    warnings.push(message)
  }
  console.log = function() {}

  listProcesses(runningNames.map(makeProcess), {})

  return warnings
}

describe('PM2 dump synchronization warnings', function() {
  afterEach(function() {
    Common.warn = originalWarn
    console.log = originalLog
  })

  after(function() {
    fs.rmSync(pm2Home, { recursive: true, force: true })
    if (originalPM2Home === undefined)
      delete process.env.PM2_HOME
    else
      process.env.PM2_HOME = originalPM2Home
  })

  it('warns when a running process is absent from the saved list', function() {
    var warnings = warningsFor(['saved'], ['running'])
    warnings.should.have.length(1)
    warnings[0].should.match(/App .*saved.* differs/)
  })

  it('warns when saved processes are absent from the running list', function() {
    var warnings = warningsFor(['saved'], [])
    warnings.should.have.length(1)
    warnings[0].should.match(/App .*saved.* differs/)
  })

  it('does not warn for matching lists', function() {
    warningsFor(['first', 'second'], ['second', 'first']).should.have.length(0)
  })

  it('compares process names with multiplicity', function() {
    warningsFor(['same', 'same'], ['same']).should.have.length(1)
    warningsFor(['same'], ['same', 'same']).should.have.length(1)
  })

  it('warns for equal-sized different duplicate-name multisets', function() {
    warningsFor(['a', 'a', 'b'], ['a', 'b', 'b']).should.have.length(1)
  })

  it('ignores modules in the running list', function() {
    var list = [makeProcess('saved', 1)]
    list.push(makeProcess('module', 2))
    list[1].pm2_env.pmx_module = true
    list[1].pm2_env.axm_options = { pid: 1002 }

    var warnings = []
    writeDump(['saved'])
    Common.warn = function(message) {
      warnings.push(message)
    }
    console.log = function() {}

    listProcesses(list, {})

    warnings.should.have.length(0)
  })

  it('handles empty and missing dump files', function() {
    warningsFor([], []).should.have.length(0)
    warningsFor(null, []).should.have.length(0)
    warningsFor([], ['running']).should.have.length(1)
  })
})
