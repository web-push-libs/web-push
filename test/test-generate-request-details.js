'use strict';

const assert = require('assert');
const urlBase64 = require('urlsafe-base64');
const webPush = require('../src/index');
const crypto = require('crypto');
const jws = require('jws');
const urlParse = require('url').parse;
const https = require('https');

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
            p256dh: urlBase64.encode(Buffer.concat([userPublicKey, Buffer.alloc(1)])),
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
    }, {
      testTitle: 'invalid agent',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        addEndpoint: true,
        extraOptions: {
          agent: 'agent'
        }
      }
    }, {
      testTitle: 'ignore valid agent if proxy denifed',
      requestOptions: {
        subscription: {
          keys: VALID_KEYS
        },
        message: 'hello',
        addEndpoint: true,
        extraOptions: {
          agent: new https.Agent({ keepAlive: true }),
          proxy: 'http://localhost:3000'
        }
      }
    }
  ];

  invalidRequests.forEach(function(invalidRequest) {
    test(invalidRequest.testTitle, function() {
      if (invalidRequest.addEndpoint) {
        invalidRequest.requestOptions.subscription.endpoint = 'https://127.0.0.1:8080';
      }

      if (invalidRequest.serverFlags) {
        invalidRequest.requestOptions.subscription.endpoint += '?'
        + invalidRequest.serverFlags.join('&');
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

  test('Audience contains port with aes128gcm', function() {
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

    const requestDetails = webPush.generateRequestDetails(subscription, null, extraOptions);
    const authHeader = requestDetails.headers.Authorization;

    // Get the Encoded JWT Token from the Authorization Header
    // and decoded it using `jws.decode`
    // to get the value of audience in jwt payload
    const jwtContents = authHeader.match(/vapid\st=([^,]*)/)[1];
    const decodedContents = jws.decode(jwtContents);
    const audience = decodedContents.payload.aud;

    assert.ok(audience, 'Audience exists');
    assert.equal(audience, 'http://example.com:4242', 'Audience contains expected value with port');
  });

  test('Audience contains port with aesgcm', function() {
    const subscription = {
      endpoint: 'http://example.com:4242/life-universe-and-everything'
    };

    const extraOptions = {
      vapidDetails: {
        subject: 'mailto:example@example.com',
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey
      },
      contentEncoding: 'aesgcm'
    };

    const requestDetails = webPush.generateRequestDetails(subscription, null, extraOptions);
    const authHeader = requestDetails.headers.Authorization;

    // Get the Encoded JWT Token from the Authorization Header
    // and decoded it using `jws.decode`
    // to get the value of audience in jwt payload
    const jwtContents = authHeader.match(/WebPush\s(.*)/)[1];
    const decodedContents = jws.decode(jwtContents);
    const audience = decodedContents.payload.aud;

    assert.ok(audience, 'Audience exists');
    assert.equal(audience, 'http://example.com:4242', 'Audience contains expected value with port');
  });

  test('Proxy option', function() {
    let subscription = { endpoint: 'https://127.0.0.1:8080' };
    let message;
    let extraOptions = {
      'proxy': 'proxy'
    };
    let details = webPush.generateRequestDetails(
      subscription,
      message,
      extraOptions
    );
    assert.equal(details.proxy, extraOptions.proxy);
  });

  test('Proxy option as an object', function() {
    let subscription = {
      endpoint: 'https://127.0.0.1:8080'
    };
    let proxyOption = urlParse('http://proxy');
    let extraOptions = {
      proxy: proxyOption
    };
    let details = webPush.generateRequestDetails(
      subscription,
      null,
      extraOptions
    );
    assert.equal(details.proxy, extraOptions.proxy);
  });

  test('Agent option as an https.Agent instance', function() {
    let subscription = {
      endpoint: 'https://127.0.0.1:8080'
    };
    let extraOptions = {
      agent: new https.Agent({ keepAlive: true })
    };
    let details = webPush.generateRequestDetails(
      subscription,
      null,
      extraOptions
    );
    assert.equal(details.agent, extraOptions.agent);
  });
});
