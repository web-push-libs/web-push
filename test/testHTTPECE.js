'use strict';

const assert = require('assert');
const crypto = require('crypto');
const ece = require('http_ece');
const urlBase64 = require('urlsafe-base64');
const semver = require('semver');

suite('http_ece', function() {
  if (!semver.satisfies(process.version, '5')) {
    return;
  }

  test('aesgcm - padSize 2 - pad 0', function() {
    const input = Buffer.from(urlBase64.encode('marco'));

    const receiverCurve = crypto.createECDH('prime256v1');
    receiverCurve.setPrivateKey('a4C8H+f9IWtbAbTTkL2AgQ7xo/tqXddWWw7R2CR5OME=', 'base64');
    assert.equal(receiverCurve.getPublicKey()[0], 4, 'is an uncompressed point');
    ece.saveKey('receiver', receiverCurve, 'P-256');

    const senderCurve = crypto.createECDH('prime256v1');
    senderCurve.setPrivateKey('Dt1CLgQlkiaA-tmCkATyKZeoF1-Gtw1-gdEP6pOCqj4', 'base64');
    assert.equal(senderCurve.getPublicKey()[0], 4, 'is an uncompressed point');
    ece.saveKey('sender', senderCurve, 'P-256');

    const salt = '4CQCKEyyOT_LysC17rsMXQ';

    const authSecret = 'r9kcFt8-4Q6MnMjJHqJoSQ';

    const encrypted = ece.encrypt(input, {
      keyid: 'sender',
      dh: urlBase64.encode(receiverCurve.getPublicKey()),
      salt: salt,
      authSecret: authSecret
    });
    assert(encrypted.equals(Buffer.from('Np3XM0NFvnxothcJfFzrv8Vsprn_k9I', 'base64')));

    const decrypted = ece.decrypt(encrypted, {
      keyid: 'receiver',
      dh: urlBase64.encode(senderCurve.getPublicKey()),
      salt: salt,
      authSecret: authSecret
    });
    assert(input.equals(decrypted));
  });

  test('aesgcm - padSize 2 - pad 1', function() {
    const input = Buffer.from(urlBase64.encode('marco'));

    const receiverCurve = crypto.createECDH('prime256v1');
    receiverCurve.setPrivateKey('a4C8H+f9IWtbAbTTkL2AgQ7xo/tqXddWWw7R2CR5OME=', 'base64');
    assert.equal(receiverCurve.getPublicKey()[0], 4, 'is an uncompressed point');
    ece.saveKey('receiver', receiverCurve, 'P-256');

    const senderCurve = crypto.createECDH('prime256v1');
    senderCurve.setPrivateKey('Dt1CLgQlkiaA-tmCkATyKZeoF1-Gtw1-gdEP6pOCqj4', 'base64');
    assert.equal(senderCurve.getPublicKey()[0], 4, 'is an uncompressed point');
    ece.saveKey('sender', senderCurve, 'P-256');

    const salt = '4CQCKEyyOT_LysC17rsMXQ';

    const authSecret = 'r9kcFt8-4Q6MnMjJHqJoSQ';

    const encrypted = ece.encrypt(input, {
      keyid: 'sender',
      dh: urlBase64.encode(receiverCurve.getPublicKey()),
      salt: salt,
      authSecret: authSecret,
      pad: 1
    });
    assert(encrypted.equals(Buffer.from('Npy6P1BUsvRGMWEbwYq2JArF0l9YD38o', 'base64')));

    const decrypted = ece.decrypt(encrypted, {
      keyid: 'receiver',
      dh: urlBase64.encode(senderCurve.getPublicKey()),
      salt: salt,
      authSecret: authSecret
    });
    assert(input.equals(decrypted));
  });
});
