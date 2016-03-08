var assert    = require('assert');
var webPush   = require('../index');

suite('setGCMAPIKey', function() {
  test('is defined', function() {
    assert(webPush.setGCMAPIKey);
  });

  test('call', function() {
    webPush.setGCMAPIKey('hello');
  })
});
