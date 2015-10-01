const urlBase64 = require('urlsafe-base64');
const crypto    = require('crypto');
const ece       = require('encrypted-content-encoding');
const url       = require('url');
const https     = require('https');

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

function sendNotification(endpoint, userPublicKey, payload) {
  var urlParts = url.parse(endpoint);
  var options = {
    hostname: urlParts.hostname,
    port: urlParts.port,
    path: urlParts.pathname,
    method: 'POST',
    headers: {
      'Content-Length': 0,
    }
  };

  var encrypted;
  if (typeof payload !== 'undefined') {
    encrypted = encrypt(urlBase64.decode(userPublicKey), payload);
    options.headers = {
      'Content-Length': encrypted.cipherText.length,
      'Content-Type': 'application/octet-stream',
      'Encryption-Key': 'keyid=p256dh;dh=' + urlBase64.encode(encrypted.localPublicKey),
      'Encryption': 'keyid=p256dh;salt=' + urlBase64.encode(encrypted.salt),
      'Content-Encoding': 'aesgcm128',
    };
  }

  var pushRequest = https.request(options, function(pushResponse) {
    if (pushResponse.statusCode !== 201) {
      console.log("statusCode: ", pushResponse.statusCode);
      console.log("headers: ", pushResponse.headers);
    }
  });

  if (typeof payload !== 'undefined') {
    pushRequest.write(encrypted.cipherText);
  }
  pushRequest.end();

  pushRequest.on('error', function(e) {
    console.error(e);
  });
}

module.exports = {
  encrypt: encrypt,
  sendNotification: sendNotification,
}
