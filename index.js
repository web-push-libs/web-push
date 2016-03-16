const urlBase64 = require('urlsafe-base64');
const crypto    = require('crypto');
const ece       = require('http_ece');
const url       = require('url');
const https     = require('https');
const colors    = require('colors');
const asn1      = require('asn1.js');
const jws       = require('jws');

var ECPrivateKeyASN = asn1.define('ECPrivateKey', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('privateKey').octstr(),
    this.key('parameters').explicit(0).objid().optional(),
    this.key('publicKey').explicit(1).bitstr().optional()
  )
});

function toPEM(key) {
  return ECPrivateKeyASN.encode({
    version: 1,
    privateKey: key,
    parameters: [1, 2, 840, 10045, 3, 1, 7], // prime256v1
  }, 'pem', {
    label: 'EC PRIVATE KEY',
  });
}

function generateVAPIDKeys() {
  var curve = crypto.createECDH('prime256v1');
  curve.generateKeys();

  return {
    publicKey: curve.getPublicKey(),
    privateKey: curve.getPrivateKey(),
  };
}

function WebPushError(message, statusCode, headers, body) {
  Error.captureStackTrace(this, this.constructor);

  this.name = this.constructor.name;
  this.message = message;
  this.statusCode = statusCode;
  this.headers = headers;
  this.body = body;
}

require('util').inherits(WebPushError, Error);

var gcmAPIKey = '';

function setGCMAPIKey(apiKey) {
  gcmAPIKey = apiKey;
}

function encrypt(userPublicKey, payload) {
  var localCurve = crypto.createECDH('prime256v1');

  var localPublicKey = localCurve.generateKeys();
  var localPrivateKey = localCurve.getPrivateKey();

  var sharedSecret = localCurve.computeSecret(userPublicKey);

  var salt = crypto.randomBytes(16);

  ece.saveKey('webpushKey', sharedSecret);

  var cipherText = ece.encrypt(payload, {
    keyid: 'webpushKey',
    salt: urlBase64.encode(salt),
    padSize: 1, // use the aesgcm128 encoding until aesgcm is well supported
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText,
  };
}

function sendNotification(endpoint, TTL, userPublicKey, payload, vapid) {
  return new Promise(function(resolve, reject) {
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
      encrypted = encrypt(urlBase64.decode(userPublicKey), new Buffer(payload));
      options.headers = {
        'Content-Length': encrypted.cipherText.length,
        'Content-Type': 'application/octet-stream',
        'Crypto-Key': 'keyid=p256dh;dh=' + urlBase64.encode(encrypted.localPublicKey),
        'Encryption': 'keyid=p256dh;salt=' + urlBase64.encode(encrypted.salt),
        'Content-Encoding': 'aesgcm128',
      };
    }

    if (vapid) {
      var header = {
        typ: 'JWT',
        alg: 'ES256'
      };

      var jwtPayload = {
        aud: vapid.audience,
        exp: Math.floor(Date.now() / 1000) + 86400,
        sub: vapid.subject,
      };

      var jwt = jws.sign({
        header: header,
        payload: jwtPayload,
        privateKey: toPEM(vapid.privateKey),
      });

      options.headers['Authorization'] = 'Bearer ' + jwt;
      var key = 'p256ecdsa=' + urlBase64.encode(vapid.publicKey);
      if (options.headers['Crypto-Key']) {
        options.headers['Crypto-Key'] += ';' + key;
      } else {
        options.headers['Crypto-Key'] = key;
      }

      console.log(JSON.stringify(options.headers, null, 2));
    }

    var gcmPayload;
    if (endpoint.indexOf('https://android.googleapis.com/gcm/send') === 0) {
      if (payload) {
        reject(new WebPushError('Payload not supported with GCM'));
        return;
      }

      if (vapid) {
        reject(new WebPushError('VAPID not supported with GCM'));
        return;
      }

      if (!gcmAPIKey) {
        console.warn('Attempt to send push notification to GCM endpoint, but no GCM key is defined'.bold.red);
      }

      var endpointSections = endpoint.split('/');
      var subscriptionId = endpointSections[endpointSections.length - 1];
      gcmPayload = JSON.stringify({
        registration_ids: [ subscriptionId ],
      });
      options.path = options.path.substring(0, options.path.length - subscriptionId.length - 1);

      options.headers['Authorization'] = 'key=' + gcmAPIKey;
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = gcmPayload.length;
    }

    if (typeof TTL !== 'undefined') {
      options.headers['TTL'] = TTL;
    } else {
      options.headers['TTL'] = 2419200; // Default TTL is four weeks.
    }

    var expectedStatusCode = gcmPayload ? 200 : 201;
    var pushRequest = https.request(options, function(pushResponse) {
      var body = "";

      pushResponse.on('data', function(chunk) {
        body += chunk;
      });

      pushResponse.on('end', function() {
        if (pushResponse.statusCode !== expectedStatusCode) {
          reject(new WebPushError('Received unexpected response code', pushResponse.statusCode, pushResponse.headers, body));
        } else {
          resolve(body);
        }
      });
    });

    if (typeof payload !== 'undefined') {
      pushRequest.write(encrypted.cipherText);
    }
    if (gcmPayload) {
      pushRequest.write(gcmPayload);
    }
    pushRequest.end();

    pushRequest.on('error', function(e) {
      console.error(e);
      reject(e);
    });
  });
}

module.exports = {
  encrypt: encrypt,
  sendNotification: sendNotification,
  setGCMAPIKey: setGCMAPIKey,
  WebPushError: WebPushError,
  generateVAPIDKeys: generateVAPIDKeys,
};
