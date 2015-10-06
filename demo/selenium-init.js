var util = require('util');
var fs   = require('fs');
var path = require('path');
var child_process = require('child_process');
var request = require('request');
var fse = require('fs-extra');

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

// Download Firefox Nightly

var firefoxVersionFile = path.join(destDir, 'firefoxVersion');
var firefoxVersion = -Infinity;
if (fs.existsSync(firefoxVersionFile)) {
  firefoxVersion = Number(fs.readFileSync(firefoxVersionFile, 'utf8'));
}
var firefoxFileNameFmt = 'firefox-%d.0a1.en-US.linux-x86_64.tar.bz2';
var firefoxBaseURL = 'https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/';

request(firefoxBaseURL + 'test_packages.json', function(error, response, body) {
  if (error) {
    console.error(error);
    return;
  }

  var obj = JSON.parse(body);

  var version = Number(obj.mochitest[0].substr(8, 2));

  if (version > firefoxVersion) {
    fs.writeFileSync(firefoxVersionFile, version, 'utf8');
    fs.unlinkSync(path.join(destDir, util.format(firefoxFileNameFmt, firefoxVersion)));
  }

  var firefoxFileName = util.format(firefoxFileNameFmt, version);

  var firefoxURL = firefoxBaseURL + firefoxFileName;

  wget(destDir, firefoxURL).then(function() {
    untar(destDir, path.join(destDir, firefoxFileName));
  });
});

// Download Chrome Canary

var chromeVersionFile = path.join(destDir, 'chromeVersion');
var chromeVersion = -Infinity;
if (fs.existsSync(chromeVersionFile)) {
  chromeVersion = Number(fs.readFileSync(chromeVersionFile, 'utf8'));
}

wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2FLAST_CHANGE?alt=media').then(function() {
  var newVersion = Number(fs.readFileSync(path.join(destDir, 'Linux_x64%2FLAST_CHANGE?alt=media'), 'utf8'));
  fs.renameSync(path.join(destDir, 'Linux_x64%2FLAST_CHANGE?alt=media'), chromeVersionFile);
  if (newVersion > chromeVersion) {
    fse.removeSync('test_tools/chrome-linux');
    wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2F' + newVersion + '%2Fchrome-linux.zip?alt=media').then(function() {
      unzip(destDir, 'test_tools/Linux_x64%2F' + newVersion + '%2Fchrome-linux.zip?alt=media').then(function() {
        fs.unlink('test_tools/Linux_x64%2F' + newVersion + '%2Fchrome-linux.zip?alt=media');
      });
    });
  }
});

try {
  if (!fs.existsSync('/etc/chromium/policies/managed/test_policy.json')) {
    fse.mkdirsSync('/etc/chromium/policies/managed');
    fse.mkdirsSync('/etc/chromium/policies/recommended');
    fse.writeJSONSync('/etc/chromium/policies/managed/test_policy.json', { 'DefaultNotificationsSetting': 1 });
  }
} catch (e) {
  if (e.code === 'EACCES') {
    console.error('You might need to run this script with sudo.');
  }
  throw e;
}

// Download ChromeDriver

wget(destDir, 'http://chromedriver.storage.googleapis.com/LATEST_RELEASE').then(function() {
  var version = fs.readFileSync(path.join(destDir, 'LATEST_RELEASE'), 'utf8');
  wget(destDir, 'http://chromedriver.storage.googleapis.com/' + version + '/chromedriver_linux64.zip').then(function() {
    unzip(destDir, 'test_tools/chromedriver_linux64.zip');
  });
});
