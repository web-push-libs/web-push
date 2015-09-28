const urlBase64 = require('urlsafe-base64');
const crypto    = require('crypto');
const ece       = require('encrypted-content-encoding');

function encrypt(userPublicKey, payload) {
  var localCurve = crypto.createECDH('prime256v1');

  var localPublicKey = localCurve.generateKeys();
  var localPrivateKey = localCurve.getPrivateKey();

  var sharedSecret = localCurve.computeSecret(userPublicKey);

  var salt = crypto.randomBytes(16);

  ece.saveKey("webpushKey", sharedSecret);

  var cipherText = ece.encrypt(payload, {
    keyid: "webpushKey",
    salt: urlBase64.encode(salt),
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText,
  };
}

module.exports = {
  encrypt: encrypt,
}
