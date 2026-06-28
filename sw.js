// ════════════════════════════════════════════════════════════════════════════
//  iNDEED — Service Worker
//  ----------------------------------------------------------------------------
//  Must be hosted at the SAME path the app registers it from ("sw.js" next
//  to indeed.html) and served over http(s) — NOT opened as a local file://,
//  browsers refuse to register service workers on file:// origins.
//
//  What this enables right now:
//   1. registration.showNotification() — reminders that show even when this
//      tab is in the background (as long as the browser process is alive).
//   2. A tap on a notification focuses/reopens the app.
//
//  What this does NOT do (and nothing client-side can):
//   - Wake a fully closed/killed app to fire a reminder at a future time.
//     That needs real push: Firebase Cloud Messaging + a small server (or a
//     Cloud Function) that calls the FCM Admin SDK at the right times. The
//     `push` handler below is ready for that the day you add it — see
//     SETUP.md, section "Optional: true closed-app push".
// ════════════════════════════════════════════════════════════════════════════

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Clicking a notification focuses an open tab, or opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow("./");
    })
  );
});

// Ready for real push the moment you wire up Firebase Cloud Messaging.
self.addEventListener("push", (event) => {
  let data = { title: "iNDEED", body: "Reminder" };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      vibrate: [200, 80, 200],
      tag: data.title,
    })
  );
});
