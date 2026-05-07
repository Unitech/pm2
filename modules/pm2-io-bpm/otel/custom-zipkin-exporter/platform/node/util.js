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
const { Constants } = require('../../../constants')

/**
 * Prepares send function that will send spans to the remote Zipkin service.
 * @param transport - transport instance
 * @param headers - headers
 * send
 */
function prepareSend (transport, headers) {
  /**
   * Send spans to the remote Zipkin service.
   */
  return function send (zipkinSpans, done) {
    if (zipkinSpans.length === 0) {
      diag.debug('Zipkin send with empty spans')
      return done({ code: ExportResultCode.SUCCESS })
    }

    zipkinSpans.forEach(span => {
      const isRootClient = span.kind === 'CLIENT' && !span.parentId
      if (isRootClient) return

      /* CUSTOM - DROP USELESS TRACE */
      if ((span.duration > Constants.MINIMUM_TRACE_DURATION)) {
        transport.send('trace-span', span)
      }
    })

    return done({ code: ExportResultCode.SUCCESS })
  }
}

module.exports = { prepareSend }
