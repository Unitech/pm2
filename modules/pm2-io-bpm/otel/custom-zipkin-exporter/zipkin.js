/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { diag } = require('@opentelemetry/api')
const { ExportResultCode } = require('@opentelemetry/core')
const { prepareSend } = require('./platform/index')
const zipkinTypes = require('./types')
const {
  toZipkinSpan,
  defaultStatusCodeTagName,
  defaultStatusErrorTagName,
} = require('./transform')
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions')
const { prepareGetHeaders } = require('./utils')
const { ServiceManager } = require('../../serviceManager')

/**
 * Zipkin Exporter
 */
class CustomZipkinExporter {
  constructor (config = {}) {
    this.DEFAULT_SERVICE_NAME = 'OpenTelemetry Service'
    this._urlStr = config.url || process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT || 'http://localhost:9411/api/v2/spans'
    this.transport = ServiceManager.get('transport')
    this._send = prepareSend(this.transport, config.headers)
    this._serviceName = config.serviceName
    this._statusCodeTagName =
      config.statusCodeTagName || defaultStatusCodeTagName
    this._statusDescriptionTagName =
      config.statusDescriptionTagName || defaultStatusErrorTagName
    this._isShutdown = false
    this._sendingPromises = []
    if (typeof config.getExportRequestHeaders === 'function') {
      this._getHeaders = prepareGetHeaders(config.getExportRequestHeaders)
    } else {
      // noop
      this._beforeSend = function () {}
    }
  }

  /**
   * Export spans.
   */
  export (spans, resultCallback) {
    if (spans.length === 0) {
      return resultCallback({ code: ExportResultCode.SUCCESS })
    }
    const serviceName = String(
      this._serviceName ||
        spans[0].resource.attributes[ATTR_SERVICE_NAME] ||
        this.DEFAULT_SERVICE_NAME
    )

    diag.debug('Zipkin exporter export')
    if (this._isShutdown) {
      setTimeout(() =>
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error('Exporter has been shutdown'),
        }), 0
      )
      return
    }
    const promise = new Promise(resolve => {
      this._sendSpans(spans, serviceName, result => {
        resolve()
        resultCallback(result)
      })
    })

    this._sendingPromises.push(promise)
    const popPromise = () => {
      const index = this._sendingPromises.indexOf(promise)
      this._sendingPromises.splice(index, 1)
    }
    promise.then(popPromise, popPromise)
  }

  /**
   * Shutdown exporter. Noop operation in this exporter.
   */
  shutdown () {
    diag.debug('Zipkin exporter shutdown')
    this._isShutdown = true
    return this.forceFlush()
  }

  /**
   * Exports any pending spans in exporter
   */
  forceFlush () {
    return new Promise((resolve, reject) => {
      Promise.all(this._sendingPromises).then(() => {
        resolve()
      }, reject)
    })
  }

  /**
   * if user defines getExportRequestHeaders in config then this will be called
   * every time before send, otherwise it will be replaced with noop in
   * constructor
   * @default noop
   */
  _beforeSend () {
    if (this._getHeaders) {
      this._send = prepareSend(this.transport, this._getHeaders())
    }
  }

  /**
   * Transform spans and sends to Zipkin service.
   */
  _sendSpans (spans, serviceName, done) {
    const zipkinSpans = spans.map(span =>
      toZipkinSpan(
        span,
        String(
          span.attributes[ATTR_SERVICE_NAME] ||
            span.resource.attributes[ATTR_SERVICE_NAME] ||
            serviceName
        ),
        this._statusCodeTagName,
        this._statusDescriptionTagName
      )
    )
    this._beforeSend()
    return this._send(zipkinSpans, (result) => {
      if (done) {
        return done(result)
      }
    })
  }
}

module.exports = { CustomZipkinExporter }
