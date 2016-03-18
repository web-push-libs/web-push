const urlBase64 = require('urlsafe-base64');
const crypto    = require('crypto');
const ece       = require('http_ece');
const url       = require('url');
const https     = require('https');
const colors    = require('colors');

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

function encryptOld(userPublicKey, payload) {
  var localCurve = crypto.createECDH('prime256v1');

  var localPublicKey = localCurve.generateKeys();
  var localPrivateKey = localCurve.getPrivateKey();

  var sharedSecret = localCurve.computeSecret(urlBase64.decode(userPublicKey));

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

function encrypt(userPublicKey, userAuth, payload) {
  var localCurve = crypto.createECDH('prime256v1');
  var localPublicKey = localCurve.generateKeys();

  var salt = crypto.randomBytes(16);

  ece.saveKey('webpushKey', localCurve, 'P-256');

  var cipherText = ece.encrypt(payload, {
    keyid: 'webpushKey',
    dh: userPublicKey,
    salt: urlBase64.encode(salt),
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
  if (arguments.length === 0) {
    throw new Error('sendNotification requires at least one argument, the endpoint URL');
  } else if (params && typeof params === 'object') {
    var TTL = params.TTL;
    var userPublicKey = params.userPublicKey;
    var userAuth = params.userAuth;
    var payload = params.payload;
  } else {
    var TTL = arguments[1];
    var userPublicKey = arguments[2];
    var payload = arguments[3];
    console.warn('You are using the old, deprecated, interface of the `sendNotification` function.'.bold.red);
  }

  return new Promise(function(resolve, reject) {
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

    var encrypted;
    if (typeof payload !== 'undefined') {
      // Use Encryption-Key and the old standard for Firefox for now, otherwise we
      // can't support Firefox 45.
      // After Firefox 46 is released, we should switch to Crypto-Key, so we can
      // support VAPID with notifications with payloads.
      // We should take https://bugzilla.mozilla.org/show_bug.cgi?id=1257821 into
      // account though.
      const useNewStandard = isGCM;

      encrypted = useNewStandard ? encrypt(userPublicKey, userAuth, new Buffer(payload)) :
                                   encryptOld(userPublicKey, new Buffer(payload));

      options.headers = {
        'Content-Length': encrypted.cipherText.length,
        'Content-Type': 'application/octet-stream',
        'Encryption': 'keyid=p256dh;salt=' + urlBase64.encode(encrypted.salt),
      };

      var cryptoHeader = 'keyid=p256dh;dh=' + urlBase64.encode(encrypted.localPublicKey);

      if (useNewStandard) {
        options.headers['Crypto-Key'] = cryptoHeader;
        options.headers['Content-Encoding'] = 'aesgcm';
      } else {
        options.headers['Encryption-Key'] = cryptoHeader;
        options.headers['Content-Encoding'] = 'aesgcm128';
      }
    }

    var gcmPayload;
    if (isGCM) {
      if (!gcmAPIKey) {
        console.warn('Attempt to send push notification to GCM endpoint, but no GCM key is defined'.bold.red);
      }

      var endpointSections = endpoint.split('/');
      var subscriptionId = endpointSections[endpointSections.length - 1];

      var gcmObj = {
        registration_ids: [ subscriptionId ],
      };
      if (encrypted) {
        gcmObj['raw_data'] = urlBase64.encode(encrypted.cipherText);
      }
      gcmPayload = JSON.stringify(gcmObj);

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

    if (isGCM) {
      pushRequest.write(gcmPayload);
    } else if (typeof payload !== 'undefined') {
      pushRequest.write(encrypted.cipherText);
    }

    pushRequest.end();

    pushRequest.on('error', function(e) {
      console.error(e);
      reject(e);
    });
  });
}

module.exports = {
  encryptOld: encryptOld,
  encrypt: encrypt,
  sendNotification: sendNotification,
  setGCMAPIKey: setGCMAPIKey,
  WebPushError: WebPushError,
};
