# web-push
Web Push library for Node.js

## encrypt(userPublicKey, payload)

Encrypts the payload according to the [Message Encryption for Web Push](https://tools.ietf.org/html/draft-thomson-webpush-encryption-00) standard.
- *userPublicKey* is the public key of the browser;
- *payload* is the message to attach to the notification.

