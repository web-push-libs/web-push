var semver = require('semver');
if (semver.satisfies(process.version, '>= 0.12.0')) {
  return;
}

global.Promise = require('bluebird');
require('array.prototype.find').shim();
require('buffer-compare-shim');
require('buffer-equals-polyfill');
require('crypto').createECDH = require('create-ecdh');
