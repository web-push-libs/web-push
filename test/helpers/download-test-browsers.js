(function() {
  var invalidNodeVersions = /0.(10|12).(\d+)/;
  if (process.versions.node.match(invalidNodeVersions)) {
    console.log('Skipping downloading browsers as selenium tests can\'t run on ' + process.versions.node);
    return;
  }

  const seleniumAssistant = require('selenium-assistant');

  const promises = [
    seleniumAssistant.downloadFirefoxDriver(),
    seleniumAssistant.downloadBrowser('firefox', 'stable'),
    seleniumAssistant.downloadBrowser('firefox', 'beta'),
    seleniumAssistant.downloadBrowser('firefox', 'unstable'),
    seleniumAssistant.downloadBrowser('chrome', 'stable'),
    seleniumAssistant.downloadBrowser('chrome', 'beta'),
    seleniumAssistant.downloadBrowser('chrome', 'unstable')
  ];

  Promise.all(promises)
  .then(function() {
    console.log('Download complete.');
  });
})();
