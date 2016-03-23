var assert = require('assert');
var fs = require('fs');
var path = require('path');
var fse = require('fs-extra');
var temp = require('temp').track();
var colors = require('colors');
var semver = require('semver');
var childProcess = require('child_process');
var seleniumInit = require('./selenium-init');
var webPush = require('../index.js');

if (!process.env.GCM_API_KEY) {
  console.log('You need to set the GCM_API_KEY env variable to run the tests with Chromium.'.bold.red);
}

suite('selenium', function() {
  if (semver.satisfies(process.version, '0.12')) {
    console.log('selenium-webdriver is incompatible with Node.js v0.12');
    return;
  }

  this.timeout(180000);

  var firefoxStableBinaryPath, firefoxBetaBinaryPath, chromeBinaryPath;

  process.env.PATH = process.env.PATH + ':test_tools/';

  var createServer = require('./server');

  var server;
  function startServer(pushPayload, pushTimeout, vapid) {
    return createServer(pushPayload, pushTimeout ? pushTimeout : 0, vapid)
    .then(function(newServer) {
      server = newServer;
    });
  }

  var webdriver = require('selenium-webdriver'),
      By = require('selenium-webdriver').By,
      until = require('selenium-webdriver').until;

  var firefox = require('selenium-webdriver/firefox');
  var chrome = require('selenium-webdriver/chrome');

  var profilePath = temp.mkdirSync('marco');

  var driver;

  function startBrowser(firefoxBinaryPath) {
    var profile = new firefox.Profile(profilePath);
    profile.acceptUntrustedCerts();
    profile.setPreference('security.turn_off_all_security_so_that_viruses_can_take_over_this_computer', true);
    profile.setPreference('extensions.checkCompatibility.nightly', false);
    // Only allow installation of third-party addons from the user's profile dir (needed to block the third-party
    // installation prompt for the Ubuntu Modifications addon on Ubuntu).
    profile.setPreference('extensions.enabledScopes', 1);
    //profile.setPreference('dom.push.debug', true);
    //profile.setPreference('browser.dom.window.dump.enabled', true);

    var firefoxBinary = new firefox.Binary(firefoxBinaryPath);

    var firefoxOptions = new firefox.Options().setProfile(profile).setBinary(firefoxBinary);

    var chromeOptions = new chrome.Options()
      .setChromeBinaryPath(chromeBinaryPath)
      .addArguments('--no-sandbox')
      .addArguments('user-data-dir=' + profilePath);

    var builder = new webdriver.Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions);
    var driver = builder.build();

    driver.executeScript(function(port) {
      if (typeof netscape !== 'undefined') {
        netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
        Components.utils.import('resource://gre/modules/Services.jsm');
        var uri = Services.io.newURI('https://127.0.0.1:' + port, null, null);
        var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
        Services.perms.addFromPrincipal(principal, 'desktop-notification', Services.perms.ALLOW_ACTION);
      }
    }, server.port);

    driver.get('https://127.0.0.1:' + server.port);

    driver.executeScript(function(port) {
      serverAddress = 'https://127.0.0.1:' + port;
      go();
    }, server.port);

    return driver;
  }

  function checkEnd(driver, pushPayload) {
    return driver.wait(until.titleIs(pushPayload ? pushPayload : 'no payload'), 60000);
  }

  function noRestartTest(browser, firefoxBinaryPath, pushPayload, pushTimeout, vapid) {
    process.env.SELENIUM_BROWSER = browser;

    return startServer(pushPayload, pushTimeout, vapid)
    .then(function() {
      driver = startBrowser(firefoxBinaryPath);
      return checkEnd(driver, pushPayload)
    });
  }

  suiteSetup(function() {
    this.timeout(0);

    var promises = [];

    firefoxBinaryPath = process.env.FIREFOX;
    if (firefoxBinaryPath === 'nightly') {
      if (process.platform === 'linux') {
        firefoxBinaryPath = 'test_tools/firefox/firefox-bin';
      } else if (process.platform === 'darwin') {
        firefoxBinaryPath = 'test_tools/FirefoxNightly.app/Contents/MacOS/firefox-bin';
      }

      promises.push(seleniumInit.downloadFirefoxNightly());
    } else if (firefoxBinaryPath === 'all') {
      if (process.platform === 'linux') {
        firefoxBinaryPath = 'test_tools/stable/firefox/firefox-bin';
      } else if (process.platform === 'darwin') {
        firefoxBinaryPath = 'test_tools/stable/Firefox.app/Contents/MacOS/firefox-bin';
      }

      promises.push(seleniumInit.downloadFirefoxRelease());

      if (process.platform === 'linux') {
        firefoxBetaBinaryPath = 'test_tools/beta/firefox/firefox-bin';
      } else if (process.platform === 'darwin') {
        firefoxBetaBinaryPath = 'test_tools/beta/Firefox.app/Contents/MacOS/firefox-bin';
      }

      promises.push(seleniumInit.downloadFirefoxBeta());
    }

    try {
      console.log('Using Firefox: ' + firefoxBinaryPath);
      console.log('Version: ' + childProcess.execSync(firefoxBinaryPath + ' --version'));
      console.log('Beta Version: ' + childProcess.execSync(firefoxBetaBinaryPath + ' --version'));
    } catch (e) {}

    if (process.env.GCM_API_KEY) {
      chromeBinaryPath = process.env.CHROME;
      if (!chromeBinaryPath || chromeBinaryPath === 'nightly') {
        if (process.platform === 'linux') {
          chromeBinaryPath = 'test_tools/chrome-linux/chrome';
        } else if (process.platform === 'darwin') {
          chromeBinaryPath = 'test_tools/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
        }

        promises.push(seleniumInit.downloadChromiumNightly());
      } else if (chromeBinaryPath === 'stable') {
        // TODO: Download Chromium release.
        chromeBinaryPath = childProcess.execSync('which chromium-browser').toString().replace('\n', '');
      }

      promises.push(seleniumInit.downloadChromeDriver());

      try {
        console.log('Using Chromium: ' + chromeBinaryPath);
        console.log('Version: ' + childProcess.execSync(chromeBinaryPath + ' --version'));
      } catch (e) {}
    }

    return Promise.all(promises)
    .then(function() {
      if (!fs.existsSync(firefoxBinaryPath)) {
        throw new Error('Firefox binary doesn\'t exist at ' + firefoxBinaryPath + '. Use your installed Firefox binary by setting the FIREFOX environment'.bold.red);
      }

      if (firefoxBetaBinaryPath && !fs.existsSync(firefoxBetaBinaryPath)) {
        throw new Error('Firefox binary doesn\'t exist at ' + firefoxBetaBinaryPath + '.'.bold.red);
      }

      if (process.env.GCM_API_KEY && !fs.existsSync(chromeBinaryPath)) {
        throw new Error('Chrome binary doesn\'t exist at ' + chromeBinaryPath + '. Use your installed Chrome binary by setting the CHROME environment'.bold.red);
      }
    });
  });

  teardown(function(done) {
    driver.quit()
    .catch(function() {})
    .then(function() {
      server.close(function() {
        done();
      });
    });
  });

  var vapidKeys = webPush.generateVAPIDKeys();
  var vapidParam = {
    audience: 'https://www.mozilla.org/',
    subject: 'mailto:web-push@mozilla.org',
    privateKey: vapidKeys.privateKey,
    publicKey: vapidKeys.publicKey,
  };

  test('send/receive notification without payload with Firefox Release', function() {
    return noRestartTest('firefox', firefoxBinaryPath);
  });

  test('send/receive notification without payload with Firefox Beta', function() {
    return noRestartTest('firefox', firefoxBetaBinaryPath);
  });

  if (process.env.GCM_API_KEY && process.env.TRAVIS_OS_NAME !== 'osx') {
    test('send/receive notification without payload with Chrome', function() {
      return noRestartTest('chrome');
    });
  }

  test('send/receive notification with payload with Firefox Release', function() {
    return noRestartTest('firefox', firefoxBinaryPath, 'marco');
  });

  test('send/receive notification with payload with Firefox Beta', function() {
    return noRestartTest('firefox', firefoxBetaBinaryPath, 'marco');
  });

  if (process.env.GCM_API_KEY && process.env.TRAVIS_OS_NAME !== 'osx') {
    test('send/receive notification with payload with Chrome', function() {
      return noRestartTest('chrome', undefined, 'marco');
    });
  }

  test('send/receive notification with vapid with Firefox Release', function() {
    return noRestartTest('firefox', firefoxBinaryPath, undefined, vapidParam);
  });

  test('send/receive notification with vapid with Firefox Beta', function() {
    return noRestartTest('firefox', firefoxBetaBinaryPath, undefined, vapidParam);
  });

  if (process.env.GCM_API_KEY && process.env.TRAVIS_OS_NAME !== 'osx') {
    test('send/receive notification with vapid with Chrome', function() {
      return noRestartTest('chrome', undefined, undefined, vapidParam);
    });
  }

  test('send/receive notification with payload & vapid with Firefox Beta', function() {
    return noRestartTest('firefox', firefoxBetaBinaryPath, 'marco', vapidParam);
  });

  if (process.env.GCM_API_KEY && process.env.TRAVIS_OS_NAME !== 'osx') {
    test('send/receive notification with payload & vapid with Chrome', function() {
      return noRestartTest('chrome', undefined, 'marco', vapidParam);
    });
  }
});
