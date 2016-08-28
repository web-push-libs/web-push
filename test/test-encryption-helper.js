'use strict';

const assert = require('assert');
const crypto = require('crypto');
const webPush = require('../src/index');
const ece = require('http_ece');
const urlBase64 = require('urlsafe-base64');

const userCurve = crypto.createECDH('prime256v1');
const VALID_PUBLIC_KEY = urlBase64.encode(userCurve.generateKeys());
const VALID_AUTH = urlBase64.encode(crypto.randomBytes(16));

suite('Test Encryption Helpers', function() {
  test('is defined', function() {
    assert(webPush.encrypt);
  });

  function encryptDecrypt(thing) {
    const encrypted = webPush.encrypt(VALID_PUBLIC_KEY, VALID_AUTH, thing);

    ece.saveKey('webpushKey', userCurve, 'P-256');

    return ece.decrypt(encrypted.cipherText, {
      keyid: 'webpushKey',
      dh: urlBase64.encode(encrypted.localPublicKey),
      salt: encrypted.salt,
      authSecret: VALID_AUTH,
      padSize: 2
    });
  }

  test('encrypt/decrypt string', function() {
    assert(encryptDecrypt('hello').equals(new Buffer('hello')));
  });

  test('encrypt/decrypt buffer', function() {
    assert(encryptDecrypt(new Buffer('hello')).equals(new Buffer('hello')));
  });

  test('bad input to encrypt', function() {
    // userPublicKey, userAuth, payload
    const badInputs = [
      function() {
        webPush.encrypt();
      },
      function() {
        // Invalid public key
        webPush.encrypt(null, VALID_AUTH, 'Example');
      },
      function() {
        // Invalid auth
        webPush.encrypt(VALID_PUBLIC_KEY, null, 'Example');
      },
      function() {
        // No payload
        webPush.encrypt(VALID_PUBLIC_KEY, VALID_AUTH, null);
      },
      function() {
        // Invalid auth size
        webPush.encrypt(VALID_PUBLIC_KEY, 'Fake', 'Example');
      }
    ];

    badInputs.forEach(function(badInput, index) {
      assert.throws(function() {
        badInput();
        console.log('Encryption input failed to throw: ' + index);
      });
    });
  });
});
