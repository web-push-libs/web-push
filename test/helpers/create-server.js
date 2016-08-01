'use strict';

const http = require('http');
const portfinder = require('portfinder');
const fs = require('fs');
const path = require('path');

function createServer() {
  const demoPath = 'test/data/demo';

  const server = http.createServer(function(req, res) {
    try {
      if (req.method === 'GET') {
        // Ignore query parameters which are used to inject application keys
        const urlParts = req.url.split('?');
        if (urlParts[0] === '/') {
          req.url = '/index.html';
        }

        if (!fs.existsSync(demoPath + req.url)) {
          res.writeHead(404);
          res.end();
          return;
        }

        const data = fs.readFileSync(demoPath + req.url);

        res.writeHead(200, {
          'Content-Length': data.length,
          'Content-Type': path.extname(req.url) === '.html' ? 'text/html' : 'application/javascript'
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

  return new Promise(function(resolve) {
    server.on('listening', function() {
      resolve(server);
    });
  });
}

module.exports = createServer;
