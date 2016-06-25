const urlBase64 = require('urlsafe-base64');
const crypto    = require('crypto');
const ece       = require('http_ece');
const url       = require('url');
const https     = require('https');
const colors    = require('colors');
const asn1      = require('asn1.js');
const jws       = require('jws');
require('./shim');

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

// New standard, Firefox 46+ and Chrome 50+.
function encrypt(userPublicKey, userAuth, payload) {
  if (typeof payload === 'string' || payload instanceof String) {
    payload = new Buffer(payload);
  }
  var localCurve = crypto.createECDH('prime256v1');
  var localPublicKey = localCurve.generateKeys();

  var salt = urlBase64.encode(crypto.randomBytes(16));

  ece.saveKey('webpushKey', localCurve, 'P-256');

  var cipherText = ece.encrypt(payload, {
    keyid: 'webpushKey',
    dh: userPublicKey,
    salt: salt,
    authSecret: userAuth,
    padSize: 2,
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText,
  };
}

function sendNotification(endpoint, params) {
  var args = arguments;

  return new Promise(function(resolve, reject) {
    try {
      if (args.length === 0) {
        throw new Error('sendNotification requires at least one argument, the endpoint URL.');
      } else if (params && typeof params === 'object') {
        var TTL = params.TTL;
        var userPublicKey = params.userPublicKey;
        var userAuth = params.userAuth;
        var payload = params.payload;
        var vapid = params.vapid;
      } else if (args.length !== 1) {
        throw new Error('You are using the old, deprecated, interface of the `sendNotification` function.');
      }

      if (userPublicKey) {
        if (typeof userPublicKey !== 'string') {
          throw new Error('userPublicKey should be a base64-encoded string.');
        } else if (urlBase64.decode(userPublicKey).length !== 65) {
          throw new Error('userPublicKey should be 65 bytes long.');
        }
      }

      if (userAuth) {
        if (typeof userAuth !== 'string') {
          throw new Error('userAuth should be a base64-encoded string.');
        } else if (urlBase64.decode(userAuth).length < 16) {
          throw new Error('userAuth should be at least 16 bytes long');
        }
      }

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

      var requestPayload;
      if (typeof payload !== 'undefined') {
        var encrypted = encrypt(userPublicKey, userAuth, payload);

        options.headers = {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aesgcm',
          'Encryption': 'keyid=p256dh;salt=' + encrypted.salt,
        };

        options.headers['Crypto-Key'] = 'keyid=p256dh;dh=' + urlBase64.encode(encrypted.localPublicKey);

        requestPayload = encrypted.cipherText;
      }

      var isGCM = endpoint.indexOf('https://android.googleapis.com/gcm/send') === 0;
      if (isGCM) {
        if (!gcmAPIKey) {
          console.warn('Attempt to send push notification to GCM endpoint, but no GCM key is defined'.bold.red);
        }

        options.headers['Authorization'] = 'key=' + gcmAPIKey;
      }

      if (vapid && !isGCM) {
        // VAPID isn't supported by GCM.

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
      }

      if (typeof TTL !== 'undefined') {
        options.headers['TTL'] = TTL;
      } else {
        options.headers['TTL'] = 2419200; // Default TTL is four weeks.
      }

      if (requestPayload) {
        options.headers['Content-Length'] = requestPayload.length;
      }

      var expectedStatusCode = 201;
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

      if (requestPayload) {
        pushRequest.write(requestPayload);
      }

      pushRequest.end();

      pushRequest.on('error', function(e) {
        console.error(e);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  encrypt: encrypt,
  sendNotification: sendNotification,
  setGCMAPIKey: setGCMAPIKey,
  WebPushError: WebPushError,
  generateVAPIDKeys: generateVAPIDKeys,
};
