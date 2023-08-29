'use strict';

const assert = require('assert');
const { setGCMAPIKey } = require('../src/index');

suite('setGCMAPIKey', function() {
  test('is defined', function() {
    assert(setGCMAPIKey);
  });

  test('non-empty string', function() {
    assert.doesNotThrow(function() {
      setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');
    });
  });

  test('reset GCM API Key with null', function() {
    assert.doesNotThrow(function() {
      setGCMAPIKey(null);
    });
  });

  test('empty string', function() {
    assert.throws(function() {
      setGCMAPIKey('');
    }, Error);
  });

  test('non string', function() {
    assert.throws(function() {
      setGCMAPIKey(42);
    }, Error);
  });

  test('undefined value', function() {
    assert.throws(function() {
      setGCMAPIKey();
    }, Error);
  });
});
