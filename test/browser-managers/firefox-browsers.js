var fs = require('fs');
var path = require('path');
var webdriver = require('selenium-webdriver');
var firefox = require('selenium-webdriver/firefox');

var seleniumInit = require('../selenium-init');

function FirefoxBrowsers() {
  var firefoxStableBinaryPath;
  if (process.platform === 'linux') {
    firefoxStableBinaryPath = 'test_tools/stable/firefox/firefox-bin';
  } else if (process.platform === 'darwin') {
    firefoxStableBinaryPath = 'test_tools/stable/Firefox.app/Contents/MacOS/firefox-bin';
  }

  var firefoxNightlyBinaryPath;
  if (process.platform === 'linux') {
    firefoxNightlyBinaryPath = 'test_tools/firefox/firefox-bin';
  } else if (process.platform === 'darwin') {
    firefoxNightlyBinaryPath = 'test_tools/FirefoxNightly.app/Contents/MacOS/firefox-bin';
  }

  /*if (process.platform === 'linux') {
    firefoxAuroraBinaryPath = 'test_tools/aurora/firefox/firefox-bin';
  } else if (process.platform === 'darwin') {
    firefoxAuroraBinaryPath = 'test_tools/aurora/Firefox.app/Contents/MacOS/firefox-bin';
  }**/

  /*if (process.platform === 'linux') {
    firefoxBetaBinaryPath = 'test_tools/beta/firefox/firefox-bin';
  } else if (process.platform === 'darwin') {
    firefoxBetaBinaryPath = 'test_tools/beta/Firefox.app/Contents/MacOS/firefox-bin';
  }**/

  /*if (firefoxBetaBinaryPath && !fs.existsSync(firefoxBetaBinaryPath)) {
    throw new Error('Firefox binary doesn\'t exist at ' + firefoxBetaBinaryPath + '.'.bold.red);
  }*/

  this.downloadBrowsers = function() {
    return seleniumInit.downloadFirefoxRelease();
    // promises.push(seleniumInit.downloadFirefoxBeta());
    // promises.push(seleniumInit.downloadFirefoxAurora());
    // promises.push(seleniumInit.downloadFirefoxNightly());
  }

  this.getBrowserDriver = function(browserId) {
    var firefoxBinaryPath;
    switch(browserId) {
      case 'firefox':
        firefoxBinaryPath = firefoxStableBinaryPath;
        break
      case 'firefox-beta':
        firefoxBinaryPath = firefoxBetaBinaryPath;
        break;
      case 'firefox-aurora':
        firefoxBinaryPath = firefoxAuroraBinaryPath;
        process.env.SELENIUM_MARIONETTE = true;
        break;
      default:
        throw new Error('Unable to find browser with ID: ' + browserId);
        break;
    }

    if (firefoxBinaryPath) {
      firefoxBinaryPath = path.resolve(firefoxBinaryPath);
    }

    if (!fs.existsSync(firefoxBinaryPath)) {
      throw new Error('Firefox binary doesn\'t exist at ' + firefoxBinaryPath + '. Use your installed Firefox binary by setting the FIREFOX environment'.bold.red);
    }

    try {
      console.log('Using Firefox: ' + firefoxBinaryPath);
      console.log('Version: ' + childProcess.execSync(firefoxBinaryPath + ' --version').toString().replace('\n', ''));
    } catch (e) {}

    var profile = new firefox.Profile();
    profile.setPreference('security.turn_off_all_security_so_that_viruses_can_take_over_this_computer', true);
    profile.setPreference('extensions.checkCompatibility.nightly', false);
    // Only allow installation of third-party addons from the user's profile dir (needed to block the third-party
    // installation prompt for the Ubuntu Modifications addon on Ubuntu).
    profile.setPreference('extensions.enabledScopes', 1);
    //profile.setPreference('dom.push.debug', true);
    //profile.setPreference('browser.dom.window.dump.enabled', true);

    var firefoxBinary = new firefox.Binary(firefoxBinaryPath);
    var firefoxOptions = new firefox.Options().setProfile(profile)
      .setBinary(firefoxBinary);

    return new webdriver.Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(firefoxOptions)
      .buildAsync();
  }
}

module.exports = new FirefoxBrowsers();
