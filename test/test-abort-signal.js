import assert from 'node:assert';
import { getEventListeners, once } from 'node:events';
import fs from 'node:fs';
import https from 'node:https';
import { afterEach, beforeEach, suite, test } from 'mocha';
import { sendNotification, setGCMAPIKey, setVapidDetails, WebPushError } from '../src/index.js';

function deferred() {
  let resolve;
  const promise = new Promise(function(done) {
    resolve = done;
  });
  return { promise, resolve };
}

function expectAbort(notification) {
  const rejected = assert.rejects(notification, {
    name: 'AbortError',
    code: 'ABORT_ERR'
  });
  // Observe failures immediately, even while a test awaits a network event.
  rejected.catch(function() {});
  return rejected;
}

function beforeAbort(event, rejected) {
  return Promise.race([
    event,
    rejected.then(function() {
      throw new Error('The request settled before the test aborted it');
    })
  ]);
}

function socketClosed(socket) {
  return new Promise(function(resolve) {
    socket.once('close', resolve);
  });
}

suite('AbortSignal', function() {
  const pem = fs.readFileSync(new URL('./data/certs/cert.pem', import.meta.url));
  const originalHTTPSRequest = https.request;
  let server;
  let agent;
  let subscription;
  let sockets;
  let requestReceived;
  let handleRequest;
  let requestCount;

  beforeEach(async function() {
    setGCMAPIKey(null);
    setVapidDetails(null);
    sockets = new Set();
    requestCount = 0;
    requestReceived = deferred();
    handleRequest = function() {};
    agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
    server = https.createServer({ key: pem, cert: pem }, function(req, res) {
      requestCount += 1;
      requestReceived.resolve({ req, res });
      req.resume();
      handleRequest(req, res);
    });
    server.on('connection', function(socket) {
      sockets.add(socket);
      socket.once('close', function() {
        sockets.delete(socket);
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    subscription = { endpoint: 'https://127.0.0.1:' + server.address().port + '/push' };
  });

  afterEach(async function() {
    https.request = originalHTTPSRequest;
    const closed = once(server, 'close');
    server.close();
    agent.destroy();
    for (const socket of sockets) {
      socket.destroy();
    }
    await closed;
  });

  test('rejects an already aborted signal without sending an HTTP request', async function() {
    const controller = new AbortController();
    controller.abort();

    await expectAbort(sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    }));

    assert.equal(requestCount, 0);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });

  test('aborts while waiting for response headers and closes the server socket', async function() {
    const controller = new AbortController();
    const rejected = expectAbort(sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    }));
    const { req } = await beforeAbort(requestReceived.promise, rejected);
    const closed = socketClosed(req.socket);

    controller.abort();
    controller.abort();

    await rejected;
    await closed;
    assert.equal(requestCount, 1);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });

  test('aborts after the client receives headers and a partial response body', async function() {
    const controller = new AbortController();
    const chunkReceived = deferred();
    https.request = function(options, listener) {
      return originalHTTPSRequest.call(https, options, function(response) {
        response.once('data', function(chunk) {
          chunkReceived.resolve({ response, chunk });
        });
        listener(response);
      });
    };
    handleRequest = function(req, res) {
      res.writeHead(201);
      res.write('partial response');
    };
    const rejected = expectAbort(sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    }));
    const { req } = await beforeAbort(requestReceived.promise, rejected);
    const closed = socketClosed(req.socket);
    const { response, chunk } = await beforeAbort(chunkReceived.promise, rejected);
    assert.equal(response.statusCode, 201);
    assert.equal(chunk.toString(), 'partial response');
    assert.equal(response.complete, false);

    controller.abort();

    await rejected;
    await closed;
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });

  test('preserves a custom abort reason as the native AbortError cause when supported', async function() {
    const controller = new AbortController();
    const reason = new Error('Notification no longer needed');
    const notification = sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    });
    const rejected = assert.rejects(notification, function(error) {
      assert.equal(error.name, 'AbortError');
      assert.equal(error.code, 'ABORT_ERR');
      if ('reason' in controller.signal) {
        assert.strictEqual(error.cause, reason);
      }
      return true;
    });
    rejected.catch(function() {});
    await beforeAbort(requestReceived.promise, rejected);

    controller.abort(reason);

    await rejected;
  });

  test('cleans up the signal after success and ignores aborts after settlement', async function() {
    const controller = new AbortController();
    handleRequest = function(req, res) {
      res.writeHead(201, { 'X-Push-Test': 'success' });
      res.end('accepted');
    };
    const free = once(agent, 'free');
    const notification = sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    });
    const response = await notification;
    await free;
    assert.equal(response.statusCode, 201);
    assert.equal(response.body, 'accepted');
    assert.equal(response.headers['x-push-test'], 'success');
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);

    controller.abort();
    controller.abort();

    assert.strictEqual(await notification, response);
    assert.equal(requestCount, 1);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });

  test('preserves WebPushError response details with an active signal', async function() {
    const controller = new AbortController();
    handleRequest = function(req, res) {
      res.writeHead(404, { 'X-Push-Test': 'missing' });
      res.end('subscription missing');
    };

    await assert.rejects(sendNotification(subscription, null, {
      agent,
      signal: controller.signal
    }), function(error) {
      assert(error instanceof WebPushError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.headers['x-push-test'], 'missing');
      assert.equal(error.body, 'subscription missing');
      assert.equal(error.endpoint, subscription.endpoint);
      return true;
    });
    assert.equal(controller.signal.aborted, false);
  });

  test('preserves the socket timeout error with an active signal', async function() {
    const controller = new AbortController();

    await assert.rejects(sendNotification(subscription, null, {
      agent,
      timeout: 50,
      signal: controller.signal
    }), function(error) {
      assert.equal(error.message, 'Socket timeout');
      assert.notEqual(error.name, 'AbortError');
      return true;
    });
    assert.equal(requestCount, 1);
    assert.equal(controller.signal.aborted, false);
  });

  test('rejects an invalid signal with the native TypeError', async function() {
    await assert.rejects(sendNotification(subscription, null, {
      agent,
      signal: 'invalid signal'
    }), {
      name: 'TypeError',
      code: 'ERR_INVALID_ARG_TYPE'
    });
    assert.equal(requestCount, 0);
  });
});
