var webPush = require('../index');
var createServer = require('./helpers/create-server');
var isPortOpen = require('./helpers/port-open');

webPush.setGCMAPIKey('AIzaSyAwmdX6KKd4hPfIcGU2SOfj9vuRDW6u-wo');

process.env.PATH = process.env.PATH + ':test_tools/';

suite('selenium', function() {
  this.timeout(180000);

  var invalidNodeVersions = /0.(10|12).(\d+)/;
  if (process.versions.node.match(invalidNodeVersions)) {
    console.log('Skipping selenium tests as they can\'t run on ' + process.versions.node);
    return;
  }

  var webdriver = require('selenium-webdriver');
  var firefoxBrowsers = require('./browser-managers/firefox-browsers.js');
  var chromeBrowsers = require('./browser-managers/chrome-browsers.js');

  var VAPID_PARAM = {
    audience: 'https://www.mozilla.org/',
    subject: 'mailto:web-push@mozilla.org',
    privateKey: new Buffer('H6tqEMswzHOFlPHFi2JPfDQRiKN32ZJIwvSPWZl1VTA=', 'base64'),
    publicKey: new Buffer('BIx6khu9Z/5lBwNEXYNEOQiL70IKYDpDxsTyoiCb82puQ/V4c/NFdyrBFpWdsz3mikmV6sWARNuhRbbbLTMOmB0=', 'base64'),
  };
  var globalServer, globalDriver;

  suiteSetup(function() {
    this.timeout(0);

    var promises = [];
    promises.push(firefoxBrowsers.downloadBrowsers());
    promises.push(chromeBrowsers.downloadBrowsers());

    return Promise.all(promises)
    .then(function() {
      console.log('');
      console.log('');
      console.log('     Suite setup complete');
      console.log('');
      console.log('');
    });
  });

  teardown(function(done) {
    var closeDriverPromise = Promise.resolve();
    if (globalDriver) {
      closeDriverPromise = new Promise(function(resolve) {
        globalDriver.quit()
        .then(function() {
          resolve();
        })
        .thenCatch(function(err) {
          console.log('Error when quiting driver: ', err);
          resolve();
        })
      });
    }

    closeDriverPromise
    .then(function() {
      globalDriver = null;
      globalServer.close(function() {
        globalServer = null;
        done();
      });
    });
  });

  function runTest(driverFunction, options) {
    options = options ? options : {};

    return createServer(options, webPush)
    .then(function(server) {
      globalServer = server;
      return driverFunction();
    })
    .then(function(driver) {
      globalDriver = driver;
      // Tests will likely expect a native promise with then and catch
      // Not the web driver promise of then and thenCatch
      return new Promise(function(resolve, reject) {
        globalDriver.get('http://127.0.0.1:' + globalServer.port)
        .then(function() {
          return globalDriver.executeScript(function(port) {
            if (typeof netscape !== 'undefined') {
              netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
              Components.utils.import('resource://gre/modules/Services.jsm');
              var uri = Services.io.newURI('http://127.0.0.1:' + port, null, null);
              var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
              Services.perms.addFromPrincipal(principal, 'desktop-notification', Services.perms.ALLOW_ACTION);
            }
          }, globalServer.port);
        })
        .then(function() {
          var expectedTitle = options.payload ? options.payload : 'no payload';
          return globalDriver.wait(webdriver.until.titleIs(expectedTitle, 60000));
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

  var firefoxBrowsersToTest = [
    {
      id: 'firefox',
      name: 'Firefox Stable'
    }
    // 'firefox-beta',
    // 'firefox-aurora'
  ];

  var chromeBrowsersToTest = [
    {
      id: 'chrome',
      name: 'Chrome Stable'
    },
    {
      id: 'chrome-beta',
      name: 'Chrome Beta'
    },
    /**{
      id: 'chromium',
      name: 'Latest Chromium Build'
    }**/
  ];

  var browserDrivers = [];
  firefoxBrowsersToTest.forEach(function(browserInfo) {
    browserInfo.getBrowserDriver = function() {
      return firefoxBrowsers.getBrowserDriver(browserInfo.id);
    }
    browserDrivers.push(browserInfo);
  });

  if (process.env.TRAVIS_OS_NAME !== 'osx') {
    chromeBrowsersToTest.forEach(function(browserInfo) {
      browserInfo.getBrowserDriver = function() {
        return chromeBrowsers.getBrowserDriver(browserInfo.id, 'http://127.0.0.1:' + globalServer.port);
      }
      browserDrivers.push(browserInfo);
    });
  }

  browserDrivers.forEach(function(browserInfo) {
    test('send/receive notification without payload with ' + browserInfo.name, function() {
      return runTest(browserInfo.getBrowserDriver);
    });

    test('send/receive notification with payload with ' + browserInfo.name, function() {
      return runTest(browserInfo.getBrowserDriver, {
        payload: 'marco'
      });
    });

    test('send/receive notification with vapid with ' + browserInfo.name, function() {
      return runTest(browserInfo.getBrowserDriver, {
        vapid: VAPID_PARAM
      });
    });

    test('send/receive notification with payload & vapid with ' + browserInfo.name, function() {
      return runTest(browserInfo.getBrowserDriver, {
        payload: 'marco',
        vapid: VAPID_PARAM,
      });
    });
  });
});
