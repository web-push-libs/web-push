#! /usr/bin/env node
const fs = require('fs');
const webPush = require('web-push');
webPush.setGCMAPIKey(process.env.GCM_API_KEY);

const argv = require('minimist')(process.argv.slice(2));

const usage = 'Use: web-push --endpoint=<url> --key=<browser key> [--auth=<auth secret>] [--ttl=<seconds>] [--payload=<message>] [--vapid-audience] [--vapid-subject] [--vapid-pvtkey] [--vapid-pubkey]';

if (!argv['endpoint'] || !argv['key']) {
  console.log(usage);
  process.exit(1);
}

const endpoint = argv['endpoint'];
const key = argv['key'];
const ttl = argv['ttl'] || 0;
const payload = argv['payload'] || '';
const auth = argv['auth'] || null;
const vapidAudience = argv['vapid-audience'] || null;
const vapidSubject = argv['vapid-subject'] || null;
const vapidPubKey = argv['vapid-pubkey'] || null;
const vapidPvtKey = argv['vapid-pvtkey'] || null;

function getKeys() {
  if (vapidPubKey && vapidPvtKey) {
    const publicKey = fs.readFileSync(argv['vapid-pubkey']);
    const privateKey = fs.readFileSync(argv['vapid-pvtkey']);

    if (pubKey && pvtKey) {
      return {
        privateKey,
        publicKey
      };
    }
  }

  return webPush.generateVAPIDKeys();
}

var params = {
  TTL: ttl,
  payload,
  userPublicKey: key
};
if (vapidAudience && vapidSubject) {
  const vapidKeys = getKeys();
  const vapid = {
    audience: vapidAudience,
    subject: `mailto:${vapidSubject}`,
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
