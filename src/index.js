import { getVapidHeaders, generateVAPIDKeys } from './vapid-helper.js';
import { encrypt } from './encryption-helper.js';
import { WebPushLib } from './web-push-lib.js';
import WebPushError from './web-push-error.js';
import WebPushConstants from './web-push-constants.js';

const webPush = new WebPushLib();

const { supportedContentEncodings } = WebPushConstants;
const { setGCMAPIKey, setVapidDetails, generateRequestDetails } = webPush;
const sendNotification = webPush.sendNotification.bind(webPush);

export {
  WebPushError,
  supportedContentEncodings,
  encrypt,
  getVapidHeaders,
  generateVAPIDKeys,
  setGCMAPIKey,
  setVapidDetails,
  generateRequestDetails,
  sendNotification
};
