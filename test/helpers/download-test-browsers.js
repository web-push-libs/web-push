'use strict';

const seleniumAssistant = require('selenium-assistant');

const MAX_RETRIES = 3;
let expiration;
if (process.env.TRAVIS) {
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

const promises = [
  downloadBrowser('firefox', 'stable'),
  downloadBrowser('firefox', 'beta'),
  downloadBrowser('firefox', 'unstable'),
  downloadBrowser('chrome', 'stable'),
  downloadBrowser('chrome', 'beta'),
  downloadBrowser('chrome', 'unstable')
];

Promise.all(promises)
.then(function() {
  console.log('Download complete.');
})
.catch(function(err) {
  console.error('Unable to download browsers.', err);
  process.exit(1);
});
