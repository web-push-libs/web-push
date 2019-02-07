#! /usr/bin/env node
/* eslint consistent-return:0 */

'use strict';

const webPush = require('../src/index.js');

const printUsageDetails = () => {
  const actions = [
    {
      name: 'send-notification',
      options: [
        '--endpoint=<url>',
        '[--key=<browser key>]',
        '[--auth=<auth secret>]',
        '[--payload=<message>]',
        '[--ttl=<seconds>]',
        '[--encoding=<encoding type>]',
        '[--vapid-subject=<vapid subject>]',
        '[--vapid-pubkey=<public key url base64>]',
        '[--vapid-pvtkey=<private key url base64>]',
        '[--gcm-api-key=<api key>]'
      ]
    }, {
      name: 'generate-vapid-keys',
      options: [
        '[--json]'
      ]
    }
  ];

  let usage = '\nUsage: \n\n';
  actions.forEach(action => {
    usage += '  web-push ' + action.name;
    usage += ' ' + action.options.join(' ');
    usage += '\n\n';
  });

  console.log(usage);
  process.exit(1);
};

const generateVapidKeys = returnJson => {
  const vapidKeys = webPush.generateVAPIDKeys();

  let outputText;
  if (returnJson) {
    outputText = JSON.stringify(vapidKeys);
  } else {
    const outputLine = '\n=======================================\n';
    outputText = outputLine + '\n'
    + 'Public Key:\n' + vapidKeys.publicKey + '\n\n'
    + 'Private Key:\n' + vapidKeys.privateKey + '\n'
    + outputLine;
  }

  console.log(outputText);
  process.exit(0);
};

const sendNotification = args => {
  if (process.env.GCM_API_KEY) {
    webPush.setGCMAPIKey(process.env.GCM_API_KEY);
  }

  const subscription = {
    endpoint: args.endpoint,
    keys: {
      p256dh: args.key || null,
      auth: args.auth || null
    }
  };

  const payload = args.payload || null;

  const options = {};

  if (args.ttl) {
    options.TTL = args.ttl;
  }

  if (argv['vapid-subject'] || argv['vapid-pubkey'] || argv['vapid-pvtkey']) {
    options.vapidDetails = {
      subject: args['vapid-subject'] || null,
      publicKey: args['vapid-pubkey'] || null,
      privateKey: args['vapid-pvtkey'] || null
    };
  }

  if (args['gcm-api-key']) {
    options.gcmAPIKey = args['gcm-api-key'];
  }

  if (args.encoding) {
    options.contentEncoding = args.encoding;
  }

  webPush.sendNotification(subscription, payload, options)
  .then(() => {
    console.log('Push message sent.');
  }, err => {
    console.log('Error sending push message: ');
    console.log(err);
  })
  .then(() => {
    process.exit(0);
  });
};

const action = process.argv[2];
const argv = require('minimist')(process.argv.slice(3));
switch (action) {
  case 'send-notification':
    if (!argv.endpoint) {
      return printUsageDetails();
    }

    sendNotification(argv);
    break;
  case 'generate-vapid-keys':
    generateVapidKeys(argv.json || false);
    break;
  default:
    printUsageDetails();
    break;
}
