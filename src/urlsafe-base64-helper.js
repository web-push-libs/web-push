'use strict';

/**
 * @param {string} base64
 * @returns {boolean}
 */
function validate(base64) {
  return /^[A-Za-z0-9\-_]+$/.test(base64);
}

module.exports = {
  validate: validate
};
