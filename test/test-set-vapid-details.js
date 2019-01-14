'use strict';

const assert = require('assert');
const urlBase64 = require('urlsafe-base64');
const webPush = require('../src/index');

const VALID_SUBJECT_MAILTO = 'mailto: example@example.com';
const VALID_SUBJECT_URL = 'https://exampe.com/contact';
const VALID_PUBLIC_KEY = urlBase64.encode(Buffer.alloc(65));
const VALID_PRIVATE_KEY = urlBase64.encode(Buffer.alloc(32));

suite('setVapidDetails()', function() {
  test('is defined', function() {
    assert(webPush.setVapidDetails);
  });

  test('Valid URL input', function() {
    assert.doesNotThrow(function() {
      webPush.setVapidDetails(VALID_SUBJECT_URL, VALID_PUBLIC_KEY, VALID_PRIVATE_KEY);
    });
  });

  test('Valid mailto: input', function() {
    assert.doesNotThrow(function() {
      webPush.setVapidDetails(VALID_SUBJECT_MAILTO, VALID_PUBLIC_KEY, VALID_PRIVATE_KEY);
    });
  });

  test('reset Vapid Details with null', function() {
    assert.doesNotThrow(function() {
      webPush.setVapidDetails(null);
    });
  });

  const invalidInputs = [
    {
      subject: '',
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: 'This is not a valid subject',
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: {},
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: true,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: urlBase64.encode(Buffer.alloc(60)),
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: 'This is invalid',
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: '',
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: {},
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: true,
      privateKey: VALID_PRIVATE_KEY
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: urlBase64.encode(Buffer.alloc(60))
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: 'This is invalid'
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: ''
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: {}
    },
    {
      subject: VALID_SUBJECT_URL,
      publicKey: VALID_PUBLIC_KEY,
      privateKey: true
    }
  ];

  test('Invalid input should throw an error', function() {
    invalidInputs.forEach(function(invalidInput, index) {
      assert.throws(function() {
        webPush.setVapidDetails(
          invalidInput.subject,
          invalidInput.publicKey,
          invalidInput.privateKey
        );
      }, 'Error not thrown on input index: ' + index);
    });
  });
});
