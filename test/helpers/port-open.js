'use strict';

const net = require('net');

module.exports = function(port) {
  return new Promise(function(resolve) {
    const socket = new net.Socket();

    socket.on('connect', function() {
      socket.end();
      resolve(true);
    });

    socket.on('error', function() {
      resolve(false);
    });

    socket.connect({
      port: port
    });
  });
};
