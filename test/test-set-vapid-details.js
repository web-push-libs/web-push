'use strict';

const assert = require('assert');
const { setVapidDetails } = require('../src/index');

const VALID_SUBJECT_MAILTO = 'mailto: example@example.com';
const VALID_SUBJECT_URL = 'https://exampe.com/contact';
const VALID_PUBLIC_KEY = Buffer.alloc(65).toString('base64url');
const VALID_PRIVATE_KEY = Buffer.alloc(32).toString('base64url');

suite('setVapidDetails()', function() {
  test('is defined', function() {
    assert(setVapidDetails);
  });

  test('Valid URL input', function() {
    assert.doesNotThrow(function() {
      setVapidDetails(VALID_SUBJECT_URL, VALID_PUBLIC_KEY, VALID_PRIVATE_KEY);
    });
  });

  test('Valid mailto: input', function() {
    assert.doesNotThrow(function() {
      setVapidDetails(VALID_SUBJECT_MAILTO, VALID_PUBLIC_KEY, VALID_PRIVATE_KEY);
    });
  });

  test('reset Vapid Details with null', function() {
    assert.doesNotThrow(function() {
      setVapidDetails(null);
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
      publicKey: Buffer.alloc(60).toString('base64url'),
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
      privateKey: Buffer.alloc(60).toString('base64url')
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
        setVapidDetails(
          invalidInput.subject,
          invalidInput.publicKey,
          invalidInput.privateKey
        );
      }, 'Error not thrown on input index: ' + index);
    });
  });
});
