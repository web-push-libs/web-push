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

if (process.platform !== 'linux' && process.platform !== 'darwin') {
  throw new Error('Platform ' + process.platform + ' not supported.');
}

if (process.arch !== 'x86' && process.arch !== 'x64') {
  throw new Error('Architecture ' + process.arch + ' not supported.');
}

// Download Firefox Nightly

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

request(firefoxBaseURL + 'test_packages.json', function(error, response, body) {
  if (error) {
    console.error(error);
    return;
  }

  var obj = JSON.parse(body);

  var version = Number(obj.mochitest[0].substr(8, 2));

  if (version > firefoxVersion) {
    fs.writeFileSync(firefoxVersionFile, version, 'utf8');
    if (firefoxVersion !== -Infinity) {
      fs.unlinkSync(path.join(destDir, util.format(firefoxFileNameFmt, firefoxVersion)));
    }
  }

  var firefoxFileName = util.format(firefoxFileNameFmt, version, firefoxPlatform);

  var firefoxURL = firefoxBaseURL + firefoxFileName;

  wget(destDir, firefoxURL).then(function() {
    if (process.platform === 'linux') {
      untar(destDir, path.join(destDir, firefoxFileName));
    } else if (process.platform === 'darwin') {
      dmg.mount(path.join(destDir, firefoxFileName), function(err, extractedPath) {
        fse.copySync(path.join(extractedPath, 'FirefoxNightly.app'), path.join(destDir, 'FirefoxNightly.app'));
        dmg.unmount(extractedPath, function() {});
      });
    }
  });
});

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

var chromeVersionFile = path.join(destDir, 'chromeVersion');
var chromeVersion = -Infinity;
if (fs.existsSync(chromeVersionFile)) {
  chromeVersion = Number(fs.readFileSync(chromeVersionFile, 'utf8'));
}

wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/' + chromePlatform + '%2FLAST_CHANGE?alt=media').then(function() {
  var newVersion = Number(fs.readFileSync(path.join(destDir, chromePlatform + '%2FLAST_CHANGE?alt=media'), 'utf8'));
  fs.renameSync(path.join(destDir, chromePlatform + '%2FLAST_CHANGE?alt=media'), chromeVersionFile);
  if (newVersion > chromeVersion) {
    fse.removeSync('test_tools/chrome-' + chromeZipPlatform);
    wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media').then(function() {
      unzip(destDir, 'test_tools/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media').then(function() {
        fs.unlink('test_tools/' + chromePlatform + '%2F' + newVersion + '%2Fchrome-' + chromeZipPlatform + '.zip?alt=media');
      });
    });
  }
});

// Download ChromeDriver

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

wget(destDir, 'http://chromedriver.storage.googleapis.com/LATEST_RELEASE').then(function() {
  var version = fs.readFileSync(path.join(destDir, 'LATEST_RELEASE'), 'utf8');
  wget(destDir, 'http://chromedriver.storage.googleapis.com/' + version + '/chromedriver_' + chromeDriverPlatform + '.zip').then(function() {
    unzip(destDir, 'test_tools/chromedriver_' + chromeDriverPlatform + '.zip');
  });
});
