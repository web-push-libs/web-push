var fs      = require('fs');
var server  = require('./server');

if (process.argv.length < 3 || !fs.existsSync(process.argv[2])) {
  throw new Error('The third argument should be the path to firefox-bin');
}

var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until;

var firefox = require('selenium-webdriver/firefox');

var profile = new firefox.Profile();
profile.acceptUntrustedCerts();
profile.setPreference('security.turn_off_all_security_so_that_viruses_can_take_over_this_computer', true);

var firefoxBinary = new firefox.Binary(process.argv[2]);

var firefoxOptions = new firefox.Options().setProfile(profile).setBinary(firefoxBinary);

var driver = new webdriver.Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(firefoxOptions)
  .build();

driver.wait(function() {
  return server.listening;
});
driver.executeScript(function() {
  netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
  Components.utils.import('resource://gre/modules/Services.jsm');
  var uri = Services.io.newURI('https://127.0.0.1:50005', null, null);
  var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
  Services.perms.addFromPrincipal(principal, 'push', Services.perms.ALLOW_ACTION);
});
/*
This currently doesn't work in Firefox Nightly.
driver.get('https://127.0.0.1:50005');
*/
driver.executeScript(function() {
  window.location = 'https://127.0.0.1:50005';
});
driver.sleep(5000);
driver.wait(until.titleIs('marco'), 5000);
driver.quit().then(function() {
  server.close();
});
