var assert     = require('assert');
var crypto     = require('crypto');
var https      = require('https');
var fs         = require('fs');
var webPush    = require('../index');
var ece        = require('http_ece');
var urlBase64  = require('urlsafe-base64');
var semver     = require('semver');
var portfinder = require('portfinder');
var jws        = require('jws');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

suite('sendNotification', function() {
  test('is defined', function() {
    assert(webPush.sendNotification);
  });

  var closePromise;
  var serverPort;

  afterEach(function() {
    if (closePromise) {
      return closePromise;
    }
  });

  var userCurve = crypto.createECDH('prime256v1');

  var userPublicKey = userCurve.generateKeys();
  var userPrivateKey = userCurve.getPrivateKey();

  var intermediateUserAuth = crypto.randomBytes(12);
  var userAuth = crypto.randomBytes(16);

  var vapidKeys = webPush.generateVAPIDKeys();

  function startServer(message, TTL, statusCode, isGCM, vapid) {
    var pem = fs.readFileSync('test/cert.pem');

    var options = {
      key: pem,
      cert: pem,
    };

    var server = https.createServer(options, function(req, res) {
      var body = new Buffer(0);

      req.on('data', function(chunk) {
        body = Buffer.concat([ body, chunk ]);
      });

      req.on('end', function() {
        assert.equal(req.headers['content-length'], body.length, 'Content-Length header correct');

        if (typeof TTL !== 'undefined') {
          assert.equal(req.headers['ttl'], TTL, 'TTL header correct');
        }

        var cryptoHeader = !!req.headers['encryption-key'] ? 'encryption-key' : 'crypto-key';

        if (typeof message !== 'undefined') {
          assert(body.length > 0);

          assert.equal(req.headers['encryption'].indexOf('keyid=p256dh;salt='), 0, 'Encryption header correct');
          var salt = req.headers['encryption'].substring('keyid=p256dh;salt='.length);

          if (!isGCM) {
            assert.equal(req.headers['content-type'], 'application/octet-stream', 'Content-Type header correct');

            var keys = req.headers[cryptoHeader].split(',');
            var appServerPublicKey = keys.find(function(key) {
              return key.indexOf('keyid=p256dh;dh=') === 0;
            }).substring('keyid=p256dh;dh='.length);

            if (cryptoHeader === 'encryption-key') {
              assert.equal(req.headers['content-encoding'], 'aesgcm128', 'Content-Encoding header correct');

              var sharedSecret = userCurve.computeSecret(urlBase64.decode(appServerPublicKey));
              ece.saveKey('webpushKey', sharedSecret);

              var decrypted = ece.decrypt(body, {
                keyid: 'webpushKey',
                salt: salt,
                padSize: 1,
              });
            } else if (cryptoHeader === 'crypto-key') {
              assert.equal(req.headers['content-encoding'], 'aesgcm', 'Content-Encoding header correct');

              ece.saveKey('webpushKey', userCurve, 'P-256');

              var decrypted = ece.decrypt(body, {
                keyid: 'webpushKey',
                dh: appServerPublicKey,
                salt: salt,
                authSecret: urlBase64.encode(userAuth),
                padSize: 2,
              });
            } else {
              assert(false, 'Invalid crypto header value');
            }
          } else {
            assert.equal(req.headers[cryptoHeader].indexOf('keyid=p256dh;dh='), 0, 'Encryption-Key header correct');
            assert.equal(req.headers['content-encoding'], 'aesgcm', 'Content-Encoding header correct');
            var appServerPublicKey = req.headers['crypto-key'].substring('keyid=p256dh;dh='.length);

            ece.saveKey('webpushKey', userCurve, 'P-256');

            var raw_data = urlBase64.decode(JSON.parse(body).raw_data);

            var decrypted = ece.decrypt(raw_data, {
              keyid: 'webpushKey',
              dh: appServerPublicKey,
              salt: salt,
              authSecret: urlBase64.encode(userAuth),
              padSize: 2,
            });
          }

          assert(decrypted.equals(new Buffer(message)), "Cipher text correctly decoded");
        }

        if (vapid) {
          assert.equal(cryptoHeader, 'crypto-key');
          var keys = req.headers[cryptoHeader].split(',');
          var vapidKey = keys.find(function(key) {
            return key.indexOf('p256ecdsa=') === 0;
          });

          assert.equal(vapidKey.indexOf('p256ecdsa='), 0, 'Crypto-Key header correct');
          var appServerVapidPublicKey = urlBase64.decode(vapidKey.substring('p256ecdsa='.length));

          assert(appServerVapidPublicKey.equals(vapidKeys.publicKey));

          var authorizationHeader = req.headers['authorization'];
          assert.equal(authorizationHeader.indexOf('Bearer '), 0, 'Authorization header correct');
          var jwt = authorizationHeader.substring('Bearer '.length);
          //assert(jws.verify(jwt, 'ES256', appServerVapidPublicKey)), 'JWT valid');
          var decoded = jws.decode(jwt);
          assert.equal(decoded.header.typ, 'JWT');
          assert.equal(decoded.header.alg, 'ES256');
          assert.equal(decoded.payload.aud, 'https://www.mozilla.org/');
          assert(decoded.payload.exp > Date.now() / 1000);
          assert.equal(decoded.payload.sub, 'mailto:mozilla@example.org');
        }

        if (isGCM) {
          assert.equal(JSON.stringify(JSON.parse(body).registration_ids), '["someSubscriptionID"]');
          assert.equal(req.headers['authorization'], 'key=my_gcm_key', 'Authorization header correct');
          assert.equal(req.headers['content-type'], 'application/json', 'Content-Type header correct');
          assert.equal(req.headers['content-length'], body.length, 'Content-Length header correct');
        }

        res.writeHead(statusCode ? statusCode : 201);

        res.end(statusCode !== 404 ? 'ok' : 'not found');

        server.close();
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

    closePromise = new Promise(function(resolve, reject) {
      server.on('close', resolve);
    });

    return new Promise(function(resolve, reject) {
      server.on('listening', resolve);
    });
  }

  test('send/receive string (old standard)', function() {
    return startServer('hello')
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        payload: 'hello',
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function(e) {
      assert(false, 'sendNotification promise rejected with: ' + e);
    });
  });

  test('send/receive string (new standard)', function() {
    return startServer('hello')
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        userAuth: urlBase64.encode(userAuth),
        payload: 'hello',
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function(e) {
      assert(false, 'sendNotification promise rejected with: ' + e);
    });
  });

  test('send/receive string (non-urlsafe base64)', function() {
    return startServer('hello')
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: userPublicKey.toString('base64'),
        userAuth: userAuth.toString('base64'),
        payload: 'hello',
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function(e) {
      assert(false, 'sendNotification promise rejected with: ' + e);
    });
  });

  test('send/receive buffer', function() {
    return startServer('hello')
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        payload: new Buffer('hello'),
      });
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send/receive unicode character', function() {
    return startServer('😁')
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        payload: '😁',
      });
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  // This test fails on Node.js v0.12.
  if (!semver.satisfies(process.version, '0.12')) {
    test('send/receive empty message', function() {
      return startServer('')
      .then(function() {
        return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
          userPublicKey: urlBase64.encode(userPublicKey),
          payload: '',
        });
      })
      .then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function(e) {
        assert(false, 'sendNotification promise rejected with ' + e);
      });
    });
  }

  test('send/receive without message', function() {
    return startServer()
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort);
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send/receive without message with TTL', function() {
    return startServer(undefined, 5)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        TTL: 5,
      });
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send/receive without message with default TTL', function() {
    return startServer(undefined, 2419200)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort);
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send/receive string with TTL', function() {
    return startServer('hello', 5)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        TTL: 5,
        userPublicKey: urlBase64.encode(userPublicKey),
        payload: 'hello',
      });
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('promise rejected when it can\'t connect to the server', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort)
    .then(function() {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('promise rejected when the response status code is unexpected', function() {
    return startServer(undefined, undefined, 404)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort);
    })
    .then(function() {
      assert(false, 'sendNotification promise resolved');
    }, function(err) {
      assert(err, 'sendNotification promise rejected');
      assert(err instanceof webPush.WebPushError, 'err is a WebPushError');
      assert.equal(err.statusCode, 404);
      assert.equal(err.body, 'not found');
      assert(err.headers != null, 'response headers are defined');
    });
  });

  test('send/receive GCM', function() {
    var httpsrequest = https.request;
    https.request = function(options, listener) {
      options.hostname = '127.0.0.1';
      options.port = serverPort;
      options.path = '/';
      return httpsrequest.call(https, options, listener);
    }

    webPush.setGCMAPIKey('my_gcm_key');

    return startServer(undefined, undefined, 200, true)
    .then(function() {
      return webPush.sendNotification('https://android.googleapis.com/gcm/send/someSubscriptionID');
    })
    .then(function() {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send/receive string with GCM', function() {
    var httpsrequest = https.request;
    https.request = function(options, listener) {
      options.hostname = '127.0.0.1';
      options.port = serverPort;
      options.path = '/';
      return httpsrequest.call(https, options, listener);
    }

    webPush.setGCMAPIKey('my_gcm_key');

    return startServer('hello', undefined, 200, true)
    .then(function() {
      return webPush.sendNotification('https://android.googleapis.com/gcm/send/someSubscriptionID', {
        userPublicKey: urlBase64.encode(userPublicKey),
        userAuth: urlBase64.encode(userAuth),
        payload: 'hello',
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('0 arguments', function() {
    return webPush.sendNotification()
    .then(function() {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('userPublicKey argument isn\'t a string', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
      userPublicKey: userPublicKey,
      userAuth: urlBase64.encode(userAuth),
      payload: 'hello',
    })
    .then(function(body) {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('userAuth argument isn\'t a string', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
      userPublicKey: urlBase64.encode(userPublicKey),
      userAuth: userAuth,
      payload: 'hello',
    })
    .then(function(body) {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('userPublicKey argument is too long', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
      userPublicKey: urlBase64.encode(Buffer.concat([ userPublicKey, new Buffer(1) ])),
      userAuth: urlBase64.encode(userAuth),
      payload: 'hello',
    })
    .then(function(body) {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('userPublicKey argument is too short', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
      userPublicKey: urlBase64.encode(userPublicKey.slice(1)),
      userAuth: urlBase64.encode(userAuth),
      payload: 'hello',
    })
    .then(function(body) {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('userAuth argument is too short', function() {
    return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
      userPublicKey: urlBase64.encode(userPublicKey),
      userAuth: urlBase64.encode(userAuth.slice(1)),
      payload: 'hello',
    })
    .then(function(body) {
      assert(false, 'sendNotification promise resolved');
    }, function() {
      assert(true, 'sendNotification promise rejected');
    });
  });

  test('TTL with old interface', function() {
    return startServer(undefined, 5)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, 5);
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('payload with old interface', function() {
    return startServer('hello', 0)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, 0, urlBase64.encode(userPublicKey), 'hello');
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });

  test('send notification with message (old standard) with vapid', function() {
    return startServer('hello', undefined, undefined, undefined, false)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        payload: 'hello',
        vapid: {
          audience: 'https://www.mozilla.org/',
          subject: 'mailto:mozilla@example.org',
          privateKey: vapidKeys.privateKey,
          publicKey: vapidKeys.publicKey,
        },
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function(e) {
      assert(false, 'sendNotification promise rejected with ' + e);
    });
  });

  test('send notification with message (new standard) with vapid', function() {
    return startServer('hello', undefined, undefined, undefined, true)
    .then(function() {
      return webPush.sendNotification('https://127.0.0.1:' + serverPort, {
        userPublicKey: urlBase64.encode(userPublicKey),
        userAuth: urlBase64.encode(userAuth),
        payload: 'hello',
        vapid: {
          audience: 'https://www.mozilla.org/',
          subject: 'mailto:mozilla@example.org',
          privateKey: vapidKeys.privateKey,
          publicKey: vapidKeys.publicKey,
        },
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function(e) {
      assert(false, 'sendNotification promise rejected with ' + e);
    });
  });

  test('send notification if push service is GCM and you want to use VAPID', function() {
    var httpsrequest = https.request;
    https.request = function(options, listener) {
      options.hostname = '127.0.0.1';
      options.port = serverPort;
      options.path = '/';
      return httpsrequest.call(https, options, listener);
    }

    webPush.setGCMAPIKey('my_gcm_key');

    return startServer(undefined, undefined, 200, true)
    .then(function() {
      return webPush.sendNotification('https://android.googleapis.com/gcm/send/someSubscriptionID', 5, undefined, undefined, {
          audience: 'https://www.mozilla.org/',
          subject: 'mailto:mozilla@example.org',
          privateKey: vapidKeys.privateKey,
          publicKey: vapidKeys.publicKey,
      });
    })
    .then(function(body) {
      assert(true, 'sendNotification promise resolved');
      assert.equal(body, 'ok');
    }, function() {
      assert(false, 'sendNotification promise rejected');
    });
  });
});
