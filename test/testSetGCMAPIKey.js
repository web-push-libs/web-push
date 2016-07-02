var assert    = require('assert');
var webPush   = require('../index');

suite('setGCMAPIKey', function() {
  test('is defined', function() {
    assert(webPush.setGCMAPIKey);
  });

  test('non-empty string', function() {
    assert.doesNotThrow(function() { webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo') });
  });

  test('empty string', function() {
    assert.throws(function() { webPush.setGCMAPIKey('') }, Error);
  });

  test('non string', function() {
    assert.throws(function() { webPush.setGCMAPIKey(42) }, Error);
  });
});
