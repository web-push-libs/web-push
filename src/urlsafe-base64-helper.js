// Largely ported from https://github.com/RGBboy/urlsafe-base64

'use strict';

function encode(buffer) {
   return buffer.toString('base64url');
}

function decode(base64) {
  return Buffer.from(base64, 'base64url');
}

function validate(base64) {
   return /^[A-Za-z0-9\-_]+$/.test(base64);
 }

module.exports = {
   encode: encode,
   decode: decode,
   validate: validate
};
