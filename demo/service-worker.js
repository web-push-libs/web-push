var port;
var pushMessage;

self.addEventListener('push', function(event) {
  pushMessage = event.data ? event.data.text() : 'no payload';

  dump('Service Worker - Received: ' + pushMessage + '\n');

  event.waitUntil(self.registration.showNotification('Web Push Demo', {
    body: 'Notification!',
    tag: 'push',
  }));

  if (port) {
    port.postMessage(pushMessage);
  }
});

self.onmessage = function(e) {
  dump('Service Worker - Opened message channel\n');

  port = e.ports[0];

  if (pushMessage) {
    // Push message arrived before the page finished loading.
    port.postMessage(pushMessage);
  }
}
