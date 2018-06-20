<h1 align="center">web-push</h1>

<p align="center">
  <a href="https://travis-ci.org/web-push-libs/web-push">
    <img src="https://travis-ci.org/web-push-libs/web-push.svg?branch=master" alt="Travis Build Status" />
  </a>
  <a href="https://david-dm.org/web-push-libs/web-push">
    <img src="https://david-dm.org/web-push-libs/web-push.svg" alt="NPM Dependency State" />
  </a>
  <a href="https://david-dm.org/web-push-libs/web-push?type=dev">
    <img src="https://david-dm.org/web-push-libs/web-push/dev-status.svg" alt="NPM Dev Dependency State" />
  </a>
</p>

# Why

Web push requires that push messages triggered from a backend be done via the
[Web Push Protocol](https://tools.ietf.org/html/draft-ietf-webpush-protocol)
and if you want to send data with your push message, you must also encrypt
that data according to the [Message Encryption for Web Push spec](https://tools.ietf.org/html/draft-ietf-webpush-encryption).

This module makes it easy to send messages and will also handle legacy support
for browsers relying on GCM for message sending / delivery.

# Install

Installation is simple, just install via npm.

    npm install web-push --save

# Usage

The common use case for this library is an application server using
a GCM API key and VAPID keys.

```javascript
const webpush = require('web-push');

// VAPID keys should only be generated only once.
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setGCMAPIKey('<Your GCM API Key Here>');
webpush.setVapidDetails(
  'mailto:example@yourdomain.org',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// This is the same output of calling JSON.stringify on a PushSubscription
const pushSubscription = {
  endpoint: '.....',
  keys: {
    auth: '.....',
    p256dh: '.....'
  }
};

webpush.sendNotification(pushSubscription, 'Your Push Payload Text');
```

## Using VAPID Key for applicationServerKey

When using your VAPID key in your web app, you'll need to convert the
URL safe base64 string to a Uint8Array to pass into the subscribe call,
which you can do like so:

```javascript
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const vapidPublicKey = '<Your Public Key from generateVAPIDKeys()>';
const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: convertedVapidKey
});
```

## Command Line

You can install `web-push` globally and use it for sending notifications
and / or generating VAPID keys.

Install like so:

    npm install web-push -g

Then you can run the following commands:

    Usage:

      web-push send-notification --endpoint=<url> [--key=<browser key>] [--auth=<auth secret>] [--payload=<message>] [--encoding=<aesgcm | aes128gcm>] [--ttl=<seconds>] [--vapid-subject=<vapid subject>] [--vapid-pubkey=<public key url base64>] [--vapid-pvtkey=<private key url base64>] [--gcm-api-key=<api key>]

      web-push generate-vapid-keys [--json]


# API Reference

## sendNotification(pushSubscription, payload, options)

```javascript
const pushSubscription = {
  endpoint: '< Push Subscription URL >',
  keys: {
    p256dh: '< User Public Encryption Key >',
    auth: '< User Auth Secret >'
  }
};

const payload = '< Push Payload String >';

const options = {
  gcmAPIKey: '< GCM API Key >',
  vapidDetails: {
    subject: '< \'mailto\' Address or URL >',
    publicKey: '< URL Safe Base64 Encoded Public Key >',
    privateKey: '< URL Safe Base64 Encoded Private Key >'
  },
  TTL: <Number>,
  headers: {
    '< header name >': '< header value >'
  },
  contentEncoding: '< Encoding type, e.g.: aesgcm or aes128gcm >',
  proxy: '< proxy server address >'
}

webpush.sendNotification(
  pushSubscription,
  payload,
  options
);
```

> **Note:** `sendNotification()` you don't need to define a payload, and this
method will work without a GCM API Key and / or VAPID keys if the push service
supports it.

### Input

**Push Subscription**

The first argument must be an object containing the details for a push
subscription.

The expected format is the same output as JSON.stringify'ing a PushSubscription
in the browser.

**Payload**

The payload is optional, but if set, will be the data sent with a push
message.

This must be either a *string* or a node
[*Buffer*](https://nodejs.org/api/buffer.html).

> **Note:** In order to encrypt the *payload*, the *pushSubscription* **must**
have a *keys* object with *p256dh* and *auth* values.

**Options**

Options is an optional argument that if defined should be an object containing
any of the following values defined, although none of them are required.

- **gcmAPIKey** can be a GCM API key to be used for this request and this
request only. This overrides any API key set via `setGCMAPIKey()`.
- **vapidDetails** should be an object with *subject*, *publicKey* and
*privateKey* values defined. These values should follow the [VAPID Spec](https://tools.ietf.org/html/draft-thomson-webpush-vapid).
- **TTL** is a value in seconds that describes how long a push message is
retained by the push service (by default, four weeks).
- **headers** is an object with all the extra headers you want to add to the request.
- **contentEncoding** is the type of push encoding to use (e.g. 'aesgcm', by default, or 'aes128gcm').
- **proxy** proxy hostname/ip and a port to tunnel your requests through (eg. http://< hostname >:< port >).

### Returns

A promise that resolves if the notification was sent successfully
with details of the request, otherwise it rejects.

In both cases, resolving or rejecting, you'll be able to access the following
values on the returned object or error.

- *statusCode*, the status code of the response from the push service;
- *headers*, the headers of the response from the push service;
- *body*, the body of the response from the push service.

<hr />

## generateVAPIDKeys()

```javascript
const vapidKeys = webpush.generateVAPIDKeys();

// Prints 2 URL Safe Base64 Encoded Strings
console.log(vapidKeys.publicKey, vapidKeys.privateKey);
```

### Input

None.

### Returns

Returns an object with **publicKey** and **privateKey** values which are
URL Safe Base64 encoded strings.

> **Note:** You should create these keys once, store them and use them for all
> future messages you send.

<hr />

## setGCMAPIKey(apiKey)

```javascript
webpush.setGCMAPIKey('Your GCM API Key');
```

### Input

This method expects the GCM API key that is linked to the `gcm_sender_id ` in
your web app manifest.

You can use a GCM API Key from the Google Developer Console or the
*Cloud Messaging* tab under a Firebase Project.

### Returns

None.

<hr />

## encrypt(userPublicKey, userAuth, payload, contentEncoding)

```javascript
const pushSubscription = {
  endpoint: 'https://....',
  keys: {
    p256dh: '.....',
    auth: '.....'
  }
};
webPush.encrypt(
  pushSubscription.keys.p256dh,
  pushSubscription.keys.auth,
  'My Payload',
  'aes128gcm'
)
.then(encryptionDetails => {

});
```

Encrypts the payload according to the [Message Encryption for Web
Push](https://webpush-wg.github.io/webpush-encryption/) standard.

> (*sendNotification* will automatically encrypt the payload for you, so if
> you use *sendNotification* you don't need to worry about it).

### Input

The `encrypt()` method expects the following input:

- *userPublicKey*: the public key of the receiver (from the browser).
- *userAuth*: the auth secret of the receiver (from the browser).
- *payload*: the message to attach to the notification.
- *contentEncoding*: the type of content encoding to use (e.g. aesgcm or aes128gcm).

### Returns

This method returns an object with the following fields:

- *localPublicKey*: The public key matched the private key used during
encryption.
- *salt*: A string representing the salt used to encrypt the payload.
- *cipherText*: The encrypted payload as a Buffer.

<hr />

## getVapidHeaders(audience, subject, publicKey, privateKey, contentEncoding, expiration)

```javascript
const parsedUrl = url.parse(subscription.endpoint);
const audience = parsedUrl.protocol + '//' +
  parsedUrl.hostname;

const vapidHeaders = vapidHelper.getVapidHeaders(
  audience,
  'mailto: example@web-push-node.org',
  vapidDetails.publicKey,
  vapidDetails.privateKey,
  'aes128gcm'
);
```

The *getVapidHeaders()* method will take in the values needed to create
an Authorization and Crypto-Key header.

### Input

The `getVapidHeaders()` method expects the following input:

- *audience*: the origin of the **push service**.
- *subject*: the mailto or URL for your application.
- *publicKey*: the VAPID public key.
- *privateKey*: the VAPID private key.
- *contentEncoding*: the type of content encoding to use (e.g. aesgcm or aes128gcm).

### Returns

This method returns an object with the following fields:

- *localPublicKey*: The public key matched the private key used during
encryption.
- *salt*: A string representing the salt used to encrypt the payload.
- *cipherText*: The encrypted payload as a Buffer.

<hr />

## generateRequestDetails(pushSubscription, payload, options)

```javascript
const pushSubscription = {
  endpoint: '< Push Subscription URL >';
  keys: {
    p256dh: '< User Public Encryption Key >',
    auth: '< User Auth Secret >'
  }
};

const payload = '< Push Payload String >';

const options = {
  gcmAPIKey: '< GCM API Key >',
  vapidDetails: {
    subject: '< \'mailto\' Address or URL >',
    publicKey: '< URL Safe Base64 Encoded Public Key >',
    privateKey: '< URL Safe Base64 Encoded Private Key >',
  }
  TTL: <Number>,
  headers: {
    '< header name >': '< header value >'
  },
  contentEncoding: '< Encoding type, e.g.: aesgcm or aes128gcm >',
  proxy: '< proxy server address >'
}

try {
  const details = webpush.generateRequestDetails(
    pushSubscription,
    payload,
    options
  );
} catch (err) {
  console.error(err);
}
```

> **Note:** When calling `generateRequestDetails()` the payload argument
does not *need* to be defined, passing in null will return no body and
> exclude any unnecessary headers.
> Headers related to the GCM API Key and / or VAPID keys will be included
> if supplied and required.

### Input

**Push Subscription**

The first argument must be an object containing the details for a push
subscription.

The expected format is the same output as JSON.stringify'ing a PushSubscription
in the browser.

**Payload**

The payload is optional, but if set, will be encrypted and a [*Buffer*](https://nodejs.org/api/buffer.html)
 will be returned via the `payload` parameter.

This argument must be either a *string* or a node
[*Buffer*](https://nodejs.org/api/buffer.html).

> **Note:** In order to encrypt the *payload*, the *pushSubscription* **must**
have a *keys* object with *p256dh* and *auth* values.

**Options**

Options is an optional argument that if defined should be an object containing
any of the following values defined, although none of them are required.

- **gcmAPIKey** can be a GCM API key to be used for this request and this
request only. This overrides any API key set via `setGCMAPIKey()`.
- **vapidDetails** should be an object with *subject*, *publicKey* and
*privateKey* values defined. These values should follow the [VAPID Spec](https://tools.ietf.org/html/draft-thomson-webpush-vapid).
- **TTL** is a value in seconds that describes how long a push message is
retained by the push service (by default, four weeks).
- **headers** is an object with all the extra headers you want to add to the request.
- **contentEncoding** is the type of push encoding to use (e.g. 'aesgcm', by default, or 'aes128gcm').
- **proxy** proxy hostname/ip and a port to tunnel your requests through (eg. http://< hostname >:< port >).

### Returns

An object containing all the details needed to make a network request, the
object will contain:

- *endpoint*, the URL to send the request to;
- *method*, this will be 'POST';
- *headers*, the headers to add to the request;
- *body*, the body of the request (As a Node Buffer).

<hr />

# Browser Support

<table>
<thead>
<tr>
<th><strong>Browser</strong></th>
<th width="130px"><strong>Push without Payload</strong></th>
<th width="130px"><strong>Push with Payload</strong></th>
<th width="130px"><strong>VAPID</strong></th>
<th><strong>Notes</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>Chrome</td>

<!-- Push without payloads support-->
<td>✓ v42+</td>

<!-- Push with payload support -->
<td>✓ v50+</td>

<!-- VAPID Support -->
<td>✓ v52+</td>

<td>In v51 and less, the `gcm_sender_id` is needed to get a push subscription.</td>
</tr>

<tr>
<td>Edge</td>

<!-- Push without payloads support-->
<td>✓ v17+ (April 2018)</td>

<!-- Push with payload support -->
<td>✓ v17+ (April 2018)</td>

<!-- VAPID Support -->
<td>✓ v17+ (April 2018)</td>

<td></td>
</tr>

<tr>
<td>Firefox</td>

<!-- Push without payloads support-->
<td>✓ v44+</td>

<!-- Push with payload support -->
<td>✓ v44+</td>

<!-- VAPID Support -->
<td>✓ v46+</td>

<td></td>
</tr>

<tr>
<td>Opera</td>

<!-- Push without payloads support-->
<td>✓ v39+ <strong>*</strong></td>

<!-- Push with payload support -->
<td>✓ v39+ <strong>*</strong></td>

<!-- VAPID Support -->
<td>✗</td>

<td>
  <strong>*</strong> Opera supports push on Android but not on desktop.
  <br />
  <br />
  The `gcm_sender_id` is needed to get a push subscription.
</td>
</tr>

<tr>
<td>Safari</td>

<!-- Push without payloads support-->
<td>✗</td>

<!-- Push with payload support -->
<td>✗</td>

<!-- VAPID Support -->
<td>✗</td>

<td></td>
</tr>

<tr>
<td>Samsung Internet Browser</td>

<!-- Push without payloads support-->
<td>✓ v4.0.10-53+</td>

<!-- Push with payload support -->
<td>✓ v5.0.30-40+</td>

<!-- VAPID Support -->
<td>✗</td>

<td>The `gcm_sender_id` is needed to get a push subscription.</td>
</tr>
</tbody>
</table>

# Help

**Service Worker Cookbook**

The [Service Worker Cookbook](https://serviceworke.rs/) is full of Web Push
examples using this library.

# Running tests

> Prerequisites:
>  * Java JDK or JRE (http://www.oracle.com/technetwork/java/javase/downloads/index.html)

To run tests:

    npm test

<p align="center">
  <a href="https://www.npmjs.com/package/web-push">
    <img src="https://nodei.co/npm/web-push.svg?downloads=true" />
  </a>
</p>
