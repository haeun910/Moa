// 서비스워커에 덧붙는 웹 푸시 처리 (vite.config.ts의 workbox.importScripts로 불러옴)
// 서버(send-timebox-push 함수)가 보낸 알림을 띄우고, 알림을 누르면 앱의 타임박스 화면을 엽니다.

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '모아';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // 이미 열린 앱 창이 있으면 그 창을 앞으로 가져와서 화면만 바꿈
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.postMessage({ type: 'moa:navigate', screen: target.searchParams.get('screen') });
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
