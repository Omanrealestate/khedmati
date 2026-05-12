// ============================================================
//  firebase-messaging-sw.js
//  ضعه في نفس مجلد index.html (المجلد الجذر للموقع)
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAYHnMCVFL0eDuTJGbYpyqPXykYAhY3RcI",
  authDomain:        "khedmati-cee2f.firebaseapp.com",
  projectId:         "khedmati-cee2f",
  storageBucket:     "khedmati-cee2f.firebasestorage.app",
  messagingSenderId: "254099792190",
  appId:             "1:254099792190:web:45588d7178bfa4ba5b4c6f"
});

const messaging = firebase.messaging();

// -------------------------------------------------------
// استقبال الإشعارات وهو في الخلفية (التطبيق مغلق / مخفي)
// -------------------------------------------------------
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] رسالة في الخلفية:', payload);

  const { title, body, icon, data } = payload.notification || {};
  const notifData = payload.data || {};

  self.registration.showNotification(title || 'خدمتي 🔧', {
    body:  body  || 'طلب خدمة جديد بالقرب منك',
    icon:  icon  || '/icon-192.png',
    badge: '/badge-72.png',
    tag:   notifData.requestId || 'khedmati-request',
    renotify: true,
    data: notifData,
    actions: [
      { action: 'accept',  title: '✋ قبول الطلب' },
      { action: 'view',    title: '👁️ عرض التفاصيل' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true   // تبقى الإشعارة ظاهرة حتى يتفاعل المختص
  });
});

// -------------------------------------------------------
// عند الضغط على الإشعار أو أزراره
// -------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const action = event.action;

  // المسار الافتراضي لصفحة مقدم الخدمة
  let targetUrl = '/?page=provider&tab=notifications';

  if (action === 'accept' && data.requestId) {
    // فتح الصفحة وقبول الطلب مباشرةً عبر query param
    targetUrl = `/?page=provider&action=accept&requestId=${data.requestId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // لو التطبيق مفتوح — انتقل له
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'FCM_ACTION', action, data });
          return client.focus();
        }
      }
      // لو مغلق — افتح نافذة جديدة
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
