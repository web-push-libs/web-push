# web-push [![Build Status](https://travis-ci.org/marco-c/web-push.svg)](https://travis-ci.org/marco-c/web-push)
Web Push library for Node.js

## encrypt(userPublicKey, payload)

Encrypts the payload according to the [Message Encryption for Web Push](https://tools.ietf.org/html/draft-thomson-webpush-encryption-00) standard.
- *userPublicKey* is the public key of the browser;
- *payload* is the message to attach to the notification.

## sendNotification(endpoint, userPublicKey, payload)

Send a Push notification to an endpoint. *userPublicKey* and *payload* can be undefined, if you want to send a notification without a message.
- *endpoint* is the endpoint URL;
- *userPublicKey* is the public key of the browser;
- *payload* is the message to attach to the notification.

## Projects using web-push

- TicTacToe with offline and Push support using Service Workers - https://github.com/marco-c/tictactoe
