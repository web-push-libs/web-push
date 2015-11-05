var port;
var pushMessage;

self.addEventListener('push', function(event) {
  pushMessage = event.data ? event.data.text() : 'no payload';

  if (port) {
    port.postMessage(pushMessage);
  }

  event.waitUntil(self.registration.showNotification('Web Push Demo', {
    body: 'Notification!',
    tag: 'push',
  }));
});

self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('PUSH SUBSCRIPTION CHANGE!')
  console.log(event);
});

self.onmessage = function(e) {
  port = e.ports[0];

  if (pushMessage) {
    // Push message arrived before the page finished loading.
    port.postMessage(pushMessage);
  }
}
