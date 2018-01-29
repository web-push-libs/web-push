'use strict';

(function() {
  const invalidNodeVersions = /0.(10|12).(\d+)/;
  if (process.versions.node.match(invalidNodeVersions)) {
    console.log('Skipping CLI tests as they can\'t run on node: ' + process.versions.node);
    return;
  }

  const assert = require('assert');
  const urlBase64 = require('urlsafe-base64');
  const spawn = require('child_process').spawn;

  const cliPath = 'src/cli.js';

  suite('Test CLI', function() {
    test('no args run', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath
        ]);
        let errorData = '';
        let consoleOutput = '';
        webpushCLISpawn.stdout.on('data', function(data) {
          consoleOutput += data;
        });

        webpushCLISpawn.stderr.on('data', function(data) {
          errorData += data;
        });

        webpushCLISpawn.on('close', function(code) {
          // No args should have code 1
          assert(code, 1);

          assert.equal(errorData, '');
          assert.notEqual(consoleOutput.indexOf('web-push send-notification'), -1);
          assert.notEqual(consoleOutput.indexOf('web-push generate-vapid-keys'), -1);
          resolve();
        });
      });
    });

    test('test send-notification no args', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath,
          'send-notification'
        ]);

        webpushCLISpawn.on('close', function(code) {
          // No args should have code 1
          assert.equal(code, 1);
          resolve();
        });
      });
    });

    test('test send-notification only endpoint', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath,
          'send-notification',
          '--endpoint=https://example.push-service.com/'
        ]);

        let errorData = '';
        let consoleOutput = '';
        webpushCLISpawn.stdout.on('data', function(data) {
          consoleOutput += data;
        });

        webpushCLISpawn.stderr.on('data', function(data) {
          errorData += data;
        });

        webpushCLISpawn.on('close', function(code) {
          assert.equal(code, 0);
          assert.equal(errorData, '');
          assert.equal(consoleOutput.indexOf('Error sending push message: '), 0);
          resolve();
        });
      });
    });

    test('test send-notification all options', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath,
          'send-notification',
          '--endpoint=https://example.push-service.com/',
          '--key=browser-key',
          '--auth=auth',
          '--payload=hello',
          '--ttl=1234',
          '--encoding=aesgcm',
          '--vapid-subject=http://example.push-serice.com/contact',
          '--vapid-pubkey=vapid-publicKey',
          '--vapid-pvtkey=vapid-privateKey',
          '--gcm-api-key=qwerty'
        ]);

        let errorData = '';
        let consoleOutput = '';
        webpushCLISpawn.stdout.on('data', function(data) {
          consoleOutput += data;
        });

        webpushCLISpawn.stderr.on('data', function(data) {
          errorData += data;
        });

        webpushCLISpawn.on('close', function(code) {
          assert.equal(code, 0);
          assert.equal(errorData, '');
          assert.equal(consoleOutput.indexOf('Error sending push message: '), 0);
          resolve();
        });
      });
    });

    test('test generate vapid keys', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath,
          'generate-vapid-keys'
        ]);

        let errorData = '';
        let consoleOutput = '';
        webpushCLISpawn.stdout.on('data', function(data) {
          consoleOutput += data;
        });

        webpushCLISpawn.stderr.on('data', function(data) {
          errorData += data;
        });

        webpushCLISpawn.on('close', function(code) {
          assert.equal(code, 0);
          assert.equal(errorData, '');
          assert.notEqual(consoleOutput.indexOf('Public Key:'), -1);
          assert.notEqual(consoleOutput.indexOf('Private Key:'), -1);

          const lines = consoleOutput.split('\n');
          const publicKeyTitleIndex = lines.findIndex(function(line) {
            return line.indexOf('Public Key:') !== -1;
          });
          const publicKey = lines[publicKeyTitleIndex + 1].trim();
          assert.equal(urlBase64.decode(publicKey).length, 65);

          const privateKeyTitleIndex = lines.findIndex(function(line) {
            return line.indexOf('Private Key:') !== -1;
          });
          const privateKey = lines[privateKeyTitleIndex + 1].trim();
          assert.equal(urlBase64.decode(privateKey).length, 32);
          resolve();
        });
      });
    });

    test('test generate JSON vapid keys', function() {
      return new Promise(function(resolve) {
        const webpushCLISpawn = spawn('node', [
          cliPath,
          'generate-vapid-keys',
          '--json'
        ]);

        let errorData = '';
        let consoleOutput = '';
        webpushCLISpawn.stdout.on('data', function(data) {
          consoleOutput += data;
        });

        webpushCLISpawn.stderr.on('data', function(data) {
          errorData += data;
        });

        webpushCLISpawn.on('close', function(code) {
          assert.equal(code, 0);
          assert.equal(errorData, '');

          const vapidKeys = JSON.parse(consoleOutput);
          assert(vapidKeys.publicKey);
          assert(vapidKeys.privateKey);

          assert.equal(urlBase64.decode(vapidKeys.privateKey).length, 32);
          assert.equal(urlBase64.decode(vapidKeys.publicKey).length, 65);

          resolve();
        });
      });
    });
  });
})();
