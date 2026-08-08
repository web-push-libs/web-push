#! /usr/bin/env node

import { parseArgs } from 'node:util';

import * as webPush from '../src/index.js';

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
        '[--proxy=<http proxy uri, e.g: http://127.0.0.1:8889>]',
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
    options.TTL = Number(args.ttl);
  }

  if (args['vapid-subject'] || args['vapid-pubkey'] || args['vapid-pvtkey']) {
    options.vapidDetails = {
      subject: args['vapid-subject'] || null,
      publicKey: args['vapid-pubkey'] || null,
      privateKey: args['vapid-pvtkey'] || null
    };
  }

  if (args.proxy) {
    options.proxy = args.proxy;
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

const { values: args, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    endpoint: { type: 'string' },
    key: { type: 'string' },
    auth: { type: 'string' },
    payload: { type: 'string' },
    ttl: { type: 'string' },
    encoding: { type: 'string' },
    'vapid-subject': { type: 'string' },
    'vapid-pubkey': { type: 'string' },
    'vapid-pvtkey': { type: 'string' },
    proxy: { type: 'string' },
    'gcm-api-key': { type: 'string' },
    json: { type: 'boolean' }
  }
});

const action = positionals[0];
switch (action) {
  case 'send-notification':
    if (!args.endpoint) {
      printUsageDetails();
      break;
    }

    sendNotification(args);
    break;
  case 'generate-vapid-keys':
    generateVapidKeys(args.json || false);
    break;
  default:
    printUsageDetails();
    break;
}
