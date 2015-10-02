var port;

self.addEventListener('push', function(event) {
  event.waitUntil(self.registration.showNotification('Web Push Demo', {
    body: 'Notification!',
    tag: 'push',
  }));

  port.postMessage(event.data.text());
});

self.onmessage = function(e) {
  port = e.ports[0];
}
