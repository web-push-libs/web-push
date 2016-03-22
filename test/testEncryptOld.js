var assert    = require('assert');
var crypto    = require('crypto');
var webPush   = require('../index');
var ece       = require('http_ece');
var urlBase64 = require('urlsafe-base64');

suite('encryptOld', function() {
  test('is defined', function() {
    assert(webPush.encryptOld);
  });

  function encryptDecrypt(thing) {
    var userCurve = crypto.createECDH('prime256v1');

    var userPublicKey = urlBase64.encode(userCurve.generateKeys());
    var userPrivateKey = userCurve.getPrivateKey();

    var encrypted = webPush.encryptOld(userPublicKey, thing);

    var sharedSecret = userCurve.computeSecret(encrypted.localPublicKey);

    ece.saveKey('webpushKey', sharedSecret);

    return ece.decrypt(encrypted.cipherText, {
      keyid: 'webpushKey',
      salt: encrypted.salt,
      padSize: 1,
    });
  }

  test('encrypt/decrypt string', function() {
    assert(encryptDecrypt('hello').equals(new Buffer('hello')));
  });

  test('encrypt/decrypt buffer', function() {
    assert(encryptDecrypt(new Buffer('hello')).equals(new Buffer('hello')));
  });
});
