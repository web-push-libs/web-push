var port;
var pushMessage;

self.addEventListener('push', function(event) {
  // XXX: Checking event.data.text() shouldn't be needed (and wasn't needed), but is now needed in Chrome.
  // Looks like Chrome isn't following the specs here? (When there's no payload, event.data should be null)
  pushMessage = event.data && event.data.text() ? event.data.text() : 'no payload';

  if (port) {
    port.postMessage(pushMessage);
  }

  event.waitUntil(self.registration.showNotification('Web Push Demo', {
    body: 'Notification!',
    tag: 'push',
  }));
});

self.onmessage = function(e) {
  port = e.ports[0];

  if (pushMessage) {
    // Push message arrived before the page finished loading.
    port.postMessage(pushMessage);
  }
}
