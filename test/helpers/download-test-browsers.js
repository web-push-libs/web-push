'use strict';

(function() {
  /* eslint-disable global-require*/
  const seleniumAssistant = require('selenium-assistant');
  /* eslint-enable global-require*/

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

  return Promise.all(promises)
  .then(function() {
    console.log('Download complete.');
  })
  .catch(function(err) {
    console.error('Unable to download browsers.', err);
    process.exit(1);
  });
})();
