'use strict';

const assert = require('assert');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const ece = require('http_ece');
const urlBase64 = require('urlsafe-base64');
const portfinder = require('portfinder');
const jws = require('jws');
const WebPushConstants = require('../src/web-push-constants.js');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

suite('sendNotification', function() {
  test('is defined', function() {
    const webPush = require('../src/index');
    assert(webPush.sendNotification);
  });

  let server;
  let serverPort;
  let requestBody;
  let requestDetails;
  let originalHTTPSRequest = https.request;

  beforeEach(function() {
    requestBody = null;
    requestDetails = null;

    // Delete caches of web push libs to start clean between test runs
    delete require.cache[path.join(__dirname, '..', 'src', 'index.js')];
    delete require.cache[path.join(__dirname, '..', 'src', 'web-push-lib.js')];

    // Reset https request mock
    https.request = originalHTTPSRequest;

    let returnPromise = Promise.resolve();
    if (!server) {
      returnPromise = startServer();
    }

    return returnPromise;
  });

  after(function() {
    return closeServer();
  });

  const userCurve = crypto.createECDH('prime256v1');

  const userPublicKey = userCurve.generateKeys();
  const userAuth = crypto.randomBytes(16);

  const VALID_KEYS = {
    p256dh: urlBase64.encode(userPublicKey),
    auth: urlBase64.encode(userAuth)
  };

  const vapidKeys = require('../src/vapid-helper').generateVAPIDKeys();

  function startServer() {
    const pem = fs.readFileSync('test/data/certs/cert.pem');

    const options = {
      key: pem,
      cert: pem
    };

    server = https.createServer(options, function(req, res) {
      requestBody = new Buffer(0);

      req.on('data', function(chunk) {
        requestBody = Buffer.concat([requestBody, chunk]);
      });

      req.on('end', function() {
        requestDetails = req;

        if (req.url.indexOf('statusCode=404') !== -1) {
          res.writeHead(404);
          res.end();
        } else {
          res.writeHead(201);
          res.end('ok');
        }
      });
    });

    portfinder.getPort(function(err, port) {
      if (err) {
        serverPort = 50005;
      } else {
        serverPort = port;
      }

      server.listen(serverPort);
    });

    return new Promise(function(resolve) {
      server.on('listening', resolve);
    });
  }

  function closeServer() {
    serverPort = null;
    return new Promise(function(resolve) {
      if (!server) {
        resolve();
        return;
      }

      server.on('close', function() {
        server = null;
        resolve();
      });
      server.close();
    });
  }

  function validateRequest(request) {
    const options = request.requestOptions;
    const isGCM = options.subscription.endpoint
      .indexOf('https://android.googleapis.com/gcm') === 0;

    assert.equal(requestDetails.headers['content-length'], requestBody.length, 'Check Content-Length header');

    if (typeof options.extraOptions !== 'undefined' &&
      typeof options.extraOptions.TTL !== 'undefined') {
      assert.equal(requestDetails.headers.ttl, options.extraOptions.TTL, 'Check TTL header');
    } else if (!isGCM) {
      assert.equal(requestDetails.headers.ttl, 2419200, 'Check default TTL header');
    }

    if (typeof message !== 'undefined') {
      assert(requestBody.length > 0);

      assert.equal(requestDetails.headers.encryption.indexOf('keyid=p256dh;salt='), 0, 'Check Encryption header');
      const salt = requestDetails.headers.encryption.substring('keyid=p256dh;salt='.length);

      assert.equal(requestDetails.headers['content-type'], 'application/octet-stream', 'Check Content-Type header');

      const keys = requestDetails.headers['crypto-key'].split(';');
      const appServerPublicKey = keys.find(function(key) {
        return key.indexOf('dh=') === 0;
      }).substring('dh='.length);

      assert.equal(requestDetails.headers['content-encoding'], options.extraOptions.contentEncoding, 'Check Content-Encoding header');

      const decrypted = ece.decrypt(requestBody, {
        version: options.extraOptions.contentEncoding,
        privateKey: userCurve,
        dh: appServerPublicKey,
        salt: salt,
        authSecret: urlBase64.encode(userAuth)
      });

      assert(decrypted.equals(new Buffer(options.message)), 'Check cipher text can be correctly decoded');
    }

    if (options.vapid) {
      const keys = requestDetails.headers['crypto-key'].split(';');
      const vapidKey = keys.find(function(key) {
        return key.indexOf('p256ecdsa=') === 0;
      });

      assert.equal(vapidKey.indexOf('p256ecdsa='), 0, 'Crypto-Key header correct');
      const appServerVapidPublicKey = urlBase64.decode(vapidKey.substring('p256ecdsa='.length));

      assert(appServerVapidPublicKey.equals(vapidKeys.publicKey));

      const authorizationHeader = requestDetails.headers.authorization;
      assert.equal(authorizationHeader.indexOf('WebPush '), 0, 'Check VAPID Authorization header');
      const jwt = authorizationHeader.substring('WebPush '.length);
      // assert(jws.verify(jwt, 'ES256', appServerVapidPublicKey)), 'JWT valid');
      const decoded = jws.decode(jwt);
      assert.equal(decoded.header.typ, 'JWT');
      assert.equal(decoded.header.alg, 'ES256');
      assert.equal(decoded.payload.aud, 'https://127.0.0.1');
      assert(decoded.payload.exp > Date.now() / 1000);
      assert.equal(decoded.payload.sub, 'mailto:mozilla@example.org');
    }

    if (isGCM) {
      if (typeof options.extraOptions !== 'undefined' &&
        typeof options.extraOptions.gcmAPIKey !== 'undefined') {
        assert.equal(requestDetails.headers.authorization, 'key=' + options.extraOptions.gcmAPIKey, 'Check GCM Authorization header');
      } else {
        assert.equal(requestDetails.headers.authorization, 'key=my_gcm_key', 'Check GCM Authorization header');
      }
    }

    const extraHeaders = options.extraOptions && options.extraOptions.headers;
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (header) {
        const normalizedName = header.toLowerCase();
        assert.equal(requestDetails.headers[normalizedName], extraHeaders[header], 'Check presence of header ' + header);
      });
    }
  }

  const validRequests = [
    {
      testTitle: 'send/receive string',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello'
      }
    },
    {
      testTitle: 'send/receive string (non-urlsafe base64)',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: userPublicKey.toString('base64'),
            auth: userAuth.toString('base64')
          }
        },
        message: 'hello'
      }
    }, {
      testTitle: 'send/receive buffer',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: new Buffer('hello')
      }
    }, {
      testTitle: 'send/receive unicode character',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: '😁'
      }
    }, {
      testTitle: 'send/receive without message',
      requestOptions: {
        subscription: {
          // The default endpoint will be added by the test
        }
      }
    }, {
      testTitle: 'send/receive without message with TTL',
      requestOptions: {
        subscription: {
          // The default endpoint will be added by the test
        },
        extraOptions: {
          TTL: 5
        }
      }
    }, {
      testTitle: 'send/receive string with TTL',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        extraOptions: {
          TTL: 5
        }
      }
    }, {
      testTitle: 'send notification with message with vapid',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        extraOptions: {
          vapidDetails: {
            subject: 'mailto:mozilla@example.org',
            privateKey: vapidKeys.privateKey,
            publicKey: vapidKeys.publicKey
          }
        }
      }
    }, {
      testTitle: 'send/receive empty message',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: '',
        extraOptions: {
          TTL: 5
        }
      }
    }, {
      testTitle: 'send/receive extra headers',
      requestOptions: {
        subscription: {
          // The default endpoint will be added by the test
        },
        extraOptions: {
          headers: {
            Extra: 'extra',
            'extra-2': 'extra-2'
          }
        }
      }
    }, {
      testTitle: 'server returns 201',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello'
      },
      serverFlags: ['statusCode=201']
    }, {
      testTitle: 'server returns 202',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello'
      },
      serverFlags: ['statusCode=202']
    }
  ];

  // TODO: Add test for VAPID override

  validRequests.forEach(function(validRequest) {
    test(validRequest.testTitle + ' (aesgcm)', function() {
      // Set the default endpoint if it's not already configured
      if (!validRequest.requestOptions.subscription.endpoint) {
        validRequest.requestOptions.subscription.endpoint =
          'https://127.0.0.1:' + serverPort;
      }

      if (validRequest.serverFlags) {
        validRequest.requestOptions.subscription.endpoint += '?' +
          validRequest.serverFlags.join('&');
      }

      validRequest.requestOptions.extraOptions = validRequest.requestOptions.extraOptions || {};
      validRequest.requestOptions.extraOptions.contentEncoding = WebPushConstants.supportedContentEncodings.AES_GCM;

      const webPush = require('../src/index');
      return webPush.sendNotification(
        validRequest.requestOptions.subscription,
        validRequest.requestOptions.message,
        validRequest.requestOptions.extraOptions
      )
      .then(function(response) {
        assert.equal(response.body, 'ok');
      })
      .then(function() {
        validateRequest(validRequest);
      });
    });

    test(validRequest.testTitle + ' (aes128gcm)', function() {
      // Set the default endpoint if it's not already configured
      if (!validRequest.requestOptions.subscription.endpoint) {
        validRequest.requestOptions.subscription.endpoint =
          'https://127.0.0.1:' + serverPort;
      }

      if (validRequest.serverFlags) {
        validRequest.requestOptions.subscription.endpoint += '?' +
          validRequest.serverFlags.join('&');
      }

      validRequest.requestOptions.extraOptions = validRequest.requestOptions.extraOptions || {};
      validRequest.requestOptions.extraOptions.contentEncoding = WebPushConstants.supportedContentEncodings.AES_128_GCM;

      const webPush = require('../src/index');
      return webPush.sendNotification(
        validRequest.requestOptions.subscription,
        validRequest.requestOptions.message,
        validRequest.requestOptions.extraOptions
      )
      .then(function(response) {
        assert.equal(response.body, 'ok');
      })
      .then(function() {
        validateRequest(validRequest);
      });
    });
  });

  const validGCMRequests = [
    {
      testTitle: 'send/receive GCM',
      requestOptions: {
        subscription: {
        }
      }
    }, {
      testTitle: 'send/receive string with GCM',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello'
      }
    }, {
      testTitle: 'send/receive string with GCM (overriding the GCM API key)',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        extraOptions: {
          gcmAPIKey: 'another_gcm_api_key'
        }
      }
    }, {
      testTitle: 'send notification if push service is GCM and you want to use VAPID (aesgcm)',
      requestOptions: {
        subscription: {
        },
        extraOptions: {
          vapidDetails: {
            subject: 'mailto:mozilla@example.org',
            privateKey: vapidKeys.privateKey,
            publicKey: vapidKeys.publicKey
          },
          contentEncoding: WebPushConstants.supportedContentEncodings.AES_GCM
        }
      }
    }, {
      testTitle: 'send notification if push service is GCM and you want to use VAPID (aes128gcm)',
      requestOptions: {
        subscription: {
        },
        extraOptions: {
          vapidDetails: {
            subject: 'mailto:mozilla@example.org',
            privateKey: vapidKeys.privateKey,
            publicKey: vapidKeys.publicKey
          },
          contentEncoding: WebPushConstants.supportedContentEncodings.AES_128_GCM
        }
      }
    }
  ];

  validGCMRequests.forEach(function(validGCMRequest) {
    test(validGCMRequest.testTitle, function() {
      // This mocks out the httpsrequest used by web push.
      // Probably worth switching with proxyquire and sinon.
      https.request = function(options, listener) {
        options.hostname = '127.0.0.1';
        options.port = serverPort;
        options.path = '/';

        return originalHTTPSRequest.call(https, options, listener);
      };

      // Set the default endpoint if it's not already configured
      if (!validGCMRequest.requestOptions.subscription.endpoint) {
        validGCMRequest.requestOptions.subscription.endpoint =
          'https://android.googleapis.com/gcm/send/someSubscriptionID';
      }

      const webPush = require('../src/index');
      webPush.setGCMAPIKey('my_gcm_key');

      return webPush.sendNotification(
        validGCMRequest.requestOptions.subscription,
        validGCMRequest.requestOptions.message,
        validGCMRequest.requestOptions.extraOptions
      )
      .then(function(response) {
        assert.equal(response.body, 'ok');
      })
      .then(function() {
        validateRequest(validGCMRequest);
      });
    });
  });

  const invalidRequests = [
    {
      testTitle: '0 arguments',
      requestOptions: {

      }
    }, {
      testTitle: 'No Endpoint',
      requestOptions: {
        subscription: {}
      }
    }, {
      testTitle: 'Empty Endpoint',
      requestOptions: {
        subscription: {
          endpoint: ''
        }
      }
    }, {
      testTitle: 'Array for Endpoint',
      requestOptions: {
        subscription: {
          endpoint: []
        }
      }
    }, {
      testTitle: 'Object for Endpoint',
      requestOptions: {
        subscription: {
          endpoint: {}
        }
      }
    }, {
      testTitle: 'Object for Endpoint',
      requestOptions: {
        subscription: {
          endpoint: true
        }
      }
    }, {
      testTitle: 'Payload provided with no keys',
      requestOptions: {
        subscription: {
          endpoint: true
        },
        message: 'hello'
      }
    }, {
      testTitle: 'Payload provided with invalid keys',
      requestOptions: {
        subscription: {
          endpoint: true,
          keys: 'silly example'
        },
        message: 'hello'
      }
    }, {
      testTitle: 'Payload provided with only p256dh keys',
      requestOptions: {
        subscription: {
          endpoint: true,
          keys: {
            p256dh: urlBase64.encode(userPublicKey)
          }
        },
        message: 'hello'
      }
    }, {
      testTitle: 'Payload provided with only auth keys',
      requestOptions: {
        subscription: {
          endpoint: true,
          keys: {
            auth: urlBase64.encode(userAuth)
          }
        },
        message: 'hello'
      }
    }, {
      testTitle: 'userPublicKey argument isn\'t a string',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: userPublicKey,
            auth: urlBase64.encode(userAuth)
          }
        },
        message: 'hello'
      },
      addEndpoint: true
    }, {
      testTitle: 'userAuth argument isn\'t a string',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: urlBase64.encode(userPublicKey),
            auth: userAuth
          }
        },
        message: 'hello'
      },
      addEndpoint: true
    }, {
      testTitle: 'userPublicKey argument is too long',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: urlBase64.encode(Buffer.concat([userPublicKey, new Buffer(1)])),
            auth: urlBase64.encode(userAuth)
          }
        },
        message: 'hello'
      },
      addEndpoint: true
    }, {
      testTitle: 'userPublicKey argument is too short',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: urlBase64.encode(userPublicKey.slice(1)),
            auth: urlBase64.encode(userAuth)
          }
        },
        message: 'hello'
      },
      addEndpoint: true
    }, {
      testTitle: 'userAuth argument is too short',
      requestOptions: {
        subscription: {
          keys: {
            p256dh: urlBase64.encode(userPublicKey),
            auth: urlBase64.encode(userAuth.slice(1))
          }
        },
        message: 'hello'
      },
      addEndpoint: true
    }, {
      testTitle: 'rejects when the response status code is unexpected',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello'
      },
      addEndpoint: true,
      serverFlags: ['statusCode=404']
    }, {
      testTitle: 'rejects when payload isn\'t a string or buffer',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: []
      },
      addEndpoint: true,
      serverFlags: ['statusCode=404']
    }, {
      testTitle: 'send notification with invalid vapid option',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        addEndpoint: true,
        extraOptions: {
          vapid: {
            subject: 'mailto:mozilla@example.org',
            privateKey: vapidKeys.privateKey,
            publicKey: vapidKeys.publicKey
          }
        }
      }
    }
  ];

  invalidRequests.forEach(function(invalidRequest) {
    test(invalidRequest.testTitle + ' (aesgcm)', function() {
      if (invalidRequest.addEndpoint) {
        invalidRequest.requestOptions.subscription.endpoint =
          'https://127.0.0.1:' + serverPort;
      }

      if (invalidRequest.serverFlags) {
        invalidRequest.requestOptions.subscription.endpoint += '?' +
          invalidRequest.serverFlags.join('&');
      }

      invalidRequest.requestOptions.extraOptions = invalidRequest.requestOptions.extraOptions || {};
      invalidRequest.requestOptions.extraOptions.contentEncoding = WebPushConstants.supportedContentEncodings.AES_GCM;

      const webPush = require('../src/index');
      return webPush.sendNotification(
        invalidRequest.requestOptions.subscription,
        invalidRequest.requestOptions.message,
        invalidRequest.requestOptions.extraOptions
      )
      .then(function() {
        throw new Error('Expected promise to reject');
      }, function() {
        // NOOP, this error is expected
      });
    });

    test(invalidRequest.testTitle + ' (aes128gcm)', function() {
      if (invalidRequest.addEndpoint) {
        invalidRequest.requestOptions.subscription.endpoint =
          'https://127.0.0.1:' + serverPort;
      }

      if (invalidRequest.serverFlags) {
        invalidRequest.requestOptions.subscription.endpoint += '?' +
          invalidRequest.serverFlags.join('&');
      }

      invalidRequest.requestOptions.extraOptions = invalidRequest.requestOptions.extraOptions || {};
      invalidRequest.requestOptions.extraOptions.contentEncoding = WebPushConstants.supportedContentEncodings.AES_128_GCM;

      const webPush = require('../src/index');
      return webPush.sendNotification(
        invalidRequest.requestOptions.subscription,
        invalidRequest.requestOptions.message,
        invalidRequest.requestOptions.extraOptions
      )
      .then(function() {
        throw new Error('Expected promise to reject');
      }, function() {
        // NOOP, this error is expected
      });
    });
  });

  test('rejects when it can\'t connect to the server', function() {
    const currentServerPort = serverPort;
    return closeServer()
    .then(function() {
      const webPush = require('../src/index');
      return webPush.sendNotification({
        endpoint: 'https://127.0.0.1:' + currentServerPort
      })
      .then(function() {
        throw new Error('sendNotification should have rejected due to server not running');
      }, function() {
        // NOOP
      });
    });
  });
});
