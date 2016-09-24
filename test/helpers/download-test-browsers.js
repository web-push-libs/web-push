'use strict';

const seleniumAssistant = require('selenium-assistant');

let forceDownload = false;
if (process.env.TRAVIS) {
  forceDownload = true;
}

const promises = [
  seleniumAssistant.downloadBrowser('firefox', 'stable', forceDownload),
  seleniumAssistant.downloadBrowser('firefox', 'beta', forceDownload),
  seleniumAssistant.downloadBrowser('firefox', 'unstable', forceDownload),
  seleniumAssistant.downloadBrowser('chrome', 'stable', forceDownload),
  seleniumAssistant.downloadBrowser('chrome', 'beta', forceDownload),
  seleniumAssistant.downloadBrowser('chrome', 'unstable', forceDownload)
];

Promise.all(promises)
.then(function() {
  console.log('Download complete.');
})
.catch(function(err) {
  console.error('Unable to download browsers.', err);
  process.exit(1);
});
