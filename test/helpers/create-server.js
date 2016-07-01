var http = require('http');
var portfinder = require('portfinder');
var fs = require('fs');
var path = require('path');

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
        // Ignore query parameters which are used to inject application keys
        var urlParts = req.url.split('?');
        if (urlParts[0] === '/') {
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
        throw new Error('Unable to handle post requests.');
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
