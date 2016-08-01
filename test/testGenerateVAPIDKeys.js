'use strict';

const assert = require('assert');
const webPush = require('../src/index');

suite('encrypt', function() {
  test('is defined', function() {
    assert(webPush.generateVAPIDKeys);
  });

  test('generate keys', function() {
    const keys = webPush.generateVAPIDKeys();
    assert(keys.privateKey);
    assert(keys.publicKey);
  });
});
