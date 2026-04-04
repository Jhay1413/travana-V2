self.addEventListener("push", (event) => {
  let data = { title: "Tina's Travel", body: "You have a new message", url: "/portal/messages" };
  try {
    data = event.data.json();
  } catch {}
  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/portal/messages" },
    vibrate: [200, 100, 200],
    tag: "portal-message",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/portal/messages";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/portal") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
