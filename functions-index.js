// ============================================================
//  functions/index.js  —  Firebase Cloud Functions
//  تشغيل: firebase deploy --only functions
// ============================================================

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp }    = require('firebase-admin/app');
const { getFirestore }     = require('firebase-admin/firestore');
const { getMessaging }     = require('firebase-admin/messaging');

initializeApp();
const db        = getFirestore();
const messaging = getMessaging();

// -------------------------------------------------------
// الدالة 1: عند إنشاء طلب جديد → أرسل إشعار للمختصين القريبين
// -------------------------------------------------------
exports.onNewRequest = onDocumentCreated(
  { document: 'requests/{requestId}', region: 'me-central1' },
  async (event) => {
    const request   = event.data.data();
    const requestId = event.params.requestId;

    const { serviceType, locationLat, locationLng, customerName, building } = request;

    if (!locationLat || !locationLng) {
      console.log('الطلب بدون إحداثيات، تم التخطي');
      return;
    }

    // ── 1. جيب مقدمي الخدمة المتاحين لهذه الفئة
    const providersSnap = await db.collection('providers')
      .where('status',   '==', 'active')
      .where('services', 'array-contains', serviceType)
      .get();

    if (providersSnap.empty) {
      console.log('لا يوجد مقدمو خدمة متاحون لـ', serviceType);
      return;
    }

    // ── 2. رتّب حسب المسافة وخذ أقرب 10
    const R = 6371; // نصف قطر الأرض كم
    const toRad = deg => deg * Math.PI / 180;

    const nearby = providersSnap.docs
      .map(doc => {
        const p    = doc.data();
        const dLat = toRad(p.locationLat - locationLat);
        const dLng = toRad(p.locationLng - locationLng);
        const a    =
          Math.sin(dLat/2)**2 +
          Math.cos(toRad(locationLat)) * Math.cos(toRad(p.locationLat)) *
          Math.sin(dLng/2)**2;
        const dist = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return { ...p, docId: doc.id, dist };
      })
      .filter(p => p.dist <= (p.serviceRadius || 10))  // نطاق كل مقدم خدمة
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);

    if (nearby.length === 0) {
      console.log('لا يوجد مختصون ضمن النطاق المطلوب');
      return;
    }

    // ── 3. أرسل الإشعار لكل مختص
    const tokens = nearby
      .filter(p => p.fcmToken)
      .map(p => p.fcmToken);

    if (tokens.length === 0) {
      console.log('لا يوجد FCM tokens مسجلة');
      return;
    }

    const serviceEmoji = {
      plumb:     '🔧', elec: '⚡', ac: '❄️', clean: '🧹',
      gas:       '🔥', water: '💧', pest: '🐛', paint: '🎨',
      garden:    '🌿', lock: '🔑', appliance: '📺', net: '📡',
      move:      '🚚', build: '🏗️', solar: '☀️', other: '🛠️',
    };
    const emoji = serviceEmoji[serviceType] || '🔧';

    const message = {
      tokens,
      notification: {
        title: `${emoji} طلب خدمة جديد قريب منك!`,
        body:  `${customerName} يطلب ${serviceType} — ${building || 'موقع محدد'}`,
      },
      data: {
        requestId,
        serviceType,
        customerName,
        locationLat:  String(locationLat),
        locationLng:  String(locationLng),
        building:     building || '',
        type:         'NEW_REQUEST',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'khedmati_requests',
          priority:  'max',
          sound:     'default',
          defaultVibrateTimings: true,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: { requireInteraction: true, renotify: true },
        fcmOptions: { link: `/?page=provider&requestId=${requestId}` },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`✅ أُرسل لـ ${response.successCount} مختص, فشل: ${response.failureCount}`);

      // ── 4. احفظ في Firestore من أُرسل له
      await event.data.ref.update({
        notifiedProviders: nearby.slice(0, response.successCount).map(p => p.docId),
        notifiedAt:        new Date().toISOString(),
        notifRadius:       Math.max(...nearby.map(p => p.dist)).toFixed(1),
      });

      // ── 5. نظّف الـ tokens الخاطئة
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          const provider = nearby[idx];
          if (provider?.docId) {
            await db.collection('providers').doc(provider.docId).update({ fcmToken: '' });
          }
        }
      });

    } catch (err) {
      console.error('خطأ في إرسال FCM:', err);
    }
  }
);

// -------------------------------------------------------
// الدالة 2: عند قبول طلب → أخبر بقية المختصين أنه انتهى
// -------------------------------------------------------
exports.onRequestAccepted = onDocumentUpdated(
  { document: 'requests/{requestId}', region: 'me-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // شغّل فقط عند التغيير لحالة "مقبول"
    if (before.status === after.status || after.status !== 'مقبول') return;

    const notifiedProviders = after.notifiedProviders || [];
    const acceptedBy        = after.acceptedByProvider;

    // أرسل لبقية المختصين أن الطلب أُخذ
    const cancelTargets = notifiedProviders.filter(id => id !== acceptedBy);
    if (cancelTargets.length === 0) return;

    const tokensSnap = await Promise.all(
      cancelTargets.map(id => db.collection('providers').doc(id).get())
    );

    const tokens = tokensSnap
      .filter(doc => doc.exists && doc.data().fcmToken)
      .map(doc => doc.data().fcmToken);

    if (tokens.length === 0) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: '❌ الطلب أُخذ',
        body:  'تم قبول هذا الطلب من مختص آخر',
      },
      data: {
        requestId: event.params.requestId,
        type:      'REQUEST_TAKEN',
      },
      android: { priority: 'normal' },
    });

    console.log(`✅ أُرسل إشعار "طلب أُخذ" لـ ${tokens.length} مختص`);
  }
);

// -------------------------------------------------------
// الدالة 3: إشعار للعميل عند قبول طلبه
// -------------------------------------------------------
exports.onRequestAcceptedNotifyClient = onDocumentUpdated(
  { document: 'requests/{requestId}', region: 'me-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (before.status === after.status || after.status !== 'مقبول') return;
    if (!after.clientFcmToken) return;

    await messaging.send({
      token: after.clientFcmToken,
      notification: {
        title: '✅ تم قبول طلبك!',
        body:  `المختص ${after.providerName || ''} في طريقه إليك`,
      },
      data: {
        requestId: event.params.requestId,
        type:      'YOUR_REQUEST_ACCEPTED',
      },
    });
  }
);
