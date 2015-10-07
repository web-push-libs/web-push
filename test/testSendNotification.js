var assert    = require('assert');
var crypto    = require('crypto');
var https     = require('https');
var fs        = require('fs');
var webPush   = require('../index');
var ece       = require('encrypted-content-encoding');
var urlBase64 = require('urlsafe-base64');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

suite('sendNotification', function() {
  test('is defined', function() {
    assert(webPush.sendNotification);
  });

  var userCurve = crypto.createECDH('prime256v1');

  var userPublicKey = userCurve.generateKeys();
  var userPrivateKey = userCurve.getPrivateKey();

  function startServer(message, listening, isGCM) {
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

        if (typeof message !== 'undefined') {
          assert(body.length > 0);
          assert.equal(req.headers['content-type'], 'application/octet-stream', 'Content-Type header correct');
          assert.equal(req.headers['encryption-key'].indexOf('keyid=p256dh;dh='), 0, 'Encryption-Key header correct');
          assert.equal(req.headers['encryption'].indexOf('keyid=p256dh;salt='), 0, 'Encryption header correct');
          assert.equal(req.headers['content-encoding'], 'aesgcm128', 'Content-Encoding header correct');

          var appServerPublicKey = urlBase64.decode(req.headers['encryption-key'].substring('keyid=p256dh;dh='.length));
          var salt = req.headers['encryption'].substring('keyid=p256dh;salt='.length);

          var sharedSecret = userCurve.computeSecret(appServerPublicKey);

          ece.saveKey('webpushKey', sharedSecret);

          var decrypted = ece.decrypt(body, {
            keyid: 'webpushKey',
            salt: salt,
          });

          assert(decrypted.equals(new Buffer(message)), "Cipher text correctly decoded");
        }

        if (isGCM) {
          assert.equal(body.toString(), '{"registration_ids":["someSubscriptionID"]}');
          assert.equal(req.headers['authorization'], 'key=my_gcm_key', 'Authorization header correct');
          assert.equal(req.headers['content-type'], 'application/json', 'Content-Type header correct');
          assert.equal(req.headers['content-length'], 43, 'Content-Length header correct');
        }

        res.writeHead(isGCM ? 200 : 201);

        res.end('ok');

        server.close();
      });
    }).listen(50005);

    server.on('listening', listening);
  }

  test('send/receive string', function(done) {
    startServer('hello', function() {
      webPush.sendNotification('https://127.0.0.1:50005', urlBase64.encode(userPublicKey), 'hello').then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function() {
        assert(false, 'sendNotification promise rejected')
      }).then(done);
    });
  });

  test('send/receive buffer', function(done) {
    startServer('hello', function() {
      webPush.sendNotification('https://127.0.0.1:50005', urlBase64.encode(userPublicKey), new Buffer('hello')).then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function() {
        assert(false, 'sendNotification promise rejected')
      }).then(done);
    });
  });

  test('send/receive empty message', function(done) {
    startServer('', function() {
      webPush.sendNotification('https://127.0.0.1:50005', urlBase64.encode(userPublicKey), '').then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function() {
        assert(false, 'sendNotification promise rejected')
      }).then(done);
    });
  });

  test('send/receive without message', function(done) {
    startServer(undefined, function() {
      webPush.sendNotification('https://127.0.0.1:50005').then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function() {
        assert(false, 'sendNotification promise rejected');
      }).then(done);
    });
  });

  test('send/receive GCM', function(done) {
    var httpsrequest = https.request;
    https.request = function(options, listener) {
      options.hostname = '127.0.0.1';
      options.port = '50005';
      options.path = '/';
      return httpsrequest.call(https, options, listener);
    }

    webPush.setGCMAPIKey('my_gcm_key');

    startServer(undefined, function() {
      webPush.sendNotification('https://android.googleapis.com/gcm/send/someSubscriptionID').then(function() {
        assert(true, 'sendNotification promise resolved');
      }, function() {
        assert(false, 'sendNotification promise rejected');
      }).then(done);
    }, true);
  });
});
