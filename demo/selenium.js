var webPush = require('../index');
var https   = require('https');
var fs      = require('fs');
var path    = require('path');

var pem = fs.readFileSync('test/cert.pem');

var options = {
  key: pem,
  cert: pem,
};

var server = https.createServer(options, function(req, res) {
  if (req.method === 'GET') {
    if (req.url === '/') {
      req.url = '/index.html';
    }

    if (!fs.existsSync('demo' + req.url)) {
      res.writeHead(404);
      res.end(data);
      return;
    }

    var data = fs.readFileSync('demo' + req.url);

    res.writeHead(200, {
      'Content-Length': data.length,
      'Content-Type': path.extname(req.url) === '.html' ? 'text/html' : 'application/javascript',
    });

    res.end(data);
  } else {
    var body = '';

    req.on('data', function(chunk) {
      body += chunk;
    })

    req.on('end', function() {
      var obj = JSON.parse(body);
      webPush.sendNotification(obj.endpoint, obj.key, 'marco');
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    });

    res.end('ok');
  }
}).listen(50005);

var serverListening = false;
server.on('listening', function() {
  serverListening = true;
});

var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until;

var firefox = require('selenium-webdriver/firefox');

var profile = new firefox.Profile();
profile.acceptUntrustedCerts();
profile.setPreference('security.turn_off_all_security_so_that_viruses_can_take_over_this_computer', true);

var options = new firefox.Options().setProfile(profile);
var driver = new firefox.Driver(options);

driver.wait(function() {
  return serverListening;
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
})
