var assert    = require('assert');
var crypto    = require('crypto');
var webPush   = require('../../index');
var ece       = require('http_ece');
var urlBase64 = require('urlsafe-base64');

suite('setGCMAPIKey', function() {
  test('is defined', function() {
    assert(webPush.setGCMAPIKey);
  });

  test('call', function() {
    webPush.setGCMAPIKey('hello');
  })
});
