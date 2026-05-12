# 🔧 دليل تفعيل Firebase + FCM لمنصة خدمتي
## ✅ الحالة: Firebase Config مربوط — Project: khedmati-cee2f

---

## الملفات

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `khedmati-platform.html` | الواجهة الرئيسية | ✅ Config مدمج |
| `firebase-messaging-sw.js` | Service Worker للإشعارات | ✅ Config مدمج |
| `functions/index.js` | Cloud Functions | ✅ جاهز للنشر |
| `functions/package.json` | مكتبات الـ Functions | ✅ جاهز |

---

## الخطوات المتبقية (3 خطوات فقط)

### الخطوة 1 — تفعيل Firestore

1. افتح [Firebase Console](https://console.firebase.google.com/project/khedmati-cee2f)
2. من القائمة: **Build → Firestore Database**
3. اضغط **"Create database"** → اختر **Production mode**
4. المنطقة: **me-central1** (قطر)
5. في **Rules** ضع هذه القواعد مؤقتاً للتطوير:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

### الخطوة 2 — رفع الملفات على Hosting

الأسهل هو Firebase Hosting المجاني:

```bash
# ثبّت Firebase CLI
npm install -g firebase-tools

# سجّل الدخول
firebase login

# في مجلد المشروع (حيث توجد الملفات)
firebase init hosting
# اختر: Use existing project → khedmati-cee2f
# Public directory: . (نقطة — المجلد الحالي)
# Single-page app: No
# Overwrite index.html: No

# ارفع
firebase deploy --only hosting
```

سيعطيك رابطاً مثل: `https://khedmati-cee2f.web.app`

> ⚠️ **مهم:** FCM لا يعمل على `file://` — يجب رفعه على Hosting أو أي سيرفر HTTPS.

---

### الخطوة 3 — نشر Cloud Functions

```bash
# في مجلد المشروع
mkdir functions
cd functions

# انسخ index.js و package.json هنا
npm install

cd ..
firebase deploy --only functions
```

بعد النشر، كل مرة يُنشأ طلب جديد في Firestore → الدالة تُطلق FCM تلقائياً.

---

## هيكل المجلد النهائي

```
khedmati/
├── khedmati-platform.html     (أو index.html)
├── firebase-messaging-sw.js   ← يجب أن يكون هنا
├── firebase.json
└── functions/
    ├── index.js
    └── package.json
```

---

## اختبار الإشعارات

1. افتح الموقع على Chrome
2. انتقل لصفحة **مقدم الخدمة**
3. اسمح بالإشعارات عند الطلب
4. افتح نافذة أخرى واطلب خدمة من **صفحة العميل**
5. ستلاحظ ظهور الإشعار فوراً في صفحة المختص

---

## قواعد Firestore للإنتاج (بعد إضافة Authentication)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /requests/{requestId} {
      allow create: if request.auth != null;
      allow read, update: if request.auth != null;
    }
    match /providers/{providerId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == providerId;
    }
  }
}
```


---

## الملفات التي ستحصل عليها

| الملف | الوصف |
|-------|-------|
| `khedmati-platform.html` | الواجهة الرئيسية (العميل + المختص + الإدارة) |
| `firebase-messaging-sw.js` | Service Worker للإشعارات في الخلفية |
| `functions/index.js` | Cloud Functions (إرسال FCM تلقائياً) |
| `functions/package.json` | مكتبات الـ Functions |

---

## الخطوة 1 — إنشاء مشروع Firebase

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اضغط **"Add project"** → سمّه `khedmati`
3. فعّل **Google Analytics** (اختياري لكن مفيد)

---

## الخطوة 2 — تفعيل الخدمات المطلوبة

### Firestore
- من القائمة الجانبية: **Build → Firestore Database**
- اضغط **"Create database"** → اختر **Production mode**
- المنطقة: **me-central1** (قطر — الأقرب لعُمان)

### Firebase Storage (للصور)
- **Build → Storage** → **"Get started"**

### Cloud Messaging (FCM)
- **Project Settings (⚙️)** → **Cloud Messaging**
- تحت **"Web Push certificates"** اضغط **"Generate key pair"**
- احفظ الـ **VAPID Key** — ستحتاجه لاحقاً

---

## الخطوة 3 — ربط التطبيق بـ Firebase

1. **Project Settings (⚙️)** → **Your apps** → اضغط **"</>" (Web)**
2. سمّه `khedmati-web` → اضغط **Register app**
3. ستظهر لك هذه القيم — انسخها:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← YOUR_API_KEY
  authDomain:        "khedmati.firebaseapp.com",
  projectId:         "khedmati",         // ← YOUR_PROJECT_ID
  storageBucket:     "khedmati.appspot.com",
  messagingSenderId: "123456789",        // ← YOUR_SENDER_ID
  appId:             "1:123...:web:abc"  // ← YOUR_APP_ID
};
```

4. **في ملف `khedmati-platform.html`** — ابحث عن `FIREBASE_CONFIG` واستبدل القيم
5. **في ملف `firebase-messaging-sw.js`** — نفس الشيء
6. **في ملف `khedmati-platform.html`** — ابحث عن `VAPID_KEY` وضع المفتاح من الخطوة 2

---

## الخطوة 4 — رفع ملف الـ Service Worker

ملف `firebase-messaging-sw.js` **يجب أن يكون في المجلد الجذر** للموقع (نفس مستوى `index.html`).

```
/
├── index.html  (أو khedmati-platform.html)
├── firebase-messaging-sw.js   ← هنا بالضبط
└── functions/
    ├── index.js
    └── package.json
```

---

## الخطوة 5 — نشر Cloud Functions

```bash
# ثبّت Firebase CLI لو ما عندك
npm install -g firebase-tools

# سجّل الدخول
firebase login

# في مجلد المشروع
firebase init functions
# اختر: Use existing project → khedmati
# اختر: JavaScript
# قل Yes لـ ESLint و Install dependencies

# استبدل محتوى functions/index.js بالكود المرفق
# ثم انشر:
firebase deploy --only functions
```

---

## الخطوة 6 — قواعد Firestore

في **Firestore → Rules**، ضع هذه القواعد:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // الطلبات — أي شخص يقرأ/يكتب (للتطوير)
    // في الإنتاج: اربطها بالمصادقة
    match /requests/{requestId} {
      allow read, write: if true;
    }

    // مقدمو الخدمة
    match /providers/{providerId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## الخطوة 7 — هيكل Firestore المطلوب

### مجموعة `requests`
```json
{
  "customerName":  "محمد الحارثي",
  "phone":         "96890234567",
  "building":      "مسقط — الموالح",
  "locationLat":   23.614,
  "locationLng":   58.593,
  "serviceType":   "ac",
  "description":   "المكيف لا يبرد",
  "status":        "جديد",
  "createdAt":     "timestamp",
  "clientFcmToken": "token...",
  "acceptedByProvider": null,
  "invoiceIssued": false,
  "amount": 0
}
```

### مجموعة `providers`
```json
{
  "name":          "خالد السيابي",
  "phone":         "96891234567",
  "services":      ["plumb", "elec"],
  "locationLat":   23.620,
  "locationLng":   58.580,
  "serviceRadius": 10,
  "fcmToken":      "fcm_token_here...",
  "status":        "active",
  "rating":        4.9,
  "jobCount":      67
}
```

---

## كيف يعمل النظام بعد الربط؟

```
العميل يرسل طلب
       ↓
يُحفظ في Firestore (requests)
       ↓
Cloud Function تُطلق تلقائياً
       ↓
تحسب المختصين في نطاق 10 كم
       ↓
ترسل FCM Notification لأقرب 10 مختصين
       ↓
أول مختص يضغط "قبول" ← يُحدَّث الطلب
       ↓
Cloud Function ثانية: ترسل "الطلب أُخذ" للباقين
       ↓
العميل يتلقى إشعار: "المختص في الطريق"
```

---

## ملاحظات مهمة

- **الإشعارات تعمل على HTTPS فقط** — لا تعمل على `file://` أو `http://`
- للتطوير المحلي: استخدم `firebase serve` أو `npx serve .`
- للنشر المجاني: [Firebase Hosting](https://firebase.google.com/docs/hosting) أو [Netlify](https://netlify.com)
- FCM على iOS يحتاج تطبيق native (لا يعمل من المتصفح على iPhone)

---

## الدعم والمساعدة

أي استفسار في ربط Firebase أو تخصيص النظام، تواصل معنا.
