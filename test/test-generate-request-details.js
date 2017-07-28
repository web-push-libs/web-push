'use strict';

const assert = require('assert');
const urlBase64 = require('urlsafe-base64');
const webPush = require('../src/index');
const crypto = require('crypto');
const jws = require('jws');

suite('Test Generate Request Details', function() {
  test('is defined', function() {
    assert(webPush.generateRequestDetails);
  });

  const userCurve = crypto.createECDH('prime256v1');
  const userPublicKey = userCurve.generateKeys();
  const userAuth = crypto.randomBytes(16);
  const vapidKeys = require('../src/vapid-helper').generateVAPIDKeys();

  const VALID_KEYS = {
    p256dh: urlBase64.encode(userPublicKey),
    auth: urlBase64.encode(userAuth)
  };

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
    }, {
      testTitle: 'duplicated headers',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        addEndpoint: true,
        extraOptions: {
          TTL: 100,
          headers: {
            'TTL': 900
          }
        }
      }
    }
  ];

  invalidRequests.forEach(function(invalidRequest) {
    test(invalidRequest.testTitle, function() {
      if (invalidRequest.addEndpoint) {
        invalidRequest.requestOptions.subscription.endpoint =
          'https://127.0.0.1:8080';
      }

      if (invalidRequest.serverFlags) {
        invalidRequest.requestOptions.subscription.endpoint += '?' +
          invalidRequest.serverFlags.join('&');
      }

      assert.throws(function() {
        return webPush.generateRequestDetails(
          invalidRequest.requestOptions.subscription,
          invalidRequest.requestOptions.message,
          invalidRequest.requestOptions.extraOptions
        );
      });
    });
  });

  test('Extra headers', function() {
    let subscription = { endpoint: 'https://127.0.0.1:8080' };
    let message;
    let extraOptions = {
      TTL: 100,
      headers: {
        'Topic': 'topic',
        'Urgency': 'urgency'
      }
    };
    let details = webPush.generateRequestDetails(
      subscription,
      message,
      extraOptions
    );
    assert.equal(details.headers.TTL, extraOptions.TTL);
    assert.equal(details.headers.Topic, extraOptions.headers.Topic);
    assert.equal(details.headers.Urgency, extraOptions.headers.Urgency);
  });

  test('Audience contains port', function() {
    const subscription = {
      endpoint: 'http://example.com:4242/life-universe-and-everything'
    };

    const extraOptions = {
      vapidDetails: {
        subject: 'mailto:example@example.com',
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey
      }
    };

    const message = undefined;
    const requestDetails = webPush.generateRequestDetails(subscription, message, extraOptions);
    const authHeader = requestDetails.headers.Authorization;
    const audience = jws.decode(authHeader.slice(8)).payload.aud;

    assert.ok(audience, 'Audience does not exist');
    assert.equal(audience, 'http://example.com:4242', 'Audience does not contain expected value');
  });
});
