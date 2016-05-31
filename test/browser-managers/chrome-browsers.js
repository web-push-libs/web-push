var fs = require('fs');
var path = require('path');
var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var which = require('which');

var seleniumInit = require('../selenium-init');

function ChromeBrowsers() {
  var chromeStablePath;
  if (process.platform === 'linux') {
    chromeStablePath = which.sync('google-chrome');
  } else if (process.platform === 'darwin') {
    chromeStablePath = '/Applications/Google Chrome.app/' +
      'Contents/MacOS/Google Chrome';
  }

  var chromeBetaPath;
  if (process.platform === 'linux') {
    chromeBetaPath = which.sync('google-chrome-beta');
  } else if (process.platform === 'darwin') {
    chromeBetaPath = '/Applications/Google Chrome Beta.app/' +
      'Contents/MacOS/Google Chrome Beta';
  }

  var chromiumPath
  if (process.platform === 'linux') {
    chromiumPath = 'test_tools/chrome-linux/chrome';
  } else if (process.platform === 'darwin') {
    chromiumPath = 'test_tools/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
  }

  this.downloadBrowsers = function() {
    return Promise.all([
      seleniumInit.downloadChromiumNightly(),
      seleniumInit.downloadChromeDriver(),
    ]);
  }

  this.getBrowserDriver = function(browserId, testServerURL) {
    var chromeBinaryPath;
    switch(browserId) {
      case 'chrome':
        chromeBinaryPath = chromeStablePath;
        break;
      case 'chrome-beta':
        chromeBinaryPath = chromeBetaPath;
        break;
      case 'chromium':
        chromeBinaryPath = chromiumPath;
        break;
      default:
        throw new Error('Unable to find browser with ID: ' + browserId);
        break;
    }

    if (chromeBinaryPath) {
      chromeBinaryPath = path.resolve(chromeBinaryPath);
    }

    if (!fs.existsSync(chromeBinaryPath)) {
      throw new Error('Chrome binary doesn\'t exist at ' + chromeBinaryPath + '. Use your installed Chrome binary by setting the CHROME environment'.bold.red);
    }

    try {
      console.log('Using Chromium: ' + chromeBinaryPath);
      console.log('Version: ' + childProcess.execSync(chromeBinaryPath + ' --version').toString().replace('\n', ''));
    } catch (e) {}


    const chromePreferences = {
      profile: {
        content_settings: {
          exceptions: {
            notifications: {}
          }
        }
      }
    };
    chromePreferences.profile.content_settings.exceptions.notifications[testServerURL + ',*'] = {
      setting: 1
    };
    var chromeOptions = new chrome.Options()
      .setChromeBinaryPath(chromeBinaryPath)
      .setUserPreferences(chromePreferences);

    return new webdriver.Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .buildAsync();
  }
}

module.exports = new ChromeBrowsers();
