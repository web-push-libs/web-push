'use strict';

const crypto = require('crypto');
const ece = require('http_ece');
const urlBase64 = require('urlsafe-base64');

const encrypt = function(userPublicKey, userAuth, payload) {
  if (!userPublicKey) {
    throw new Error('No user public key provided for encryption.');
  }

  if (typeof userPublicKey !== 'string') {
    throw new Error('User auth must be a string.');
  }

  if (!userAuth) {
    throw new Error('No user auth provided for encryption.');
  }

  if (typeof userAuth !== 'string') {
    throw new Error('User auth must be a string.');
  }

  if (userAuth.length < 22) {
    throw new Error('User auth should be 22 bytes or more.');
  }

  if (typeof payload === 'string' || payload instanceof String) {
    payload = new Buffer(payload);
  }

  const localCurve = crypto.createECDH('prime256v1');
  const localPublicKey = localCurve.generateKeys();

  const salt = urlBase64.encode(crypto.randomBytes(16));

  ece.saveKey('webpushKey', localCurve, 'P-256');

  const cipherText = ece.encrypt(payload, {
    keyid: 'webpushKey',
    dh: userPublicKey,
    salt: salt,
    authSecret: userAuth,
    padSize: 2
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText
  };
};

module.exports = {
  encrypt: encrypt
};
