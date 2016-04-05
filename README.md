# web-push
> Web Push library for Node.js

Supports Firefox 44+ and Chromium/Chrome 42+.
Notifications with payloads are supported in Firefox 44+ and Chromium/Chrome 50+.
[VAPID](https://tools.ietf.org/html/draft-thomson-webpush-vapid-02) is supported in Firefox 45+ (for notifications without payloads) and in Firefox 46+ for all notifications.

[![NPM](https://nodei.co/npm/web-push.svg?downloads=true)](https://www.npmjs.com/package/web-push)

[![Build Status](https://travis-ci.org/marco-c/web-push.svg?branch=master)](https://travis-ci.org/marco-c/web-push)
[![dependencies](https://david-dm.org/marco-c/web-push.svg)](https://david-dm.org/marco-c/web-push)
[![devdependencies](https://david-dm.org/marco-c/web-push/dev-status.svg)](https://david-dm.org/marco-c/web-push#info=devDependencies)

## sendNotification(endpoint, params)

Send a Push notification to an endpoint. *params* contains optional parameters:
- *TTL* is a value in seconds that describes how long a push message is retained by the push service (by default, four weeks);
- *userPublicKey* is the public key of the receiver (from the browser);
- *userAuth* is the auth secret of the receiver (from the browser);
- *payload* is the message to attach to the notification.
- *vapid* an object with parameters for [VAPID](https://tools.ietf.org/html/draft-thomson-webpush-vapid-02).

Note that, in order to encrypt the *payload*, *userPublicKey* and *userAuth* are required.

The properties of the *vapid* objects are:
- *audience*, the origin of the application server;
- *subject*, a contact URI for the application server (either 'mailto:' or 'https:');
- *privateKey*;
- *publicKey*.

The function returns a Promise. On success, it is resolved to the body of the response from the push service. On failure, it is rejected with a `WebPushError`, which extends an `Error` with the following properties:
- *statusCode*, the status code of the response from the push service;
- *headers*, the headers of the response from the push service;
- *body*, the body of the response from the push service.

## generateVAPIDKeys()
Generates the keys needed for [VAPID](https://tools.ietf.org/html/draft-thomson-webpush-vapid-02). Returns an object with two properties: *privateKey* and *publicKey*.
The keys should be stored and always reused when sending notifications with VAPID.

## setGCMAPIKey(apiKey)

Sets the GCM API key that the library should use in making requests to GCM endpoints (in Chromium/Google Chrome).
- *apiKey* is your GCM API key, you can obtain it from the Google Developer Console.

## encrypt(userPublicKey, userAuth, payload)

Encrypts the payload according to the [Message Encryption for Web Push](https://webpush-wg.github.io/webpush-encryption/) standard. (*sendNotification* will automatically encrypt the payload for you, so if you use *sendNotification* you don't need to worry about it).
- *userPublicKey* is the public key of the receiver (from the browser);
- *userAuth* is the auth secret of the receiver (from the browser);
- *payload* is the message to attach to the notification.

## Examples

The [Service Worker Cookbook](https://serviceworke.rs/) is full of Web Push examples using the web-push library.

## Projects using web-push

- [Mercurius](https://github.com/marco-c/mercurius) - A generic Web Push server. See also the blog post on the Mozilla Hacks blog: https://hacks.mozilla.org/2015/12/web-push-notifications-from-irssi/.
- TicTacToe with offline and Push support using Service Workers - https://github.com/marco-c/tictactoe
- Push API MDN demo - https://github.com/chrisdavidmills/push-api-demo - https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Using_the_Push_API

## Running tests

Selenium tests require Firefox or Chromium/Chrome. You can either use your installed versions or let the tests download the browsers for you.

```
FIREFOX="stable" CHROME="nightly" npm test
```

Possible values for FIREFOX and CHROME are:
- "stable", the test will automatically download the stable version;
- "nightly", the test will automatically download the nightly/canary version;
- path to the Firefox/Chromium binary, the test will use it instead of automatically download the browser for you.

In order to make the tests run in Chromium/Chrome, you also need a GCM API key and you need to define a GCM_API_KEY environment variable:
```
GCM_API_KEY=your_API_key FIREFOX="stable" CHROME="nightly" npm test
```
