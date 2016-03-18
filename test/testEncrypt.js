var assert    = require('assert');
var crypto    = require('crypto');
var webPush   = require('../index');
var ece       = require('http_ece');
var urlBase64 = require('urlsafe-base64');

suite('encrypt', function() {
  test('is defined', function() {
    assert(webPush.encrypt);
  });

  function encryptDecrypt(thing) {
    var userCurve = crypto.createECDH('prime256v1');

    var userPublicKey = urlBase64.encode(userCurve.generateKeys());
    var userPrivateKey = userCurve.getPrivateKey();
    var userAuth = urlBase64.encode(crypto.randomBytes(16));

    var encrypted = webPush.encrypt(userPublicKey, userAuth, thing);

    var sharedSecret = userCurve.computeSecret(encrypted.localPublicKey);

    ece.saveKey('webpushKey', userCurve, 'P-256');

    return ece.decrypt(encrypted.cipherText, {
      keyid: 'webpushKey',
      dh: urlBase64.encode(encrypted.localPublicKey),
      salt: encrypted.salt,
      authSecret: userAuth,
      padSize: 2,
    });
  }

  test('encrypt/decrypt string', function() {
    assert(encryptDecrypt('hello').equals(new Buffer('hello')));
  });

  test('encrypt/decrypt buffer', function() {
    assert(encryptDecrypt(new Buffer('hello')).equals(new Buffer('hello')));
  });
});
