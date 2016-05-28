var http = require('http');
var portfinder = require('portfinder');
var fs = require('fs');
var path = require('path');

function sendWebPush(webPush, obj, pushPayload, vapid) {
  // console.log('Push Application Server - Register: ' + obj.endpoint);
  // console.log('Push Application Server - Send notification to ' + obj.endpoint);

  var promise;
  if (!pushPayload) {
    promise = webPush.sendNotification(obj.endpoint, {
      vapid: vapid,
    });
  } else {
    promise = webPush.sendNotification(obj.endpoint, {
      payload: pushPayload,
      userPublicKey: obj.key,
      userAuth: obj.auth,
      vapid: vapid,
    });
  }

  promise
  .then(function() {
    //console.log('Push Application Server - Notification sent to ' + obj.endpoint);
  })
  .catch(function(error) {
    console.log('Push Application Server - Error in sending notification to ' + obj.endpoint);
    console.log(error);
  })
}

function createServer(options, webPush) {
  var demoPath = 'test/data/demo';
  var pushPayload = null;
  var vapid = null;

  if (options) {
    pushPayload = options.payload;
    vapid = options.vapid;
  }

  var server = http.createServer(function(req, res) {
    try {
      if (req.method === 'GET') {
        if (req.url === '/') {
          req.url = '/index.html';
        }

        if (!fs.existsSync(demoPath + req.url)) {
          res.writeHead(404);
          res.end(data);
          return;
        }

        var data = fs.readFileSync(demoPath + req.url);

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
          sendWebPush(webPush, JSON.parse(body), pushPayload, vapid);
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        });
        res.end('ok');
      }
    } catch (err) {
      console.error('An error occured handling request.', err);
      res.writeHead(404);
      res.end('bad request.');
    }
  });

  portfinder.getPort(function(err, port) {
    if (err) {
      server.port = 50005;
    } else {
      server.port = port;
    }
    server.listen(server.port);
  });

  return new Promise(function(resolve, reject) {
    server.on('listening', function() {
      resolve(server);
    });
  });
};

module.exports = createServer;
