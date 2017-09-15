'use strict';

const seleniumAssistant = require('selenium-assistant');

const MAX_RETRIES = 3;
let forceDownload = false;
if (process.env.TRAVIS) {
  forceDownload = true;
}

const downloadBrowser = (name, version, attempt) => {
  return new Promise((resolve, reject) => {
    seleniumAssistant.downloadBrowser(name, version, forceDownload)
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
}

const promises = [
  downloadBrowser('firefox', 'stable', 0),
  downloadBrowser('firefox', 'beta', 0),
  downloadBrowser('firefox', 'unstable', 0),
  downloadBrowser('chrome', 'stable', 0),
  downloadBrowser('chrome', 'beta', 0),
  downloadBrowser('chrome', 'unstable', 0)
];

Promise.all(promises)
.then(function() {
  console.log('Download complete.');
})
.catch(function(err) {
  console.error('Unable to download browsers.', err);
  process.exit(1);
});
