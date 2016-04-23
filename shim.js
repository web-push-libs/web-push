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

var crypto = require('crypto');

if (!crypto.createECDH) {
  crypto.createECDH = require('create-ecdh');
}
