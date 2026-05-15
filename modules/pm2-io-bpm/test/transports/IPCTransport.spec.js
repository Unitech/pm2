'use strict'

/**
 * Regression tests for commit ebd629ef ("Silence cluster worker events to
 * prevent boot crashes").
 *
 * That commit rewrote IPCTransport.send() so that every broken-channel
 * failure path is silently swallowed:
 *
 *   - process.connected === false  -> `return -1`          (was: console.error + exit)
 *   - process.send(msg, cb) async  -> debug logger only     (was: synchronous send)
 *   - process.send() throws        -> debug logger only     (was: re-thrown / exit)
 *
 * Result: when the IPC pipe to the PM2 daemon breaks, BPM keeps emitting
 * metrics into the void with zero observable signal. This is the mechanism
 * that aggravates the unbounded-memory growth (#6101) and masks the EBADF
 * channel fault into a confusing silent symptom (#6111).
 *
 * Contract under test: IPCTransport is an EventEmitter. A send failure on a
 * broken channel MUST be surfaced to observers via an 'error' event — not
 * swallowed, and not by killing the whole process (process.exit was itself
 * the boot-crash the commit tried to fix). These tests are expected to FAIL
 * against the current implementation (TDD).
 */

const assert = require('assert')
const { IPCTransport } = require('../../transports/IPCTransport')
const { IPC_MAX_INFLIGHT } = require('../../constants')

describe('IPCTransport — broken channel must surface, not swallow (regression #6101/#6111)', function () {
  let originalSend
  let connectedDescriptor

  beforeEach(() => {
    originalSend = process.send
    connectedDescriptor = Object.getOwnPropertyDescriptor(process, 'connected')
  })

  afterEach(() => {
    process.send = originalSend
    if (connectedDescriptor) {
      Object.defineProperty(process, 'connected', connectedDescriptor)
    } else {
      delete process.connected
    }
  })

  const stubConnected = (value) => {
    Object.defineProperty(process, 'connected', {
      value,
      configurable: true,
      writable: true
    })
  }

  it('emits an "error" event when the async process.send callback fails', function () {
    stubConnected(true)
    // Synchronous callback so the test owns no async work past its lifetime.
    process.send = function (_msg, cb) {
      cb(new Error('channel closed (EPIPE)'))
    }

    const transport = new IPCTransport()
    let surfaced = null
    transport.on('error', (err) => { surfaced = err })

    transport.send('axm:monitor', { cpu: 1 })

    // Current code only calls this.logger(...) in the callback — no 'error'
    // event is ever emitted, so `surfaced` stays null and this fails.
    assert.ok(surfaced instanceof Error,
      'async send failure must be surfaced via an "error" event, not swallowed')
  })

  it('emits an "error" event when the channel is disconnected instead of silently dropping', function () {
    stubConnected(false)
    process.send = function () { /* present but channel is dead */ }

    const transport = new IPCTransport()
    let surfaced = null
    transport.on('error', (err) => { surfaced = err })

    transport.send('axm:monitor', { cpu: 1 })

    // The contract is observability — a disconnected channel must surface an
    // 'error' event. The -1 return value is an intentionally retained sentinel
    // (callers like setOptions() depend on it); it is not asserted here.
    assert.ok(surfaced instanceof Error,
      'disconnected channel must be observable via an "error" event')
  })

  it('emits an "error" event when process.send throws synchronously', function () {
    stubConnected(true)
    process.send = function () {
      throw new Error('Channel closed')
    }

    const transport = new IPCTransport()
    let surfaced = null
    transport.on('error', (err) => { surfaced = err })

    transport.send('axm:monitor', { cpu: 1 })

    // Current code swallows the throw into this.logger(...) only.
    assert.ok(surfaced instanceof Error,
      'thrown send error must be surfaced via an "error" event, not swallowed')
  })

  it('bounds in-flight sends under back-pressure instead of growing unbounded (#6101)', function () {
    stubConnected(true)
    let sendCalls = 0
    // Saturated-but-connected pipe: process.send accepts the message but the
    // ack callback never fires (libuv write buffer full). The retained
    // callbacks must NOT accumulate without bound.
    process.send = function () { sendCalls++ }

    const transport = new IPCTransport()
    const surfaced = []
    transport.on('error', (err) => { surfaced.push(err) })

    const attempts = IPC_MAX_INFLIGHT + 5
    for (let i = 0; i < attempts; i++) {
      transport.send('axm:monitor', { i })
    }

    assert.strictEqual(sendCalls, IPC_MAX_INFLIGHT,
      `at most ${IPC_MAX_INFLIGHT} messages may be in flight; excess must be dropped, not queued`)
    assert.strictEqual(transport._inflight, IPC_MAX_INFLIGHT,
      'in-flight counter must be capped at IPC_MAX_INFLIGHT')
    assert.strictEqual(transport._dropped, attempts - IPC_MAX_INFLIGHT,
      'every over-cap message must be counted as dropped')
    assert.strictEqual(surfaced.length, 1,
      'back-pressure must be surfaced exactly once (edge-triggered), not per dropped message')
    assert.ok(surfaced[0] instanceof Error,
      'back-pressure must be surfaced as an Error')
  })
})
