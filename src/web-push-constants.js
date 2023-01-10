'use strict';

const WebPushConstants = {};

WebPushConstants.supportedContentEncodings = {
  AES_GCM: 'aesgcm',
  AES_128_GCM: 'aes128gcm'
};

WebPushConstants.supportedUrgency = {
  VERY_LOW: 'very-low',
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
};

module.exports = WebPushConstants;
