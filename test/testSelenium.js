'use strict';

(function() {
  const invalidNodeVersions = /0.(10|12).(\d+)/;
  if (process.versions.node.match(invalidNodeVersions)) {
    console.log('Skipping downloading browsers as selenium tests can\'t run on ' + process.versions.node);
    return;
  }

  /* eslint-disable global-require */
  const urlBase64 = require('urlsafe-base64');
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
  /* eslint-enable global-require */

  webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');

  const PUSH_TEST_TIMEOUT = 120 * 1000;
  const VAPID_PARAM = {
    subject: 'mailto:web-push@mozilla.org',
    privateKey: new Buffer('H6tqEMswzHOFlPHFi2JPfDQRiKN32ZJIwvSPWZl1VTA=', 'base64'),
    publicKey: new Buffer('BIx6khu9Z/5lBwNEXYNEOQiL70IKYDpDxsTyoiCb82puQ/V4c/NFdyrBFpWdsz3mikmV6sWARNuhRbbbLTMOmB0=', 'base64')
  };
  const testDirectory = './test/output/';

  let globalServer;
  let globalDriver;
  let testServerURL;

  function runTest(browser, options) {
    options = options || {};

    if (browser.getSeleniumBrowserId() === 'firefox' &&
      process.env.TRAVIS === 'true') {
      console.log('');
      console.warn(chalk.red(
        'Running on Travis so skipping firefox tests as ' +
        'they don\'t currently work.'
      ));
      console.log('');
      return Promise.resolve();
    }

    return createServer(options, webPush)
    .then(function(server) {
      globalServer = server;
      testServerURL = 'http://127.0.0.1:' + server.port;

      if (browser.getSeleniumBrowserId() === 'firefox') {
        // This is based off of: https://bugzilla.mozilla.org/show_bug.cgi?id=1275521
        // Unfortunately it doesn't seem to work :(
        const ffProfile = new seleniumFirefox.Profile();
        ffProfile.setPreference('dom.push.testing.ignorePermission', true);
        ffProfile.setPreference('notification.prompt.testing', true);
        ffProfile.setPreference('notification.prompt.testing.allow', true);
        browser.getSeleniumOptions().setProfile(ffProfile);
      } else if (browser.getSeleniumBrowserId() === 'chrome') {
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
        testServerURL += '?vapid=' + urlBase64.encode(options.vapid.publicKey);
      }

      // Tests will likely expect a native promise with then and catch
      // Not the web driver promise of then and thenCatch
      return new Promise(function(resolve, reject) {
        globalDriver.get(testServerURL)
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
          if (options) {
            pushPayload = options.payload;
            vapid = options.vapid;
          }

          if (!pushPayload) {
            promise = webPush.sendNotification(subscription.endpoint, {
              vapid: vapid
            });
          } else {
            if (!subscription.keys) {
              throw new Error('Require subscription.keys not found.');
            }

            promise = webPush.sendNotification(subscription.endpoint, {
              payload: pushPayload,
              userPublicKey: subscription.keys.p256dh,
              userAuth: subscription.keys.auth,
              vapid: vapid
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
        })
        .then(function() {
          resolve();
        })
        .thenCatch(function(err) {
          reject(err);
        });
      });
    });
  }

  seleniumAssistant.printAvailableBrowserInfo();

  const availableBrowsers = seleniumAssistant.getAvailableBrowsers();
  availableBrowsers.forEach(function(browser) {
    if (browser.getSeleniumBrowserId() !== 'chrome' &&
      browser.getSeleniumBrowserId() !== 'firefox') {
      return;
    }

    suite('Selenium ' + browser.getPrettyName(), function() {
      this.retries(3);

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
            console.warn('Unable to delete test directory, going to wait 2 ' +
              'seconds and try again');
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

      test('send/receive notification without payload with ' + browser.getPrettyName(), function() {
        this.timeout(PUSH_TEST_TIMEOUT);
        return runTest(browser);
      });

      test('send/receive notification with payload with ' + browser.getPrettyName(), function() {
        this.timeout(PUSH_TEST_TIMEOUT);
        return runTest(browser, {
          payload: 'marco'
        });
      });

      test('send/receive notification with vapid with ' + browser.getPrettyName(), function() {
        this.timeout(PUSH_TEST_TIMEOUT);
        return runTest(browser, {
          vapid: VAPID_PARAM
        });
      });

      test('send/receive notification with payload & vapid with ' + browser.getPrettyName(), function() {
        this.timeout(PUSH_TEST_TIMEOUT);
        return runTest(browser, {
          payload: 'marco',
          vapid: VAPID_PARAM
        });
      });
    });
  });
})();
