var webPush = require('../index');
var https   = require('https');
var fs      = require('fs');
var path    = require('path');

webPush.setGCMAPIKey(process.env.GCM_API_KEY);

var pem = fs.readFileSync('demo/cert.pem');

var options = {
  key: pem,
  cert: pem,
};

function createServer(pushPayload, pushTimeout) {
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
          if (!pushPayload) {
            promise = webPush.sendNotification(obj.endpoint, pushTimeout ? 200 : undefined);
          } else {
            promise = webPush.sendNotification(obj.endpoint, pushTimeout ? 200 : undefined, obj.key, pushPayload);
          }

          promise.then(function() {
            console.log('Push Application Server - Notification sent to ' + obj.endpoint);

            server.notificationSent = true;
            if (server.onNotificationSent) {
              server.onNotificationSent();
            }
          });
        }, pushTimeout * 1000);
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

  return server;
}

module.exports = createServer;
