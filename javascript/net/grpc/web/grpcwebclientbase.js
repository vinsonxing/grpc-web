/**
 *
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
/**
 * @fileoverview gRPC browser client library.
 *
 * Base class for gRPC Web JS clients using the application/grpc-web wire
 * format
 *
 * @author stanleycheung@google.com (Stanley Cheung)
 */
goog.module('grpc.web.GrpcWebClientBase');

goog.module.declareLegacyNamespace();


const AbstractClientBase = goog.require('grpc.web.AbstractClientBase');
const GrpcWebClientReadableStream = goog.require('grpc.web.GrpcWebClientReadableStream');
const HttpCors = goog.require('goog.net.rpc.HttpCors');
const StatusCode = goog.require('grpc.web.StatusCode');
const XhrIo = goog.require('goog.net.XhrIo');
const googCrypt = goog.require('goog.crypt.base64');


/**
 * Base class for gRPC web client using the application/grpc-web wire format
 * @param {?Object=} opt_options
 * @constructor
 * @implements {AbstractClientBase}
 */
const GrpcWebClientBase = function(opt_options) {
  /**
   * @const
   * @private {boolean}
   */
  this.suppressCorsPreflight_ =
    goog.getObjectByName('suppressCorsPreflight', opt_options) || false;
};


/**
 * @override
 */
GrpcWebClientBase.prototype.rpcCall = function(
    method, request, metadata, methodInfo, callback) {
  var xhr = this.newXhr_();
  var serialized = methodInfo.requestSerializeFn(request);
  xhr.headers.addAll(metadata);

  var genericTransportInterface = {
    xhr: xhr,
  };
  var stream = new GrpcWebClientReadableStream(genericTransportInterface);
  stream.setResponseDeserializeFn(methodInfo.responseDeserializeFn);

  stream.on('data', function(response) {
    callback(null, response);
  });

  stream.on('status', function(status) {
    if (status.code != StatusCode.OK) {
      callback({
        code: status.code,
        message: status.details
      }, null);
    }
  });

  stream.on('error', function(error) {
    if (error.code != StatusCode.OK) {
      callback({
        code: error.code,
        message: error.message
      });
    }
  });

  xhr.headers.set('Content-Type', 'application/grpc-web-text');
  xhr.headers.set('X-User-Agent', 'grpc-web-javascript/0.1');
  xhr.headers.set('Accept', 'application/grpc-web-text');

  var payload = this.encodeRequest_(serialized);
  payload = googCrypt.encodeByteArray(payload);

  if (this.suppressCorsPreflight_) {
    var headerObject = xhr.headers.toObject();
    xhr.headers.clear();
    method = GrpcWebClientBase.setCorsOverride_(method, headerObject);
  }
  xhr.send(method, 'POST', payload);
  return;
};


/**
 * @override
 */
GrpcWebClientBase.prototype.serverStreaming = function(
    method, request, metadata, methodInfo) {
  var xhr = this.newXhr_();
  var serialized = methodInfo.requestSerializeFn(request);
  xhr.headers.addAll(metadata);

  var genericTransportInterface = {
    xhr: xhr,
  };
  var stream = new GrpcWebClientReadableStream(genericTransportInterface);
  stream.setResponseDeserializeFn(methodInfo.responseDeserializeFn);

  xhr.headers.set('Content-Type', 'application/grpc-web-text');
  xhr.headers.set('X-User-Agent', 'grpc-web-javascript/0.1');
  xhr.headers.set('Accept', 'application/grpc-web-text');

  var payload = this.encodeRequest_(serialized);
  payload = googCrypt.encodeByteArray(payload);

  if (this.suppressCorsPreflight_) {
    var headerObject = xhr.headers.toObject();
    xhr.headers.clear();
    method = GrpcWebClientBase.setCorsOverride_(method, headerObject);
  }
  xhr.send(method, 'POST', payload);

  return stream;
};


/**
 * Create a new XhrIo object
 *
 * @private
 * @return {!XhrIo} The created XhrIo object
 */
GrpcWebClientBase.prototype.newXhr_ = function() {
  return new XhrIo();
};



/**
 * Encode the grpc-web request
 *
 * @private
 * @param {!Uint8Array} serialized The serialized proto payload
 * @return {!Uint8Array} The application/grpc-web padded request
 */
GrpcWebClientBase.prototype.encodeRequest_ = function(serialized) {
  var len = serialized.length;
  var bytesArray = [0, 0, 0, 0];
  var payload = new Uint8Array(5 + len);
  for (var i = 3; i >= 0; i--) {
    bytesArray[i] = (len % 256);
    len = len >>> 8;
  }
  payload.set(new Uint8Array(bytesArray), 1);
  payload.set(serialized, 5);
  return payload;
};



/**
 * @private
 * @static
 * @param {string} method The method to invoke
 * @param {!Object<string,string>} headerObject The xhr headers
 * @return {string} The URI object or a string path with headers
 */
GrpcWebClientBase.setCorsOverride_ = function(method, headerObject) {
  return /** @type {string} */  (HttpCors.setHttpHeadersWithOverwriteParam(
    method, HttpCors.HTTP_HEADERS_PARAM_NAME, headerObject));
};


exports = GrpcWebClientBase;
