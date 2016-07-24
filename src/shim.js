'use strict';

/* eslint global-require:0 */

if (typeof Promise === 'undefined') {
  global.Promise = require('bluebird');
}

if (!Array.prototype.find) {
  require('array.prototype.find').shim();
}

if (!Buffer.prototype.compare || !Buffer.compare) {
  require('buffer-compare-shim');
}

if (!Buffer.prototype.equals) {
  require('buffer-equals-polyfill');
}

const crypto = require('crypto');
if (!crypto.createECDH) {
  crypto.createECDH = require('create-ecdh');
}
