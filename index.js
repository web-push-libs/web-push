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

// Old standard, Firefox 44+.
function encryptOld(userPublicKey, payload) {
  var localCurve = crypto.createECDH('prime256v1');

  var localPublicKey = localCurve.generateKeys();
  var localPrivateKey = localCurve.getPrivateKey();

  var sharedSecret = localCurve.computeSecret(urlBase64.decode(userPublicKey));

  var salt = urlBase64.encode(crypto.randomBytes(16));

  ece.saveKey('webpushKey', sharedSecret);

  var cipherText = ece.encrypt(payload, {
    keyid: 'webpushKey',
    salt: salt,
    padSize: 1, // use the aesgcm128 encoding until aesgcm is well supported
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText,
  };
}

// New standard, Firefox 46+ and Chrome 50+.
function encrypt(userPublicKey, userAuth, payload) {
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
        throw new Error('sendNotification requires at least one argument, the endpoint URL');
      } else if (params && typeof params === 'object') {
        var TTL = params.TTL;
        var userPublicKey = params.userPublicKey;
        var userAuth = params.userAuth;
        var payload = params.payload;
        var vapid = params.vapid;
      } else if (args.length !== 1) {
        var TTL = args[1];
        var userPublicKey = args[2];
        var payload = args[3];
        console.warn('You are using the old, deprecated, interface of the `sendNotification` function.'.bold.red);
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

      const isGCM = endpoint.indexOf('https://android.googleapis.com/gcm/send') === 0;

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
        var encrypted;
        var encodingHeader;
        var cryptoHeaderName;
        if (userAuth) {
          // Use the new standard if userAuth is defined (Firefox 46+ and Chrome 50+).
          encrypted = encrypt(userPublicKey, userAuth, new Buffer(payload));
          encodingHeader = 'aesgcm';
          cryptoHeaderName = 'Crypto-Key';
        } else {
          // Use the old standard if userAuth isn't defined (up to Firefox 45).
          encrypted = encryptOld(userPublicKey, new Buffer(payload));
          encodingHeader = 'aesgcm128';
          cryptoHeaderName = 'Encryption-Key';
        }

        options.headers = {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': encodingHeader,
          'Encryption': 'keyid=p256dh;salt=' + encrypted.salt,
        };

        options.headers[cryptoHeaderName] = 'keyid=p256dh;dh=' + urlBase64.encode(encrypted.localPublicKey);

        requestPayload = encrypted.cipherText;
      }

      if (isGCM) {
        if (!gcmAPIKey) {
          console.warn('Attempt to send push notification to GCM endpoint, but no GCM key is defined'.bold.red);
        }

        var endpointSections = endpoint.split('/');
        var subscriptionId = endpointSections[endpointSections.length - 1];

        var gcmObj = {
          registration_ids: [ subscriptionId ],
        };
        if (requestPayload) {
          gcmObj['raw_data'] = requestPayload.toString('base64');
        }
        requestPayload = JSON.stringify(gcmObj);

        options.path = options.path.substring(0, options.path.length - subscriptionId.length - 1);

        options.headers['Authorization'] = 'key=' + gcmAPIKey;
        options.headers['Content-Type'] = 'application/json';
      }

      if (vapid && !isGCM && (typeof payload === 'undefined' || 'Crypto-Key' in options.headers)) {
        // VAPID isn't supported by GCM.
        // We also can't use it when there's a payload on Firefox 45, because
        // Firefox 45 uses the old standard with Encryption-Key.

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
          options.headers['Crypto-Key'] += ',' + key;
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

      var expectedStatusCode = isGCM ? 200 : 201;
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
  encryptOld: encryptOld,
  encrypt: encrypt,
  sendNotification: sendNotification,
  setGCMAPIKey: setGCMAPIKey,
  WebPushError: WebPushError,
  generateVAPIDKeys: generateVAPIDKeys,
};
