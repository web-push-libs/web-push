import { WebPushLib } from './web-push-lib.js';

export { WebPushError } from './web-push-error.js';
export { encrypt } from './encryption-helper.js';
export { getVapidHeaders, generateVAPIDKeys } from './vapid-helper.js';
export { supportedContentEncodings } from './web-push-constants.js';

const webPush = new WebPushLib();

export const setGCMAPIKey = webPush.setGCMAPIKey;
export const setVapidDetails = webPush.setVapidDetails;
export const generateRequestDetails = webPush.generateRequestDetails;
export const sendNotification = webPush.sendNotification.bind(webPush);
