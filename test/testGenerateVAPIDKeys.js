var assert    = require('assert');
var crypto    = require('crypto');
var webPush   = require('../index');

suite('encrypt', function() {
  test('is defined', function() {
    assert(webPush.generateVAPIDKeys);
  });

  test('generate keys', function() {
    var keys = webPush.generateVAPIDKeys();
    assert(keys.privateKey);
    assert(keys.publicKey);
  });
});
