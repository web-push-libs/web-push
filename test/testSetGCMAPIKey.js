'use strict';

const assert = require('assert');
const webPush = require('../src/index');

suite('setGCMAPIKey', function() {
  test('is defined', function() {
    assert(webPush.setGCMAPIKey);
  });

  test('non-empty string', function() {
    assert.doesNotThrow(function() {
      webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');
    });
  });

  test('reset GCM API Key with null', function() {
    assert.doesNotThrow(function() {
      webPush.setGCMAPIKey(null);
    });
  });

  test('empty string', function() {
    assert.throws(function() {
      webPush.setGCMAPIKey('');
    }, Error);
  });

  test('non string', function() {
    assert.throws(function() {
      webPush.setGCMAPIKey(42);
    }, Error);
  });

  test('undefined value', function() {
    assert.throws(function() {
      webPush.setGCMAPIKey();
    }, Error);
  });
});
