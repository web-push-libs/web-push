// Largely ported from https://github.com/RGBboy/urlsafe-base64

'use strict';

function encode(buffer) {
   return buffer.toString('base64')
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, ''); // Remove ending '='
}

function decode(base64) {
   // Add removed at end '='
  base64 += Array(5 - (base64.length % 4)).join('=');

  base64 = base64
    .replace(/-/g, '+') // Convert '-' to '+'
    .replace(/_/g, '/'); // Convert '_' to '/'

  // change from urlsafe-base64 since new Buffer() is deprecated
  return Buffer.from(base64, 'base64');
}

function validate(base64) {
   return /^[A-Za-z0-9\-_]+$/.test(base64);
 }

module.exports = {
   encode: encode,
   decode: decode,
   validate: validate
};
