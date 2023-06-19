// Largely ported from https://github.com/RGBboy/urlsafe-base64

'use strict';

/**
 * @param {Buffer} buffer
 * @returns {string}
 */
function encode(buffer) {
   return buffer.toString('base64url');
}

/**
 * @param {string} base64
 * @returns {Buffer}
 */
function decode(base64) {
   return Buffer.from(base64, 'base64url');
}

/**
 * @param {string} base64
 * @returns {boolean}
 */
function validate(base64) {
   return /^[A-Za-z0-9\-_]+$/.test(base64);
}

module.exports = {
   encode: encode,
   decode: decode,
   validate: validate
};
