var util = require('util');
var fs   = require('fs');
var path = require('path');
var child_process = require('child_process');

function spawnHelper(command, args) {
  return new Promise(function(resolve, reject) {
    var child = child_process.spawn(command, args);

    child.on('exit', function(code) {
      if (code === 0) {
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
// XXX: Automatically get the latest release!

var firefoxFileName = 'firefox-44.0a1.en-US.linux-x86_64.tar.bz2';
var firefoxURL = 'https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/' + firefoxFileName;

wget(destDir, firefoxURL).then(function() {
  untar(destDir, path.join(destDir, firefoxFileName));
});

// Download Chrome Canary

var chromeVersionFile = path.join(destDir, 'chromeVersion');
var chromeVersion = -Infinity;
if (fs.existsSync(chromeVersionFile)) {
  chromeVersion = Number(fs.readFileSync(chromeVersionFile, 'utf8'));
}

wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2FLAST_CHANGE?alt=media').then(function() {
  var newVersion = Number(fs.readFileSync(path.join(destDir, 'Linux_x64%2FLAST_CHANGE?alt=media'), 'utf8'));
  if (newVersion > chromeVersion) {
    fs.renameSync(path.join(destDir, 'Linux_x64%2FLAST_CHANGE?alt=media'), chromeVersionFile);
    wget(destDir, 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2F' + newVersion + '%2Fchrome-linux.zip?alt=media').then(function() {
      unzip(destDir, 'test_tools/Linux_x64%2F' + newVersion + '%2Fchrome-linux.zip?alt=media')
    });
  }
});

// Download ChromeDriver

wget(destDir, 'http://chromedriver.storage.googleapis.com/LATEST_RELEASE').then(function() {
  var version = fs.readFileSync(path.join(destDir, 'LATEST_RELEASE'), 'utf8');
  wget(destDir, 'http://chromedriver.storage.googleapis.com/' + version + '/chromedriver_linux64.zip').then(function() {
    unzip(destDir, 'chromedriver_linux64.zip');
  });
});
