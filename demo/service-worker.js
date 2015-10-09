var port;
var pushMessage;

self.addEventListener('push', function(event) {
  dump('push0\n');

  dump('event.data: ' + event.data + '\n');

  pushMessage = event.data ? event.data.text() : 'no payload';

  dump('push1\n');

  dump('Service Worker - Received: ' + pushMessage + '\n');

  if (port) {
    port.postMessage(pushMessage);
  }

  event.waitUntil(self.registration.showNotification('Web Push Demo', {
    body: 'Notification!',
    tag: 'push',
  }));
});

self.onmessage = function(e) {
  dump('Service Worker - Opened message channel\n');

  port = e.ports[0];

  if (pushMessage) {
    // Push message arrived before the page finished loading.
    port.postMessage(pushMessage);
  }
}
