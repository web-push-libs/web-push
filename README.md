<h1 align="center">web-push</h1>

[![Build Status](https://github.com/web-push-libs/web-push/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/web-push-libs/web-push/actions/workflows/ci.yml)

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

// VAPID keys should be generated only once.
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

When subscribing to push messages, you'll need to pass your VAPID key,
which you can do like so:

```javascript
registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: '<Your Public Key from generateVAPIDKeys()>'
});
```

## Command Line

You can install `web-push` globally and use it for sending notifications
and / or generating VAPID keys.

Install like so:

    npm install web-push -g

Then you can run the following commands:

    Usage:

      web-push send-notification --endpoint=<url> [--key=<browser key>] [--auth=<auth secret>] [--payload=<message>] [--encoding=<aesgcm | aes128gcm>] [--ttl=<seconds>] [--vapid-subject=<vapid subject>] [--vapid-pubkey=<public key url base64>] [--vapid-pvtkey=<private key url base64>] [--proxy=<http proxy uri>] [--gcm-api-key=<api key>]

      web-push generate-vapid-keys [--json]

  Example of send notification:
  ```shell
    > web-push generate-vapid-keys --json
    > {"publicKey":"BGtkbcjrO12YMoDuq2sCQeHlu47uPx3SHTgFKZFYiBW8Qr0D9vgyZSZPdw6_4ZFEI9Snk1VEAj2qTYI1I1YxBXE","privateKey":"I0_d0vnesxbBSUmlDdOKibGo6vEXRO-Vu88QlSlm5j0"}
  ```
   The subscription value:
  ```javascript
    { 
      "endpoint": "https://fcm.googleapis.com/fcm/send/d61c5u920dw:APA91bEmnw8utjDYCqSRplFMVCzQMg9e5XxpYajvh37mv2QIlISdasBFLbFca9ZZ4Uqcya0ck-SP84YJUEnWsVr3mwYfaDB7vGtsDQuEpfDdcIqOX_wrCRkBW2NDWRZ9qUz9hSgtI3sY", 
      "expirationTime": null, 
      "keys": { 
        "p256dh": "BL7ELU24fJTAlH5Kyl8N6BDCac8u8li_U5PIwG963MOvdYs9s7LSzj8x_7v7RFdLZ9Eap50PiiyF5K0TDAis7t0", 
        "auth": "juarI8x__VnHvsOgfeAPHg" 
      } 
    }
  ```
  The command example:
  ```shell
    web-push send-notification  \
    --endpoint=https://fcm.googleapis.com/fcm/send/d61c5u920dw:APA91bEmnw8utjDYCqSRplFMVCzQMg9e5XxpYajvh37mv2QIlISdasBFLbFca9ZZ4Uqcya0ck-SP84YJUEnWsVr3mwYfaDB7vGtsDQuEpfDdcIqOX_wrCRkBW2NDWRZ9qUz9hSgtI3sY \
    --key=BL7ELU24fJTAlH5Kyl8N6BDCac8u8li_U5PIwG963MOvdYs9s7LSzj8x_7v7RFdLZ9Eap50PiiyF5K0TDAis7t0 \
    --auth=juarI8x__VnHvsOgfeAPHg \
    --vapid-subject=mailto:example@qq.com \
    --vapid-pubkey=BGtkbcjrO12YMoDuq2sCQeHlu47uPx3SHTgFKZFYiBW8Qr0D9vgyZSZPdw6_4ZFEI9Snk1VEAj2qTYI1I1YxBXE \
    --vapid-pvtkey=I0_d0vnesxbBSUmlDdOKibGo6vEXRO-Vu88QlSlm5j0 \
    --payload=Hello
  ```  

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
  timeout: <Number>
  TTL: <Number>,
  headers: {
    '< header name >': '< header value >'
  },
  contentEncoding: '< Encoding type, e.g.: aesgcm or aes128gcm >',
  urgency:'< Default is "normal" >',
  topic:'< Use a maximum of 32 characters from the URL or filename-safe Base64 characters sets. >',

  proxy: '< proxy server options >',
  agent: '< https.Agent instance >'
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
- **timeout** is a value in milliseconds that specifies the request's socket timeout. On timeout, the request will be destroyed and the promise will be rejected with a meaningful error. It's a common misconception that a socket timeout is the timeout to receive the full response. So if you have a socket timeout of 1 second, and a response comprised of 3 TCP packets, where each response packet takes 0.9 seconds to arrive, for a total response time of 2.7 seconds, then there will be no timeout. Once a socket 'timeout' triggers the request will be aborted by the library (by default undefined).
- **TTL** is a value in seconds that describes how long a push message is
retained by the push service (by default, four weeks).
- **headers** is an object with all the extra headers you want to add to the request.
- **contentEncoding** is the type of push encoding to use (e.g. 'aes128gcm', by default, or 'aesgcm').
- **urgency** is to indicate to the push service whether to send the notification immediately or prioritize the recipient’s device power considerations for delivery. Provide one of the following values: very-low, low, normal, or high. To attempt to deliver the notification immediately, specify high.
- **topic** optionally provide an identifier that the push service uses to coalesce notifications. Use a maximum of 32 characters from the URL or filename-safe Base64 characters sets.
- **proxy** is the [HttpsProxyAgent's constructor argument](https://github.com/TooTallNate/node-https-proxy-agent#new-httpsproxyagentobject-options)
that may either be a string URI of the proxy server (eg. http://< hostname >:< port >)
or an "options" object with more specific properties.
- **agent** is the [HTTPS Agent instance](https://nodejs.org/dist/latest/docs/api/https.html#https_class_https_agent) which will be used in the `https.request` method. If the `proxy` options defined, `agent` will be ignored!

> **Note:** As of this writing, if a push notification request contains a VAPID `subject` referencing an `https://localhost` URI (set either using the `options` argument or via the global `setVapidDetails()` method), Safari's push notification endpoint rejects the request with a `BadJwtToken` error.

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

## setVapidDetails(subject, publicKey, privateKey)

```javascript
webpush.setVapidDetails(
  'mailto:user@example.org',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
```

Globally sets the application's VAPID subject, public key, and private key, to be used in subsequent calls to `sendNotification()` and `generateRequestDetails()` that don't specifically override them in their `options` argument.

### Input

The `setVapidDetails` method expects the following input:

- *subject*: the VAPID server contact information, as either an `https:` or `mailto:` URI ([as per the VAPID spec](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid#section-2.1)).
- *publicKey*: the VAPID public key.
- *privateKey*: the VAPID private key.

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
  urgency:'< Default is normal "Defult" >',
  topic:'< Use a maximum of 32 characters from the URL or filename-safe Base64 characters sets. >',
  proxy: '< proxy server options >'
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
- **urgency** is to indicate to the push service whether to send the notification immediately or prioritize the recipient’s device power considerations for delivery. Provide one of the following values: very-low, low, normal, or high. To attempt to deliver the notification immediately, specify high.
- **topic** optionally provide an identifier that the push service uses to coalesce notifications. Use a maximum of 32 characters from the URL or filename-safe Base64 characters sets.
- **proxy** is the [HttpsProxyAgent's constructor argument](https://github.com/TooTallNate/node-https-proxy-agent#new-httpsproxyagentobject-options)
that may either be a string URI of the proxy server (eg. http://< hostname >:< port >)
or an "options" object with more specific properties.

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
<td>✓ v16+ </td>

<!-- Push with payload support -->
<td>✓ v16+</td>

<!-- VAPID Support -->
<td>✓ v16+</td>

<td>Safari 16 in macOS 13 or later</td>
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
