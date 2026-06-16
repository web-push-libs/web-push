'use strict';

const { chromium, firefox } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const webPush = require('../src/index');
const createServer = require('./helpers/create-server');

const CHROME_CHANNEL = process.env.CHROME_CHANNEL || 'chrome';
const PUSH_TEST_TIMEOUT = 120 * 1000;
const vapidKeys = webPush.generateVAPIDKeys();
const VAPID_PARAM = {
  subject: 'mailto:web-push@mozilla.org',
  privateKey: vapidKeys.privateKey,
  publicKey: vapidKeys.publicKey
};

const browsers = [
  {
    name: 'Chrome',
    createContext: async () => {
      const userDataDir = fs.mkdtempSync(path.join(__dirname, '.chrome-profile-'));
      const context = await chromium.launchPersistentContext(userDataDir, {
        channel: CHROME_CHANNEL,
        headless: false,
        ignoreDefaultArgs: ['--disable-background-networking']
      });
      return {
        context,
        cleanup: async () => {
          await context.close();
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      };
    }
  },
  {
    name: 'Firefox',
    // Skipped because firefox from playwright does not support push notifications
    skip: true,
    createContext: async () => {
      const browser = await firefox.launch({
        firefoxUserPrefs: {
          'dom.push.testing.ignorePermission': true,
          'notification.prompt.testing': true,
          'notification.prompt.testing.allow': true,
          'permissions.default.desktop-notification': 1
        }
      });
      const context = await browser.newContext();
      return {
        context,
        cleanup: () => browser.close()
      };
    }
  }
];

async function openSubscription(context, vapidPublicKey) {
  const server = await createServer();
  const origin = 'http://127.0.0.1:' + server.port;
  await context.grantPermissions(['notifications'], { origin });

  const page = await context.newPage();
  let testServerURL = origin;
  if (vapidPublicKey) {
    testServerURL += '?vapid=' + vapidPublicKey;
  }
  await page.goto(testServerURL);

  const serviceWorkerSupported = await page.evaluate(
    () => typeof navigator.serviceWorker !== 'undefined'
  );
  assert(serviceWorkerSupported);

  await page.waitForFunction(() => typeof window.subscribeSuccess !== 'undefined');

  const subscribeError = await page.evaluate(
    () => (window.subscribeSuccess ? null : String(window.subscribeError))
  );
  if (subscribeError) {
    throw new Error('subscribeError: ' + subscribeError);
  }

  const subscriptionString = await page.evaluate(() => window.testSubscription);
  if (!subscriptionString) {
    throw new Error('No subscription found.');
  }

  return { server, page, subscription: JSON.parse(subscriptionString) };
}

async function sendNotificationWithRetry(subscription, payload, options, attemptsLeft) {
  try {
    return await webPush.sendNotification(subscription, payload, options);
  } catch (err) {
    if (err.statusCode === 410 && attemptsLeft > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      return sendNotificationWithRetry(subscription, payload, options, attemptsLeft - 1);
    }
    throw err;
  }
}

browsers.forEach(function(browser) {
  const defineSuite = browser.skip ? suite.skip : suite;

  defineSuite('Playwright ' + browser.name, function() {
    let launched;
    let server;

    suiteSetup(async function() {
      this.timeout(60000);
      launched = await browser.createContext();

      // Prime the push service connection with a throwaway subscription so the
      // first real test does not pay the cold-start cost (the initial subscribe
      // after launch is slow to connect). Best effort: ignore failures here.
      try {
        const warmup = await openSubscription(launched.context, VAPID_PARAM.publicKey);
        warmup.server.close();
        await warmup.page.close();
      } catch {
        // The connection attempt still primes FCM even if this subscribe times out.
      }
    });

    suiteTeardown(async function() {
      // Tearing down a Chrome context with a live FCM connection can take ~15s,
      // so this runs once per suite rather than once per test.
      this.timeout(60000);

      if (launched) {
        await launched.cleanup();
        launched = null;
      }
    });

    teardown(function() {
      if (server) {
        server.close();
        server = null;
      }
    });

    async function runTest(options) {
      options = options || {};

      const opened = await openSubscription(
        launched.context,
        options.vapid ? options.vapid.publicKey : null
      );
      server = opened.server;
      const page = opened.page;
      try {
        const subscription = opened.subscription;

        const pushPayload = options.payload;
        if (pushPayload && !subscription.keys) {
          throw new Error('Require subscription.keys not found.');
        }

        const response = await sendNotificationWithRetry(subscription, pushPayload || null, {
          vapidDetails: options.vapid,
          contentEncoding: options.contentEncoding
        }, 4);

        if (response.body && response.body.length > 0) {
          let data;
          try {
            data = JSON.parse(response.body);
          } catch {
            data = null;
          }

          if (data && typeof data.failure !== 'undefined' && data.failure > 0) {
            throw new Error('Bad GCM Response: ' + response.body);
          }
        }

        const expectedTitle = options.payload ? options.payload : 'no payload';
        await page.waitForFunction(
          (title) => document.title === title,
          expectedTitle,
          { timeout: 60000 }
        );
      } finally {
        await page.close();
      }
    }

    test('send/receive notification with vapid with ' + browser.name + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest({
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification with vapid with ' + browser.name + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest({
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });

    test('send/receive notification with payload & vapid with ' + browser.name + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest({
        payload: 'marco',
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification with payload & vapid with ' + browser.name + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest({
        payload: 'marco',
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });
  });
});
