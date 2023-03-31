'use strict';

const os = require('os');
const seleniumAssistant = require('selenium-assistant');

const MAX_RETRIES = 3;
let expiration;
if (process.env.CI) {
  expiration = 0;
}

const downloadBrowser = (name, version, attempt) => {
  attempt = attempt || 0;

  return new Promise((resolve, reject) => {
    seleniumAssistant.downloadLocalBrowser(name, version, expiration)
    .catch((err) => {
      if (attempt < MAX_RETRIES) {
        console.log(`Attempt ${attempt + 1} of browser ${name} - ${version} failed.`);
        return downloadBrowser(name, version, attempt + 1);
      }

      return reject(err);
    })
    .then(() => {
      console.log(`Successfully downloaded ${name} - ${version}.`);
      resolve();
    });
  });
};

let promises = [
  downloadBrowser('firefox', 'stable'),
  downloadBrowser('firefox', 'beta'),
  downloadBrowser('firefox', 'unstable')
];

// TODO: Temporarily disable downloading Chrome on Mac because of the following error on CI:
// > Error: Command failed: hdiutil mount -nobrowse "/Users/runner/.selenium-assistant/google-chrome-unstable.dmg"
// > hdiutil: mount failed - image not recognized
if (os.platform() !== 'darwin') {
  promises = [
    ...promises,
    downloadBrowser('chrome', 'stable'),
    downloadBrowser('chrome', 'beta'),
    downloadBrowser('chrome', 'unstable')
  ];
}

Promise.all(promises)
.then(function() {
  console.log('Download complete.');
})
.catch(function(err) {
  console.error('Unable to download browsers.', err);
  process.exit(1);
});
