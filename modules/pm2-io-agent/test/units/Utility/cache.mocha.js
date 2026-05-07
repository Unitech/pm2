/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const Utility = require('../../../src/Utility')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

describe('Cache Utility', function () {
  let cache

  it('should instanciate context cache', function () {
    cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key))
          return content.toString().split(/\r?\n/)
        } catch (err) {
          return null
        }
      }
    })
  })

  it('should get null without key', function () {
    assert(cache.get() === null)
  })

  it('should get null with unknow value', function () {
    assert(cache.get('toto') === null)
  })

  it('should get null', function () {
    assert(cache.get() === null)
  })

  it('should set null', function () {
    assert(cache.set() === false)
  })

  it('should not set key without value', function () {
    assert(cache.set('toto') === false)
  })

  it('should set value', function () {
    assert(cache.set('toto', 'val') === true)
  })

  it('should get value', function () {
    assert(cache.get('toto') === 'val')
  })

  it('should reset', function () {
    cache.reset()
  })

  it('should get null with unknow value', function () {
    assert(cache.get('toto') === null)
  })

  it('should instanciate context cache with ttl', function () {
    cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key))
          return content.toString().split(/\r?\n/)
        } catch (err) {
          return null
        }
      },
      ttl: 1
    })
  })

  it('should add a key', function () {
    assert(cache.set('toto', 'yeslife') === true)
  })

  it('should wait one second to see the key disapear', function (done) {
    setTimeout(function () {
      assert(cache.get('toto') === null)
      done()
    }, 3000)
  })

  after(done => {
    clearInterval(cache._worker)
    done()
  })
})
