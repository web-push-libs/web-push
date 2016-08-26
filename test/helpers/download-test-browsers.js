'use strict';

(function() {
  const invalidNodeVersions = /0.(10|12).(\d+)/;
  if (process.versions.node.match(invalidNodeVersions)) {
    console.log('Skipping downloading browsers as selenium tests can\'t run on ' + process.versions.node);
    return null;
  }

  /* eslint-disable global-require*/
  const seleniumAssistant = require('selenium-assistant');
  /* eslint-enable global-require*/

  let forceDownload = false;
  if (process.env.TRAVIS) {
    forceDownload = true;
  }

  const promises = [
    seleniumAssistant.downloadFirefoxDriver()
    .catch(function(err) {
      console.error('Firefox Driver Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('firefox', 'stable', forceDownload)
    .catch(function(err) {
      console.error('Firefox Stable Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('firefox', 'beta', forceDownload)
    .catch(function(err) {
      console.error('Firefox Beta Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('firefox', 'unstable', forceDownload)
    .catch(function(err) {
      console.error('Firefox Unstable Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('chrome', 'stable', forceDownload)
    .catch(function(err) {
      console.error('Chrome Stable Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('chrome', 'beta', forceDownload)
    .catch(function(err) {
      console.error('Chrome Beta Download Error: ', err);
    }),
    seleniumAssistant.downloadBrowser('chrome', 'unstable', forceDownload)
    .catch(function(err) {
      console.error('Chrome Unstable Download Error: ', err);
    })
  ];

  return Promise.all(promises)
  .then(function() {
    console.log('Download complete.');
  });
})();
