#! /usr/bin/env node
const webPush = require('web-push');
webPush.setGCMAPIKey(process.env.GCM_API_KEY);

const argv = require('minimist')(process.argv.slice(2));

const usage = 'Use: web-push --endpoint=<url> --key=<browser key> [--auth=<auth secret>] [--ttl=<seconds>] [--payload=<message>] [--vapid]';

if (!argv['endpoint'] || !argv['key']) {
  console.log(usage);
  process.exit(1);
}

const endpoint = argv['endpoint'];
const key = argv['key'];
const ttl = argv['ttl'] || 0;
const payload = argv['payload'] || '';
const auth = argv['auth'] || null;
const useVAPID = argv['vapid'] || false;

var params = {
  TTL: ttl,
  payload,
  userPublicKey: key
};
if (useVAPID) {
  const vapidKeys = webPush.generateVAPIDKeys();
  const vapid = {
    audience: 'https://www.mozilla.org/',
    subject: 'mailto:web-push@mozilla.org',
    privateKey: vapidKeys.privateKey,
    publicKey: vapidKeys.publicKey,
  };
  params['vapid'] = vapid;
}
if (auth) {
  params['userAuth'] = auth;
}
webPush.sendNotification(endpoint, params).then(() => {
  console.log('Push message sent.');
}, (err) => {
  console.log('Error sending push message: ', err);
}).then(() => {
  process.exit(0);
});
