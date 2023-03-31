'use strict';

const urlBase64 = require('urlsafe-base64');
const url = require('url');
const https = require('https');

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

  if (typeof apiKey === 'undefined'
  || typeof apiKey !== 'string'
  || apiKey.length === 0) {
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
WebPushLib.prototype.setVapidDetails = function(subject, publicKey, privateKey) {
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
WebPushLib.prototype.generateRequestDetails = function(subscription, payload, options) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('You must pass in a subscription with at least '
      + 'an endpoint.');
    }

    if (typeof subscription.endpoint !== 'string'
    || subscription.endpoint.length === 0) {
      throw new Error('The subscription endpoint must be a string with '
      + 'a valid URL.');
    }

    if (payload) {
      // Validate the subscription keys
      if (typeof subscription !== 'object' || !subscription.keys
      || !subscription.keys.p256dh
      || !subscription.keys.auth) {
        throw new Error('To send a message with a payload, the '
        + 'subscription must have \'auth\' and \'p256dh\' keys.');
      }
    }

    let currentGCMAPIKey = gcmAPIKey;
    let currentVapidDetails = vapidDetails;
    let timeToLive = DEFAULT_TTL;
    let extraHeaders = {};
    let contentEncoding = webPushConstants.supportedContentEncodings.AES_128_GCM;
    let urgency = webPushConstants.supportedUrgency.NORMAL;
    let topic;
    let proxy;
    let agent;
    let timeout;

    if (options) {
      const validOptionKeys = [
        'headers',
        'gcmAPIKey',
        'vapidDetails',
        'TTL',
        'contentEncoding',
        'urgency',
        'topic',
        'proxy',
        'agent',
        'timeout'
      ];
      const optionKeys = Object.keys(options);
      for (let i = 0; i < optionKeys.length; i += 1) {
        const optionKey = optionKeys[i];
        if (!validOptionKeys.includes(optionKey)) {
          throw new Error('\'' + optionKey + '\' is an invalid option. '
          + 'The valid options are [\'' + validOptionKeys.join('\', \'')
          + '\'].');
        }
      }

      if (options.headers) {
        extraHeaders = options.headers;
        let duplicates = Object.keys(extraHeaders)
            .filter(function (header) {
              return typeof options[header] !== 'undefined';
            });

        if (duplicates.length > 0) {
          throw new Error('Duplicated headers defined ['
          + duplicates.join(',') + ']. Please either define the header in the'
          + 'top level options OR in the \'headers\' key.');
        }
      }

      if (options.gcmAPIKey) {
        currentGCMAPIKey = options.gcmAPIKey;
      }

      // Falsy values are allowed here so one can skip Vapid `else if` below and use FCM
      if (options.vapidDetails !== undefined) {
        currentVapidDetails = options.vapidDetails;
      }

      if (options.TTL !== undefined) {
        timeToLive = Number(options.TTL);
        if (timeToLive < 0) {
          throw new Error('TTL should be a number and should be at least 0');
        }
      }

      if (options.contentEncoding) {
        if ((options.contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM
          || options.contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM)) {
          contentEncoding = options.contentEncoding;
        } else {
          throw new Error('Unsupported content encoding specified.');
        }
      }

      if (options.urgency) {
        if ((options.urgency === webPushConstants.supportedUrgency.VERY_LOW
          || options.urgency === webPushConstants.supportedUrgency.LOW
          || options.urgency === webPushConstants.supportedUrgency.NORMAL
          || options.urgency === webPushConstants.supportedUrgency.HIGH)) {
          urgency = options.urgency;
        } else {
          throw new Error('Unsupported urgency specified.');
        }
      }

      if (options.topic) {
        if (!urlBase64.validate(options.topic)) {
          throw new Error('Unsupported characters set use the URL or filename-safe Base64 characters set');
        }
        if (options.topic.length > 32) {
          throw new Error('use maximum of 32 characters from the URL or filename-safe Base64 characters set');
        }
        topic = options.topic;
      }

      if (options.proxy) {
        if (typeof options.proxy === 'string'
          || typeof options.proxy.host === 'string') {
          proxy = options.proxy;
        } else {
          console.warn('Attempt to use proxy option, but invalid type it should be a string or proxy options object.');
        }
      }

      if (options.agent) {
        if (options.agent instanceof https.Agent) {
          if (proxy) {
            console.warn('Agent option will be ignored because proxy option is defined.');
          }

          agent = options.agent;
        } else {
          console.warn('Wrong type for the agent option, it should be an instance of https.Agent.');
        }
      }

      if (typeof options.timeout === 'number') {
        timeout = options.timeout;
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

    const isGCM = subscription.endpoint.startsWith('https://android.googleapis.com/gcm/send');
    const isFCM = subscription.endpoint.startsWith('https://fcm.googleapis.com/fcm/send');
    // VAPID isn't supported by GCM hence the if, else if.
    if (isGCM) {
      if (!currentGCMAPIKey) {
        console.warn('Attempt to send push notification to GCM endpoint, '
        + 'but no GCM key is defined. Please use setGCMApiKey() or add '
        + '\'gcmAPIKey\' as an option.');
      } else {
        requestDetails.headers.Authorization = 'key=' + currentGCMAPIKey;
      }
    } else if (currentVapidDetails) {
      const parsedUrl = url.parse(subscription.endpoint);
      const audience = parsedUrl.protocol + '//'
      + parsedUrl.host;

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
          requestDetails.headers['Crypto-Key'] += ';'
          + vapidHeaders['Crypto-Key'];
        } else {
          requestDetails.headers['Crypto-Key'] = vapidHeaders['Crypto-Key'];
        }
      }
    } else if (isFCM && currentGCMAPIKey) {
      requestDetails.headers.Authorization = 'key=' + currentGCMAPIKey;
    }

    requestDetails.headers.Urgency = urgency;

    if (topic) {
      requestDetails.headers.Topic = topic;
    }

    requestDetails.body = requestPayload;
    requestDetails.endpoint = subscription.endpoint;

    if (proxy) {
      requestDetails.proxy = proxy;
    }

    if (agent) {
      requestDetails.agent = agent;
    }

    if (timeout) {
      requestDetails.timeout = timeout;
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
WebPushLib.prototype.sendNotification = function(subscription, payload, options) {
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

      if (requestDetails.timeout) {
        httpsOptions.timeout = requestDetails.timeout;
      }

      if (requestDetails.agent) {
        httpsOptions.agent = requestDetails.agent;
      }

      if (requestDetails.proxy) {
        const HttpsProxyAgent = require('https-proxy-agent'); // eslint-disable-line global-require
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
              pushResponse.statusCode,
              pushResponse.headers,
              responseText,
              requestDetails.endpoint
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

      if (requestDetails.timeout) {
        pushRequest.on('timeout', function() {
          pushRequest.destroy(new Error('Socket timeout'));
        });
      }

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
