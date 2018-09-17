'use strict';

const urlBase64 = require('urlsafe-base64');
const url = require('url');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');

const WebPushError = require('./web-push-error.js');
const vapidHelper = require('./vapid-helper.js');
const encryptionHelper = require('./encryption-helper.js');
const webPushConstants = require('./web-push-constants.js');

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
    throw new Error('The GCM API Key should be a non-empty string or null.');
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
 * @param  {string} publicKey  The public VAPID key, a URL safe, base64 encoded string
 * @param  {string} privateKey The private VAPID key, a URL safe, base64 encoded string.
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
   * To get the details of a request to trigger a push message, without sending
   * a push notification call this method.
   *
   * This method will throw an error if there is an issue with the input.
   * @param  {PushSubscription} subscription The PushSubscription you wish to
   * send the notification to.
   * @param  {string|Buffer} [payload]       The payload you wish to send to the
   * the user.
   * @param  {Object} [options]              Options for the GCM API key and
   * vapid keys can be passed in if they are unique for each notification you
   * wish to send.
   * @return {Object}                       This method returns an Object which
   * contains 'endpoint', 'method', 'headers' and 'payload'.
   */
WebPushLib.prototype.generateRequestDetails =
  function(subscription, payload, options) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('You must pass in a subscription with at least ' +
        'an endpoint.');
    }

    if (typeof subscription.endpoint !== 'string' ||
      subscription.endpoint.length === 0) {
      throw new Error('The subscription endpoint must be a string with ' +
        'a valid URL.');
    }

    if (payload) {
      // Validate the subscription keys
      if (!subscription.keys || !subscription.keys.p256dh ||
        !subscription.keys.auth) {
        throw new Error('To send a message with a payload, the ' +
          'subscription must have \'auth\' and \'p256dh\' keys.');
      }
    }

    let currentGCMAPIKey = gcmAPIKey;
    let currentVapidDetails = vapidDetails;
    let timeToLive = DEFAULT_TTL;
    let extraHeaders = {};
    let contentEncoding = webPushConstants.supportedContentEncodings.AES_GCM;
    let proxy;

    if (options) {
      const validOptionKeys = [
        'headers',
        'gcmAPIKey',
        'vapidDetails',
        'TTL',
        'contentEncoding',
        'proxy'
      ];
      const optionKeys = Object.keys(options);
      for (let i = 0; i < optionKeys.length; i += 1) {
        const optionKey = optionKeys[i];
        if (validOptionKeys.indexOf(optionKey) === -1) {
          throw new Error('\'' + optionKey + '\' is an invalid option. ' +
            'The valid options are [\'' + validOptionKeys.join('\', \'') +
            '\'].');
        }
      }

      if (options.headers) {
        extraHeaders = options.headers;
        let duplicates = Object.keys(extraHeaders)
            .filter(function (header) {
              return typeof options[header] !== 'undefined';
            });

        if (duplicates.length > 0) {
          throw new Error('Duplicated headers defined [' +
            duplicates.join(',') + ']. Please either define the header in the' +
            'top level options OR in the \'headers\' key.');
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

      if (options.contentEncoding) {
        if ((options.contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM
          || options.contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM)) {
          contentEncoding = options.contentEncoding;
        } else {
          throw new Error('Unsupported content encoding specified.');
        }
      }

      if (options.proxy) {
        if (typeof options.proxy === 'string') {
          proxy = options.proxy;
        } else {
          console.warn('Attempt to use proxy option, but invalid type it should be a string ');
        }
      }
    }

    if (typeof timeToLive === 'undefined') {
      timeToLive = DEFAULT_TTL;
    }

    const requestDetails = {
      method: 'POST',
      headers: {
        TTL: timeToLive
      }
    };
    Object.keys(extraHeaders).forEach(function (header) {
      requestDetails.headers[header] = extraHeaders[header];
    });
    let requestPayload = null;

    if (payload) {
      if (!subscription.keys ||
        typeof subscription !== 'object' ||
        !subscription.keys.p256dh ||
        !subscription.keys.auth) {
        throw new Error(new Error('Unable to send a message with ' +
          'payload to this subscription since it doesn\'t have the ' +
          'required encryption keys'));
      }

      const encrypted = encryptionHelper
        .encrypt(subscription.keys.p256dh, subscription.keys.auth, payload, contentEncoding);

      requestDetails.headers['Content-Length'] = encrypted.cipherText.length;
      requestDetails.headers['Content-Type'] = 'application/octet-stream';

      if (contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM) {
        requestDetails.headers['Content-Encoding'] = webPushConstants.supportedContentEncodings.AES_128_GCM;
      } else if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
        requestDetails.headers['Content-Encoding'] = webPushConstants.supportedContentEncodings.AES_GCM;
        requestDetails.headers.Encryption = 'salt=' + encrypted.salt;
        requestDetails.headers['Crypto-Key'] = 'dh=' + urlBase64.encode(encrypted.localPublicKey);
      }

      requestPayload = encrypted.cipherText;
    } else {
      requestDetails.headers['Content-Length'] = 0;
    }

    const isGCM = subscription.endpoint.indexOf('https://android.googleapis.com/gcm/send') === 0;
    // VAPID isn't supported by GCM hence the if, else if.
    if (isGCM) {
      if (!currentGCMAPIKey) {
        console.warn('Attempt to send push notification to GCM endpoint, ' +
          'but no GCM key is defined. Please use setGCMApiKey() or add ' +
          '\'gcmAPIKey\' as an option.');
      } else {
        requestDetails.headers.Authorization = 'key=' + currentGCMAPIKey;
      }
    } else if (currentVapidDetails) {
      if (contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM
          && subscription.endpoint.indexOf('https://fcm.googleapis.com') === 0) {
        subscription.endpoint = subscription.endpoint.replace('fcm/send', 'wp');
      }
      const parsedUrl = url.parse(subscription.endpoint);
      const audience = parsedUrl.protocol + '//' +
        parsedUrl.host;

      const vapidHeaders = vapidHelper.getVapidHeaders(
        audience,
        currentVapidDetails.subject,
        currentVapidDetails.publicKey,
        currentVapidDetails.privateKey,
        contentEncoding
      );

      requestDetails.headers.Authorization = vapidHeaders.Authorization;

      if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
        if (requestDetails.headers['Crypto-Key']) {
          requestDetails.headers['Crypto-Key'] += ';' +
            vapidHeaders['Crypto-Key'];
        } else {
          requestDetails.headers['Crypto-Key'] = vapidHeaders['Crypto-Key'];
        }
      }
    }

    requestDetails.body = requestPayload;
    requestDetails.endpoint = subscription.endpoint;

    if (proxy) {
      requestDetails.proxy = proxy;
    }

    return requestDetails;
  };

/**
 * To send a push notification call this method with a subscription, optional
 * payload and any options.
 * @param  {PushSubscription} subscription The PushSubscription you wish to
 * send the notification to.
 * @param  {string|Buffer} [payload]       The payload you wish to send to the
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
    let requestDetails;
    try {
      requestDetails = this.generateRequestDetails(subscription, payload, options);
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise(function(resolve, reject) {
      const httpsOptions = {};
      const urlParts = url.parse(requestDetails.endpoint);
      httpsOptions.hostname = urlParts.hostname;
      httpsOptions.port = urlParts.port;
      httpsOptions.path = urlParts.path;

      httpsOptions.headers = requestDetails.headers;
      httpsOptions.method = requestDetails.method;

      if (requestDetails.proxy) {
        httpsOptions.agent = new HttpsProxyAgent(requestDetails.proxy);
      }

      const pushRequest = https.request(httpsOptions, function(pushResponse) {
        let responseText = '';

        pushResponse.on('data', function(chunk) {
          responseText += chunk;
        });

        pushResponse.on('end', function() {
          if (pushResponse.statusCode < 200 || pushResponse.statusCode > 299) {
            reject(new WebPushError(
              'Received unexpected response code',
              pushResponse.statusCode, pushResponse.headers, responseText, requestDetails.endpoint
            ));
          } else {
            resolve({
              statusCode: pushResponse.statusCode,
              body: responseText,
              headers: pushResponse.headers
            });
          }
        });
      });

      pushRequest.on('error', function(e) {
        reject(e);
      });

      if (requestDetails.body) {
        pushRequest.write(requestDetails.body);
      }

      pushRequest.end();
    });
  };

module.exports = WebPushLib;
