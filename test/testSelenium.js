'use strict';

const seleniumAssistant = require('selenium-assistant');
const webdriver = require('selenium-webdriver');
const seleniumFirefox = require('selenium-webdriver/firefox');
const assert = require('assert');
const mkdirp = require('mkdirp');
const fs = require('fs');
const del = require('del');
const chalk = require('chalk');
const webPush = require('../src/index');
const createServer = require('./helpers/create-server');
const which = require('which');

// We need geckodriver on the path
require('geckodriver');
require('chromedriver');

const vapidKeys = webPush.generateVAPIDKeys();

const PUSH_TEST_TIMEOUT = 120 * 1000;
const VAPID_PARAM = {
  subject: 'mailto:web-push@mozilla.org',
  privateKey: vapidKeys.privateKey,
  publicKey: vapidKeys.publicKey
};
const testDirectory = './test/output/';

webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');

let globalServer;
let globalDriver;
let testServerURL;

function runTest(browser, options) {
  options = options || {};

  if (browser.getId() === 'firefox'
  && process.env.TRAVIS === 'true') {
    try {
      which.sync('geckodriver');
    } catch (err) {
      // We can't find geckodriver so skip firefox tests on PRs which
      // don't have the GH_TOKEN
      if (process.env.TRAVIS_PULL_REQUEST !== false) {
        console.log('');
        console.warn(chalk.red('Running on Travis OS X so skipping firefox tests as they don\'t currently work.'));
        console.log('');
        return Promise.resolve();
      }
    }
  }

  return createServer(options, webPush)
  .then(function(server) {
    globalServer = server;
    testServerURL = 'http://127.0.0.1:' + server.port;

    if (browser.getId() === 'firefox') {
      // This is based off of: https://bugzilla.mozilla.org/show_bug.cgi?id=1275521
      // Unfortunately it doesn't seem to work :(
      const ffProfile = new seleniumFirefox.Profile();
      ffProfile.setPreference('dom.push.testing.ignorePermission', true);
      ffProfile.setPreference('notification.prompt.testing', true);
      ffProfile.setPreference('notification.prompt.testing.allow', true);
      browser.getSeleniumOptions().setProfile(ffProfile);
    } else if (browser.getId() === 'chrome') {
      const chromeOperaPreferences = {
        profile: {
          content_settings: {
            exceptions: {
              notifications: {}
            }
          }
        }
      };
      chromeOperaPreferences.profile.content_settings.exceptions.notifications[testServerURL + ',*'] = {
        setting: 1
      };
      /* eslint-enable camelcase */

      // Write to a file
      const tempPreferenceDir = './test/output/temp/chromeOperaPreferences';
      mkdirp.sync(tempPreferenceDir + '/Default');

      // NOTE: The Default part of this path might be Chrome specific.
      fs.writeFileSync(tempPreferenceDir + '/Default/Preferences', JSON.stringify(chromeOperaPreferences));

      const seleniumOptions = browser.getSeleniumOptions();
      seleniumOptions.addArguments('user-data-dir=' + tempPreferenceDir + '/');
    }

    return browser.getSeleniumDriver();
  })
  .then(function(driver) {
    globalDriver = driver;

    if (options.vapid) {
      testServerURL += '?vapid=' + options.vapid.publicKey;
    }

    return globalDriver.get(testServerURL)
    .then(function() {
      return globalDriver.executeScript(function() {
        return typeof navigator.serviceWorker !== 'undefined';
      });
    })
    .then(function(serviceWorkerSupported) {
      assert(serviceWorkerSupported);
    })
    .then(function() {
      return globalDriver.wait(function() {
        return globalDriver.executeScript(function() {
          return typeof window.subscribeSuccess !== 'undefined';
        });
      });
    })
    .then(function() {
      return globalDriver.executeScript(function() {
        if (!window.subscribeSuccess) {
          return window.subscribeError;
        }

        return null;
      });
    })
    .then(function(subscribeError) {
      if (subscribeError) {
        console.log('subscribeError: ', subscribeError);
        throw subscribeError;
      }

      return globalDriver.executeScript(function() {
        return window.testSubscription;
      });
    })
    .then(function(subscription) {
      if (!subscription) {
        throw new Error('No subscription found.');
      }

      subscription = JSON.parse(subscription);

      let promise;
      let pushPayload = null;
      let vapid = null;
      let contentEncoding = null;
      if (options) {
        pushPayload = options.payload;
        vapid = options.vapid;
        contentEncoding = options.contentEncoding;
      }

      if (!pushPayload) {
        promise = webPush.sendNotification(subscription, null, {
          vapidDetails: vapid,
          contentEncoding: contentEncoding
        });
      } else {
        if (!subscription.keys) {
          throw new Error('Require subscription.keys not found.');
        }

        promise = webPush.sendNotification(subscription, pushPayload, {
          vapidDetails: vapid,
          contentEncoding: contentEncoding
        });
      }

      return promise
      .then(function(response) {
        if (response.length > 0) {
          const data = JSON.parse(response);
          if (typeof data.failure !== 'undefined' && data.failure > 0) {
            throw new Error('Bad GCM Response: ' + response);
          }
        }
      });
    })
    .then(function() {
      const expectedTitle = options.payload ? options.payload : 'no payload';
      return globalDriver.wait(function() {
        return webdriver.until.titleIs(expectedTitle, 60000);
      });
    });
  });
}

seleniumAssistant.printAvailableBrowserInfo();

const availableBrowsers = seleniumAssistant.getLocalBrowsers();
availableBrowsers.forEach(function(browser) {
  if (browser.getId() !== 'chrome' && browser.getId() !== 'firefox') {
    return;
  }

  suite('Selenium ' + browser.getPrettyName(), function() {
    if (process.env.TRAVIS) {
      this.retries(3);
    }

    setup(function() {
      globalServer = null;

      return del(testDirectory);
    });

    teardown(function() {
      this.timeout(10000);

      return seleniumAssistant.killWebDriver(globalDriver)
      .catch(function(err) {
        console.log('Error killing web driver: ', err);
      })
      .then(function() {
        globalDriver = null;

        return del(testDirectory)
        .catch(function() {
          console.warn('Unable to delete test directory, going to wait 2 '
          + 'seconds and try again');
          // Add a timeout so that if the browser
          // changes any files in the test directory
          // it doesn't cause del to throw an error
          // (i.e. del checks files in directory, deletes them
          // while another process adds a file, then del fails
          // to remove a non-empty directory).
          return new Promise(function(resolve) {
            setTimeout(resolve, 2000);
          });
        })
        .then(function() {
          return del(testDirectory);
        });
      })
      .then(function() {
        if (globalServer) {
          globalServer.close();
          globalServer = null;
        }
      });
    });

    test('send/receive notification without payload with ' + browser.getPrettyName() + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification without payload with ' + browser.getPrettyName() + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });

    test('send/receive notification with payload with ' + browser.getPrettyName() + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        payload: 'marco',
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification with payload with ' + browser.getPrettyName() + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        payload: 'marco',
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });

    test('send/receive notification with vapid with ' + browser.getPrettyName() + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification with vapid with ' + browser.getPrettyName() + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });

    test('send/receive notification with payload & vapid with ' + browser.getPrettyName() + ' (aesgcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        payload: 'marco',
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_GCM
      });
    });

    test('send/receive notification with payload & vapid with ' + browser.getPrettyName() + ' (aes128gcm)', function() {
      this.timeout(PUSH_TEST_TIMEOUT);
      return runTest(browser, {
        payload: 'marco',
        vapid: VAPID_PARAM,
        contentEncoding: webPush.supportedContentEncodings.AES_128_GCM
      });
    });
  });
});
