var webPush = require('../index');
var https   = require('https');
var fs      = require('fs');
var path    = require('path');

webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');

var pem = fs.readFileSync('test/cert.pem');

var options = {
  key: pem,
  cert: pem,
};

var server = https.createServer(options, function(req, res) {
  if (req.method === 'GET') {
    if (req.url === '/') {
      req.url = '/index.html';
    }

    if (!fs.existsSync('demo' + req.url)) {
      res.writeHead(404);
      res.end(data);
      return;
    }

    var data = fs.readFileSync('demo' + req.url);

    res.writeHead(200, {
      'Content-Length': data.length,
      'Content-Type': path.extname(req.url) === '.html' ? 'text/html' : 'application/javascript',
    });

    res.end(data);
  } else {
    var body = '';

    req.on('data', function(chunk) {
      body += chunk;
    })

    req.on('end', function() {
      var obj = JSON.parse(body);

      console.log('Push Application Server - Register: ' + obj.endpoint);

      if (server.onClientRegistered && server.onClientRegistered()) {
        return;
      }

      setTimeout(function() {
        console.log('Push Application Server - Send notification to ' + obj.endpoint);

        var promise;
        if (!server.pushPayload) {
          promise = webPush.sendNotification(obj.endpoint, 200);
        } else {
          promise = webPush.sendNotification(obj.endpoint, 200, obj.key, server.pushPayload);
        }

        promise.then(function() {
          console.log('Push Application Server - Notification sent to ' + obj.endpoint);

          server.notificationSent = true;
          if (server.onNotificationSent) {
            server.onNotificationSent();
          }
        });
      }, server.pushTimeout * 1000);
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    });

    res.end('ok');
  }
}).listen(50005);

server.notificationSent = false;

server.listening = false;
server.on('listening', function() {
  server.listening = true;
});

module.exports = server;
