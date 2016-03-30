var util = require('util');
var fs   = require('fs');
var path = require('path');
var child_process = require('child_process');
var request = require('request');
var fse = require('fs-extra');
var dmg = require('dmg');

function spawnHelper(command, args) {
  return new Promise(function(resolve, reject) {
    var child = child_process.spawn(command, args);

    child.stdout.on('data', function(data) {
      process.stdout.write(data);
    });

    child.stderr.on('data', function(data) {
      process.stderr.write(data);
    });

    child.on('exit', function(code) {
      if (code === 0) {
        console.log('Done ' + command + ' with args: ' + args);
        resolve();
      } else {
        console.log('Error running ' + command + ' with args: ' + args);
        reject();
      }
    });
  });
  return
}

function wget(dir, url) {
  return spawnHelper('wget', [ '-P', dir, '-N', url ]);
}

function untar(dir, file) {
  return spawnHelper('tar', [ '-x', '-C', dir, '-f', file ]);
}

function unzip(dir, file) {
  return spawnHelper('unzip', [ '-o', '-d', dir, file ]);
}

var destDir = 'test_tools';
var stableDestDir = 'test_tools/stable';
var betaDestDir = 'test_tools/beta';
var auroraDestDir = 'test_tools/aurora';

try {
  fs.mkdirSync(destDir);
} catch (e) {
}

try {
  fs.mkdirSync(stableDestDir);
} catch (e) {
}

try {
  fs.mkdirSync(betaDestDir);
} catch (e) {
}

try {
  fs.mkdirSync(auroraDestDir);
} catch (e) {
}

if (process.platform !== 'linux' && process.platform !== 'darwin') {
  throw new Error('Platform ' + process.platform + ' not supported.');
}

if (process.arch !== 'x86' && process.arch !== 'x64') {
  throw new Error('Architecture ' + process.arch + ' not supported.');
}

function getFirefoxVersions() {
  function majorVersion(version) {
    return parseInt(version.substr(0, version.indexOf('.')), 10);
  }

  return new Promise(function(resolve, reject) {
    request('https://svn.mozilla.org/libs/product-details/json/firefox_versions.json', function(error, response, body) {
      if (error) {
        console.error(error);
        reject(error);
        return;
      }

      var obj = JSON.parse(body);

      resolve({
        release: majorVersion(obj.LATEST_FIREFOX_VERSION),
        nightly: majorVersion(obj.FIREFOX_AURORA) + 1,
      });
    });
  });
}

// Download Firefox Nightly

function downloadFirefoxNightly() {
  return new Promise(function(resolve, reject) {
    var firefoxVersionFile = path.join(destDir, 'firefoxVersion');
    var firefoxVersion = -Infinity;
    if (fs.existsSync(firefoxVersionFile)) {
      firefoxVersion = Number(fs.readFileSync(firefoxVersionFile, 'utf8'));
    }
    var firefoxFileNameFmt = 'firefox-%d.0a1.en-US.%s';
    var firefoxBaseURL = 'https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/';

    var firefoxPlatform;
    if (process.platform === 'linux') {
      firefoxPlatform = 'linux-';
      if (process.arch === 'x86') {
        firefoxPlatform += 'i686';
      } else if (process.arch === 'x64') {
        firefoxPlatform += 'x86_64';
      }
      firefoxPlatform += '.tar.bz2'
    } else if (process.platform === 'darwin') {
      firefoxPlatform = 'mac.dmg';
    }

    getFirefoxVersions()
    .then(function(versions) {
      var version = versions.nightly;

      if (version > firefoxVersion) {
        fs.writeFileSync(firefoxVersionFile, version, 'utf8');
        if (firefoxVersion !== -Infinity) {
          var firefoxOldFileName = util.format(firefoxFileNameFmt, firefoxVersion, firefoxPlatform);
          try {
            fs.unlinkSync(path.join(destDir, firefoxOldFileName));
          } catch (ex) {
            // Only ignore the error if it's a 'file not found' error.
            if (!ex.code || ex.code !== 'ENOENT') {
              reject(ex);
              return;
            }
          }
        }
      }

      var firefoxFileName = util.format(firefoxFileNameFmt, version, firefoxPlatform);

      var firefoxURL = firefoxBaseURL + firefoxFileName;

      wget(destDir, firefoxURL)
      .then(function() {
        if (process.platform === 'linux') {
          untar(destDir, path.join(destDir, firefoxFileName))
          .then(resolve);
        } else if (process.platform === 'darwin') {
          dmg.mount(path.join(destDir, firefoxFileName), function(err, extractedPath) {
            fse.copySync(path.join(extractedPath, 'FirefoxNightly.app'), path.join(destDir, 'FirefoxNightly.app'));
            dmg.unmount(extractedPath, resolve);
          });
        }
      });
    });
  });
}

function downloadFirefoxFromDMO(product, destDir) {
  return new Promise(function(resolve, reject) {
    var firefoxPlatform;
    if (process.platform === 'linux') {
      firefoxPlatform = 'linux';
      if (process.arch === 'x64') {
        firefoxPlatform += '64';
      }
    } else if (process.platform === 'darwin') {
      firefoxPlatform = 'osx';
    }

    function getFile() {
      var files = fs.readdirSync(destDir);
      return files.find(function(file) {
        return file.indexOf('index.html?') === 0;
      });
    }

    var fileName = 'index.html?product=' + product + '&lang=en-US&os=' + firefoxPlatform;

    wget(destDir, 'https://download.mozilla.org/?product=' + product + '&lang=en-US&os=' + firefoxPlatform)
    .then(function() {
      if (process.platform === 'linux') {
        untar(destDir, path.join(destDir, fileName))
        .then(resolve);
      } else if (process.platform === 'darwin') {
        dmg.mount(path.join(destDir, fileName), function(err, extractedPath) {
          fse.copySync(path.join(extractedPath, 'Firefox.app'), path.join(destDir, 'Firefox.app'));
          dmg.unmount(extractedPath, resolve);
        });
      }
    });
  });
}

// Download Firefox Release

function downloadFirefoxRelease() {
  return downloadFirefoxFromDMO('firefox-latest', stableDestDir);
}

function downloadFirefoxBeta() {
  return downloadFirefoxFromDMO('firefox-beta-latest', betaDestDir);
}

function downloadFirefoxAurora() {
  return downloadFirefoxFromDMO('firefox-aurora-latest', auroraDestDir);
}

// Download Chrome Canary

var chromePlatform, chromeZipPlatform;
if (process.platform === 'linux') {
  chromeZipPlatform = 'linux';
  chromePlatform = 'Linux_';
  if (process.arch === 'x86') {
    throw new Error('TODO');
  } else if (process.arch === 'x64') {
    chromePlatform += 'x64';
  }
} else if (process.platform === 'darwin') {
  chromeZipPlatform = 'mac';
  chromePlatform = 'Mac';
}

function downloadChromiumNightly() {
  var chromeVersionFile = path.join(destDir, 'chromeVersion');
  var chromeVersion = -Infinity;
  if (fs.existsSync(chromeVersionFile)) {
    chromeVersion = Number(fs.readFileSync(chromeVersionFile, 'utf8'));
  }

  return wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/' + chromePlatform + '%2FLAST_CHANGE?alt=media')
  .then(function() {
    var newVersion = Number(fs.readFileSync(path.join(destDir, chromePlatform + '%2FLAST_CHANGE?alt=media'), 'utf8'));
    fs.renameSync(path.join(destDir, chromePlatform + '%2FLAST_CHANGE?alt=media'), chromeVersionFile);
    if (newVersion > chromeVersion) {
      fse.removeSync('test_tools/chrome-' + chromeZipPlatform);
      return wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media')
      .then(function() {
        return unzip(destDir, 'test_tools/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media')
        .then(function() {
          fs.unlinkSync('test_tools/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media');
        });
      });
    }
  });
}

// Download ChromeDriver

function downloadChromeDriver() {
  var chromeDriverPlatform;
  if (process.platform === 'linux') {
    chromeDriverPlatform = 'linux';
    if (process.arch === 'x86') {
      chromeDriverPlatform += '32';
    } else if (process.arch === 'x64') {
      chromeDriverPlatform += '64';
    }
  } else if (process.platform === 'darwin') {
    chromeDriverPlatform = 'mac32';
  }

  return wget(destDir, 'http://chromedriver.storage.googleapis.com/LATEST_RELEASE')
  .then(function() {
    var version = fs.readFileSync(path.join(destDir, 'LATEST_RELEASE'), 'utf8').replace('\n', '');
    return wget(destDir, 'http://chromedriver.storage.googleapis.com/' + version + '/chromedriver_' + chromeDriverPlatform + '.zip')
    .then(function() {
      return unzip(destDir, 'test_tools/chromedriver_' + chromeDriverPlatform + '.zip');
    });
  });
}

module.exports = {
  downloadFirefoxNightly: downloadFirefoxNightly,
  downloadFirefoxRelease: downloadFirefoxRelease,
  downloadFirefoxBeta: downloadFirefoxBeta,
  downloadFirefoxAurora: downloadFirefoxAurora,
  downloadChromiumNightly: downloadChromiumNightly,
  downloadChromeDriver: downloadChromeDriver,
};
