'use strict';

const assert = require('assert');
const crypto = require('crypto');
const webPush = require('../src/index');
const ece = require('http_ece');
const urlBase64 = require('urlsafe-base64');

suite('encrypt', function() {
  test('is defined', function() {
    assert(webPush.encrypt);
  });

  function encryptDecrypt(thing) {
    const userCurve = crypto.createECDH('prime256v1');

    const userPublicKey = urlBase64.encode(userCurve.generateKeys());
    const userAuth = urlBase64.encode(crypto.randomBytes(16));

    const encrypted = webPush.encrypt(userPublicKey, userAuth, thing);

    ece.saveKey('webpushKey', userCurve, 'P-256');

    return ece.decrypt(encrypted.cipherText, {
      keyid: 'webpushKey',
      dh: urlBase64.encode(encrypted.localPublicKey),
      salt: encrypted.salt,
      authSecret: userAuth,
      padSize: 2
    });
  }

  test('encrypt/decrypt string', function() {
    assert(encryptDecrypt('hello').equals(new Buffer('hello')));
  });

  test('encrypt/decrypt buffer', function() {
    assert(encryptDecrypt(new Buffer('hello')).equals(new Buffer('hello')));
  });
});
