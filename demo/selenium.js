var fs = require('fs');
var path = require('path');
var fse = require('fs-extra');
var temp = require('temp').track();

var firefoxBinaryPath = 'test_tools/firefox/firefox-bin';
if (!fs.existsSync(firefoxBinaryPath)) {
  throw new Error('Firefox binary doesn\'t exist at ' + firefoxBinaryPath);
}

var chromeBinaryPath = 'test_tools/chrome-linux/chrome';
if (!fs.existsSync(chromeBinaryPath)) {
  throw new Error('Chrome binary doesn\'t exist at ' + chromeBinaryPath);
}

process.env.PATH = 'test_tools/:' + process.env.PATH;

var server = require('./server');

server.pushTimeout = process.argv.length >= 3 ? Number(process.argv[2]) : 0;
server.pushPayload = process.argv.length >= 4 ? process.argv[3] : 0;

var pageLoaded = false;
var clientRegistered = 0;
server.onClientRegistered = function() {
  pageLoaded = true;
  clientRegistered++;
  return clientRegistered > 1;
}

var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until;

var firefox = require('selenium-webdriver/firefox');
var chrome = require('selenium-webdriver/chrome');

var profilePath = temp.mkdirSync('marco');

function startBrowser() {
  var profile = new firefox.Profile(profilePath);
  profile.acceptUntrustedCerts();
  profile.setPreference('security.turn_off_all_security_so_that_viruses_can_take_over_this_computer', true);
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

  driver.wait(function() {
    return server.listening;
  });
  driver.executeScript(function() {
    if (typeof netscape !== 'undefined') {
      netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
      Components.utils.import('resource://gre/modules/Services.jsm');
      var uri = Services.io.newURI('https://127.0.0.1:50005', null, null);
      var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
      Services.perms.addFromPrincipal(principal, 'desktop-notification', Services.perms.ALLOW_ACTION);
    }
  });
  /*
  This currently doesn't work in Firefox Nightly.
  driver.get('https://127.0.0.1:50005');
  */
  driver.executeScript(function() {
    window.location = 'https://127.0.0.1:50005';
  });
  driver.wait(function() {
    return pageLoaded;
  });

  return driver;
}

function checkEnd(driver) {
  driver.wait(until.titleIs(server.pushPayload ? server.pushPayload : 'no payload'), 60000);
  driver.quit().then(function() {
    console.log('Test completed.');
    server.close();
  });
}

if (server.pushTimeout) {
  var driver = startBrowser();

  function restart() {
    console.log('Browser - Restart');
    checkEnd(startBrowser());
  }

  driver.close().then(function() {
    console.log('Browser - Closed');

    pageLoaded = false;

    setTimeout(function() {
      try {
        // In Firefox, we need to copy the storage directory (because the PushDB is
        // stored in an IndexedDB) and the prefs.js file, which contains a preference
        // (dom.push.userAgentID) storing the User Agent ID.
        // We need to wait a bit before copying these files because Firefox updates
        // some of them when shutting down.
        [ 'storage', 'prefs.js' ].forEach(function(file) {
          fse.copySync(path.join(driver.profilePath_, file), path.join(profilePath, file));
        });
      } catch (e) {}

      if (server.notificationSent) {
        restart();
      } else {
        server.onNotificationSent = function() {
          server.onNotificationSent = null;
          restart();
        };
      }
    }, 1000);
  });
} else {
  checkEnd(startBrowser());
}
