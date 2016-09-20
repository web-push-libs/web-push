'use strict';

const crypto = require('crypto');
const urlBase64 = require('urlsafe-base64');
const asn1 = require('asn1.js');
const jws = require('jws');
const url = require('url');

const ECPrivateKeyASN = asn1.define('ECPrivateKey', function() {
  this.seq().obj(
    this.key('version').int(),
    this.key('privateKey').octstr(),
    this.key('parameters').explicit(0).objid()
      .optional(),
    this.key('publicKey').explicit(1).bitstr()
      .optional()
  );
});

function toPEM(key) {
  return ECPrivateKeyASN.encode({
    version: 1,
    privateKey: key,
    parameters: [1, 2, 840, 10045, 3, 1, 7] // prime256v1
  }, 'pem', {
    label: 'EC PRIVATE KEY'
  });
}

function generateVAPIDKeys() {
  const curve = crypto.createECDH('prime256v1');
  curve.generateKeys();

  return {
    publicKey: curve.getPublicKey(),
    privateKey: curve.getPrivateKey()
  };
}

/**
 * This method takes the required VAPID parameters and returns the required
 * header to be added to a Web Push Protocol Request.
 * @param  {string} audience       This must be the origin of the push service.
 * @param  {string} subject        This should be a URL or a 'mailto:' email
 * address.
 * @param  {Buffer} publicKey      The VAPID public key.
 * @param  {Buffer} privateKey     The VAPID private key.
 * @param  {integer} [expiration]  The expiration of the VAPID JWT.
 * @return {Object}                Returns an Object with the Authorization and
 * 'Crypto-Key' values to be used as headers.
 */
function getVapidHeaders(audience, subject, publicKey, privateKey, expiration) {
  if (!audience) {
    throw new Error('No audience set in vapid.audience.');
  }

  if (typeof audience !== 'string' || audience.length === 0) {
    throw new Error('The audience value must be a string containing the ' +
      'origin of a push service. ' + audience);
  }

  const audienceParseResult = url.parse(audience);
  if (!audienceParseResult.hostname) {
    throw new Error('VAPID audience is not a url. ' + audience);
  }

  if (!subject) {
    throw new Error('No subject set in vapid.subject.');
  }

  if (typeof subject !== 'string' || subject.length === 0) {
    throw new Error('The subject value must be a string containing a URL or ' +
      'mailto: address. ' + subject);
  }

  if (subject.indexOf('mailto:') !== 0) {
    const subjectParseResult = url.parse(subject);
    if (!subjectParseResult.hostname) {
      throw new Error('Vapid subject is not a url or mailto url. ' + subject);
    }
  }

  if (!publicKey) {
    throw new Error('No key set vapid.publicKey');
  }

  if (!(publicKey instanceof Buffer)) {
    throw new Error('Vapid public key is not a buffer.');
  }

  if (publicKey.length !== 65) {
    throw new Error('Vapid public key should be 65 bytes long');
  }

  if (!privateKey) {
    throw new Error('No key set in vapid.privateKey');
  }

  if (!(privateKey instanceof Buffer)) {
    throw new Error('Vapid private key is not a buffer');
  }

  if (privateKey.length !== 32) {
    throw new Error('Vapid private key should be 32 bytes long');
  }

  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const jwtPayload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 86400,
    sub: subject
  };

  if (expiration) {
    console.log('expiration', expiration);
  }

  const jwt = jws.sign({
    header: header,
    payload: jwtPayload,
    privateKey: toPEM(privateKey)
  });

  return {
    Authorization: 'WebPush ' + jwt,
    'Crypto-Key': 'p256ecdsa=' + urlBase64.encode(publicKey)
  };
}

module.exports = {
  generateVAPIDKeys: generateVAPIDKeys,
  getVapidHeaders: getVapidHeaders
};
