import assert from 'node:assert';
import { getEventListeners } from 'node:events';
import http from 'node:http';
import { suite, test } from 'mocha';
import { sendNotification } from '../src/index.js';

suite('sendNotification cancellation through a proxy', function() {
  test('aborts a pending proxy CONNECT and closes its socket', async function() {
    const proxy = http.createServer();
    const sockets = new Set();
    const controller = new AbortController();
    const reason = new Error('Notification cancelled');
    let connected;
    let closed;
    let timer;
    const proxyConnected = new Promise(function(resolve) {
      connected = resolve;
    });
    const proxyClosed = new Promise(function(resolve) {
      closed = resolve;
    });
    const deadline = new Promise(function(resolve, reject) {
      timer = setTimeout(function() {
        reject(new Error('Proxy cancellation did not complete'));
      }, 1000);
    });

    proxy.on('connection', function(socket) {
      sockets.add(socket);
      socket.on('close', function() {
        sockets.delete(socket);
      });
    });
    proxy.on('connect', function(request, socket) {
      // CONNECT sockets allow half-open connections; close the server's half
      // after observing the client's FIN, without responding to CONNECT.
      socket.on('end', function() {
        socket.end();
      });
      socket.on('close', closed);
      socket.resume();
      connected();
    });

    try {
      await new Promise(function(resolve) {
        proxy.listen(0, '127.0.0.1', resolve);
      });
      const rejected = assert.rejects(sendNotification({
        endpoint: 'https://example.test/push'
      }, null, {
        proxy: 'http://127.0.0.1:' + proxy.address().port,
        signal: controller.signal,
        vapidDetails: null
      }), function(error) {
        assert.equal(error.name, 'AbortError');
        assert.equal(error.code, 'ABORT_ERR');
        if ('reason' in controller.signal) {
          assert.equal(error.cause, reason);
        }
        return true;
      });

      await Promise.race([proxyConnected, rejected, deadline]);
      controller.abort(reason);
      await Promise.race([rejected, deadline]);
      await Promise.race([proxyClosed, deadline]);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally {
      clearTimeout(timer);
      controller.abort(reason);
      sockets.forEach(function(socket) {
        socket.destroy();
      });
      await new Promise(function(resolve) {
        proxy.close(resolve);
      });
    }
  });
});
