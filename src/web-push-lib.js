'use strict';

const urlBase64 = require('urlsafe-base64');
const url = require('url');
const https = require('https');

const WebPushError = require('./web-push-error.js');
const vapidHelper = require('./vapid-helper.js');
const encryptionHelper = require('./encryption-helper.js');

// Default TTL is four weeks.
const DEFAULT_TTL = 2419200;

let gcmAPIKey = '';
let vapidDetails;

function WebPushLib() {

}

/**
 * When sending messages to a GCM endpoint you need to set the GCM API key
 * by either calling setGMAPIKey() or passing in the API key as an option
 * to sendNotification().
 * @param  {string} apiKey The API key to send with the GCM request.
 */
WebPushLib.prototype.setGCMAPIKey = function(apiKey) {
  if (apiKey === null) {
    gcmAPIKey = null;
    return;
  }

  if (typeof apiKey === 'undefined' || typeof apiKey !== 'string' ||
    apiKey.length === 0) {
    throw new Error('The GCM API Key should be a non-emtpy string or null.');
  }

  gcmAPIKey = apiKey;
};

/**
 * When making requests where you want to define VAPID details, call this
 * method before sendNotification() or pass in the details and options to
 * sendNotification.
 * @param  {string} subject    This must be either a URL or a 'mailto:'
 * address. For example: 'https://my-site.com/contact' or
 * 'mailto: contact@my-site.com'
 * @param  {Buffer} publicKey  The public VAPID key.
 * @param  {Buffer} privateKey The private VAPID key.
 */
WebPushLib.prototype.setVapidDetails =
  function(subject, publicKey, privateKey) {
    if (arguments.length === 1 && arguments[0] === null) {
      vapidDetails = null;
      return;
    }

    vapidHelper.validateSubject(subject);
    vapidHelper.validatePublicKey(publicKey);
    vapidHelper.validatePrivateKey(privateKey);

    vapidDetails = {
      subject: subject,
      publicKey: publicKey,
      privateKey: privateKey
    };
  };

/**
 * To send a push notification call this method with a subscription, optional
 * payload and any options.
 * @param  {PushSubscription} subscription The PushSubscription you wish to
 * send the notification to.
 * @param  {string} [payload]              The payload you wish to send to the
 * the user.
 * @param  {Object} [options]              Options for the GCM API key and
 * vapid keys can be passed in if they are unique for each notification you
 * wish to send.
 * @return {Promise}                       This method returns a Promise which
 * resolves if the sending of the notification was successful, otherwise it
 * rejects.
 */
WebPushLib.prototype.sendNotification =
  function(subscription, payload, options) {
    if (!subscription || !subscription.endpoint) {
      return Promise.reject('You must pass in a subscription with at least ' +
        'an endpoint.');
    }

    if (typeof subscription.endpoint !== 'string' ||
      subscription.endpoint.length === 0) {
      return Promise.reject('The subscription endpoint must be a string with ' +
        'a valid URL.');
    }

    if (payload) {
      // Validate the subscription keys
      if (!subscription.keys || !subscription.keys.p256dh ||
        !subscription.keys.auth) {
        return Promise.reject('To send a message with a payload, the ' +
          'subscription must have \'auth\' and \'p256dh\' keys.');
      }
    }

    let currentGCMAPIKey = gcmAPIKey;
    let currentVapidDetails = vapidDetails;
    let timeToLive = DEFAULT_TTL;

    if (options) {
      const validOptionKeys = [
        'gcmAPIKey',
        'vapidDetails',
        'TTL'
      ];
      const optionKeys = Object.keys(options);
      for (let i = 0; i < optionKeys.length; i++) {
        const optionKey = optionKeys[i];
        if (validOptionKeys.indexOf(optionKey) === -1) {
          return Promise.reject('\'' + optionKey + '\' is an invalid option. ' +
            'The valid options are [\'' + validOptionKeys.join('\', \'') +
            '\'].');
        }
      }

      if (options.gcmAPIKey) {
        currentGCMAPIKey = options.gcmAPIKey;
      }

      if (options.vapidDetails) {
        currentVapidDetails = options.vapidDetails;
      }

      if (options.TTL) {
        timeToLive = options.TTL;
      }
    }

    if (typeof timeToLive === 'undefined') {
      timeToLive = DEFAULT_TTL;
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        TTL: timeToLive
      }
    };
    let requestPayload = null;

    if (payload) {
      if (!subscription.keys ||
        typeof subscription !== 'object' ||
        !subscription.keys.p256dh ||
        !subscription.keys.auth) {
        return Promise.reject(new Error('Unable to send a message with ' +
          'payload to this subscription since it doesn\'t have the ' +
          'required encryption keys'));
      }

      try {
        const encrypted = encryptionHelper.encrypt(
          subscription.keys.p256dh, subscription.keys.auth, payload);

        requestOptions.headers['Content-Length'] = encrypted.cipherText.length;
        requestOptions.headers['Content-Type'] = 'application/octet-stream';
        requestOptions.headers['Content-Encoding'] = 'aesgcm';
        requestOptions.headers.Encryption = 'keyid=p256dh;salt=' +
          encrypted.salt;
        requestOptions.headers['Crypto-Key'] = 'keyid=p256dh;dh=' +
          urlBase64.encode(encrypted.localPublicKey);

        requestPayload = encrypted.cipherText;
      } catch (err) {
        return Promise.reject(err);
      }
    } else {
      requestOptions.headers['Content-Length'] = 0;
    }

    const isGCM = subscription.endpoint.indexOf(
      'https://android.googleapis.com/gcm/send') === 0;
    // VAPID isn't supported by GCM hence the if, else if.
    if (isGCM) {
      if (!currentGCMAPIKey) {
        console.warn('Attempt to send push notification to GCM endpoint, ' +
          'but no GCM key is defined'.bold.red);
      } else {
        requestOptions.headers.Authorization = 'key=' + currentGCMAPIKey;
      }
    } else if (currentVapidDetails) {
      const parsedUrl = url.parse(subscription.endpoint);
      const audience = parsedUrl.protocol + '//' +
        parsedUrl.hostname;

      const vapidHeaders = vapidHelper.getVapidHeaders(
        audience,
        currentVapidDetails.subject,
        currentVapidDetails.publicKey,
        currentVapidDetails.privateKey
      );

      requestOptions.headers.Authorization = vapidHeaders.Authorization;
      if (requestOptions.headers['Crypto-Key']) {
        requestOptions.headers['Crypto-Key'] += ';' +
          vapidHeaders['Crypto-Key'];
      } else {
        requestOptions.headers['Crypto-Key'] = vapidHeaders['Crypto-Key'];
      }
    }

    return new Promise(function(resolve, reject) {
      const urlParts = url.parse(subscription.endpoint);
      requestOptions.hostname = urlParts.hostname;
      requestOptions.port = urlParts.port;
      requestOptions.path = urlParts.path;

      const pushRequest = https.request(requestOptions, function(pushResponse) {
        let responseText = '';

        pushResponse.on('data', function(chunk) {
          responseText += chunk;
        });

        pushResponse.on('end', function() {
          if (pushResponse.statusCode !== 201) {
            reject(new WebPushError('Received unexpected response code',
              pushResponse.statusCode, pushResponse.headers, responseText));
          } else {
            resolve({
              status: pushResponse.statusCode,
              body: responseText,
              headers: pushResponse.headers
            });
          }
        });
      });

      pushRequest.on('error', function(e) {
        reject(e);
      });

      if (requestPayload) {
        pushRequest.write(requestPayload);
      }

      pushRequest.end();
    });
  };

module.exports = WebPushLib;
