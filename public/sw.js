// 백그라운드 푸시 수신 — 08-deployNOTE.md 12번 「백그라운드 수신 코드」.
//
// 앱이 닫혀 있어도 이 파일이 브라우저에 상주하며 푸시를 받아 띄운다.
// 알림 문구는 서버가 사용자 언어로 이미 완성해서 보낸다(08 · 11번) — 여기서는
// 받은 그대로 띄우고, 누르면 그 화면으로 이동시키기만 한다.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Washed', body: event.data ? event.data.text() : '' };
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'Washed', {
      body: body || '',
      data: { url: url || '/home' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
