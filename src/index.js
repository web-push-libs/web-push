'use strict';

const vapidHelper = require('./vapid-helper.js');
const encryptionHelper = require('./encryption-helper.js');
const WebPushLib = require('./web-push-lib.js');

const webPush = new WebPushLib();

module.exports = {
  encrypt: encryptionHelper.encrypt,
  generateVAPIDKeys: vapidHelper.generateVAPIDKeys,
  setGCMAPIKey: webPush.setGCMAPIKey,
  setVapidDetails: webPush.setVapidDetails,
  sendNotification: webPush.sendNotification
};
