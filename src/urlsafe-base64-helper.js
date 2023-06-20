'use strict';

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
  decode: decode,
  validate: validate
};
