import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import ece from 'http_ece';
import jws from 'jws';
import { suite, test, afterEach } from 'mocha';
import * as webPush from '../src/index.js';

const audience = 'https://push.example.com:8443';
const subject = 'mailto:sender@example.com';
const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = pair.privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([
  Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')
]).toString('base64url');
const details = { subject, publicKey, privateKey: pair.privateKey };
const receiver = crypto.createECDH('prime256v1');
const receiverPublicKey = receiver.generateKeys().toString('base64url');
const auth = crypto.randomBytes(16).toString('base64url');
const subscription = {
  endpoint: audience + '/subscription',
  keys: { p256dh: receiverPublicKey, auth }
};

function verifyHeaders(headers, encoding, expectedSubject = subject, expectedAudience = audience) {
  const authorization = headers.Authorization;
  const match = encoding === 'aesgcm'
    ? authorization.match(/^WebPush (.+)$/)
    : authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert(match);
  if (encoding === 'aesgcm') {
    assert(headers['Crypto-Key'].includes('p256ecdsa=' + publicKey));
  } else {
    assert.equal(match[2], publicKey);
  }
  assert(jws.verify(match[1], 'ES256', pair.publicKey));
  const decoded = jws.decode(match[1]);
  assert.equal(decoded.header.alg, 'ES256');
  assert.equal(decoded.payload.aud, expectedAudience);
  assert.equal(decoded.payload.sub, expectedSubject);
  return decoded.payload;
}

suite('VAPID private KeyObject', function() {
  afterEach(function() {
    webPush.setVapidDetails(null);
  });

  for (const encoding of ['aes128gcm', 'aesgcm']) {
    test('signs and verifies ' + encoding + ' headers with explicit expiration', function() {
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      const headers = webPush.getVapidHeaders(audience, subject, publicKey, pair.privateKey, encoding, expiration);
      assert.equal(verifyHeaders(headers, encoding).exp, expiration);
    });

    test('encrypts a request with per-request KeyObject using ' + encoding, function() {
      const before = Math.floor(Date.now() / 1000);
      const request = webPush.generateRequestDetails(subscription, 'hello', {
        vapidDetails: details, contentEncoding: encoding
      });
      const after = Math.floor(Date.now() / 1000);
      const claims = verifyHeaders(request.headers, encoding);
      assert(claims.exp >= before + 12 * 60 * 60 && claims.exp <= after + 12 * 60 * 60);
      const options = { version: encoding, privateKey: receiver, authSecret: auth };
      if (encoding === 'aesgcm') {
        options.dh = request.headers['Crypto-Key'].match(/(?:^|;)dh=([^;]+)/)[1];
        options.salt = request.headers.Encryption.match(/^salt=(.+)$/)[1];
      }
      assert.equal(ece.decrypt(request.body, options).toString(), 'hello');
    });
  }

  test('reuses global key and lets per-request details override it', function() {
    webPush.setVapidDetails(subject, publicKey, pair.privateKey);
    for (let i = 0; i < 2; i += 1) {
      const request = webPush.generateRequestDetails(subscription);
      verifyHeaders(request.headers, 'aes128gcm');
    }
    const override = 'mailto:override@example.com';
    const request = webPush.generateRequestDetails(subscription, null, {
      vapidDetails: { ...details, subject: override }
    });
    verifyHeaders(request.headers, 'aes128gcm', override);
    verifyHeaders(webPush.generateRequestDetails(subscription).headers, 'aes128gcm');
  });

  test('removes global VAPID details on reset', function() {
    webPush.setVapidDetails(subject, publicKey, pair.privateKey);
    webPush.setVapidDetails(null);
    assert.equal(webPush.generateRequestDetails(subscription).headers.Authorization, undefined);
  });

  test('sends a signed encrypted notification to loopback HTTPS', async function() {
    this.timeout(5000);
    const pem = fs.readFileSync('test/data/certs/cert.pem');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const sockets = new Set();
    let received;
    const server = https.createServer({ key: pem, cert: pem }, function(req, res) {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', function() {
        received = { headers: req.headers, body: Buffer.concat(chunks) };
        res.writeHead(201);
        res.end('ok');
      });
    });
    server.on('connection', function(socket) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const origin = 'https://127.0.0.1:' + server.address().port;
      const response = await webPush.sendNotification({ ...subscription, endpoint: origin + '/push' }, 'hello', {
        agent, vapidDetails: details, timeout: 3000
      });
      assert.equal(response.statusCode, 201);
      assert(received);
      verifyHeaders({ Authorization: received.headers.authorization }, 'aes128gcm', subject, origin);
      assert.equal(ece.decrypt(received.body, {
        version: 'aes128gcm', privateKey: receiver, authSecret: auth
      }).toString(), 'hello');
    } finally {
      agent.destroy();
      for (const socket of sockets) socket.destroy();
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  });

  test('keeps base64url private key strings working', function() {
    const headers = webPush.getVapidHeaders(audience, subject, publicKey, jwk.d, 'aes128gcm');
    verifyHeaders(headers, 'aes128gcm');
  });

  test('accepts a private KeyObject loaded from PEM', function() {
    const pem = pair.privateKey.export({ format: 'pem', type: 'pkcs8' });
    const key = crypto.createPrivateKey(pem);
    const headers = webPush.getVapidHeaders(audience, subject, publicKey, key, 'aes128gcm');
    verifyHeaders(headers, 'aes128gcm');
  });

  const invalidKeys = [
    ['public EC key', pair.publicKey],
    ['secret key', crypto.createSecretKey(crypto.randomBytes(32))],
    ['RSA private key', crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey],
    ['P-384 private key', crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey],
    ['secp256k1 private key', crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey]
  ];
  for (const [name, key] of invalidKeys) {
    test('rejects ' + name + ' at both entry points', function() {
      const error = /Vapid private key must be a private P-256 KeyObject\./;
      assert.throws(() => webPush.getVapidHeaders(audience, subject, publicKey, key, 'aes128gcm'), error);
      assert.throws(() => webPush.setVapidDetails(subject, publicKey, key), error);
      assert.throws(() => webPush.generateRequestDetails(subscription, null, {
        vapidDetails: { ...details, privateKey: key }
      }), error);
    });
  }

  test('continues to reject a KeyObject as the public key', function() {
    assert.throws(() => webPush.getVapidHeaders(audience, subject, pair.publicKey, pair.privateKey, 'aes128gcm'), /Vapid public key/);
    assert.throws(() => webPush.setVapidDetails(subject, pair.publicKey, pair.privateKey), /Vapid public key/);
  });
});
