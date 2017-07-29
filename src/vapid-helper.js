'use strict';

const crypto = require('crypto');
const urlBase64 = require('urlsafe-base64');
const asn1 = require('asn1.js');
const jws = require('jws');
const url = require('url');

/**
 * DEFAULT_EXPIRATION is set to seconds in 12 hours
 */
const DEFAULT_EXPIRATION_SECONDS = 12 * 60 * 60;
const MAX_EXPIRATION_SECONDS = 24 * 60 * 60;

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
    publicKey: urlBase64.encode(curve.getPublicKey()),
    privateKey: urlBase64.encode(curve.getPrivateKey())
  };
}

function validateSubject(subject) {
  if (!subject) {
    throw new Error('No subject set in vapidDetails.subject.');
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
}

function validatePublicKey(publicKey) {
  if (!publicKey) {
    throw new Error('No key set vapidDetails.publicKey');
  }

  if (typeof publicKey !== 'string') {
    throw new Error('Vapid public key is must be a URL safe Base 64 ' +
      'encoded string.');
  }

  publicKey = urlBase64.decode(publicKey);

  if (publicKey.length !== 65) {
    throw new Error('Vapid public key should be 65 bytes long when decoded.');
  }
}

function validatePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('No key set in vapidDetails.privateKey');
  }

  if (typeof privateKey !== 'string') {
    throw new Error('Vapid private key must be a URL safe Base 64 ' +
      'encoded string.');
  }

  privateKey = urlBase64.decode(privateKey);

  if (privateKey.length !== 32) {
    throw new Error('Vapid private key should be 32 bytes long when decoded.');
  }
}

/**
 * Calculates the total expiration by adding
 * value of Date.now() with the seconds passed
 *
 * @param {Number} numSeconds Number of seconds to calculate expiration
 * @return {Number} expiration in seconds
 */
function calculateExpiration(numSeconds) {
  return Math.floor(Date.now() / 1000) + numSeconds;
}

/**
 * Validates the Expiration based on the VAPID Spec
 *
 * `expiration` is not validated with a `minimum` value,
 * since the time at validation is going to be different
 * than at the time of creation of the custom expiration value
 */
function validateExpiration(expiration) {
  if (!expiration) {
    throw new Error('No expiration value provided in `expiration`');
  }

  expiration = Number.parseInt(expiration, 10);

  if (isNaN(expiration) || typeof expiration !== 'number') {
    throw new Error('Invalid expiration value passed, expiration must be `Number`');
  }

  // Roughly checks the time of expiration, since the max expiration can be ahead
  // of the time than at the moment the expiration was generated
  const maxExpiration = calculateExpiration(MAX_EXPIRATION_SECONDS);

  if (expiration > maxExpiration) {
    throw new Error('`expiration` is greater than maximum of 24 hours');
  }

  if (expiration < 0) {
    throw new Error('`expiration` must be positive integer');
  }
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
    throw new Error('No audience could be generated for VAPID.');
  }

  if (typeof audience !== 'string' || audience.length === 0) {
    throw new Error('The audience value must be a string containing the ' +
      'origin of a push service. ' + audience);
  }

  const audienceParseResult = url.parse(audience);
  if (!audienceParseResult.hostname) {
    throw new Error('VAPID audience is not a url. ' + audience);
  }

  validateSubject(subject);
  validatePublicKey(publicKey);
  validatePrivateKey(privateKey);

  publicKey = urlBase64.decode(publicKey);
  privateKey = urlBase64.decode(privateKey);

  if (expiration) {
    validateExpiration(expiration);
  } else {
    expiration = calculateExpiration(DEFAULT_EXPIRATION_SECONDS);
  }

  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const jwtPayload = {
    aud: audience,
    exp: expiration,
    sub: subject
  };

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
  getVapidHeaders: getVapidHeaders,
  validateSubject: validateSubject,
  validatePublicKey: validatePublicKey,
  validatePrivateKey: validatePrivateKey
};
