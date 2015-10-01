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

  function startServer(listening, done) {
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
        assert.equal(req.headers['content-length'], 22, 'Content-Length header correct');
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

        assert(decrypted.equals(new Buffer('hello')), "Cipher text correctly decoded");

        res.writeHead(201);

        res.end('ok');

        done();
      });
    }).listen(50005);

    server.on('listening', listening);
  }

  test('send', function(done) {
    startServer(function() {
      webPush.sendNotification('https://127.0.0.1:50005', urlBase64.encode(userPublicKey), 'hello');
    }, done);
  });
});
