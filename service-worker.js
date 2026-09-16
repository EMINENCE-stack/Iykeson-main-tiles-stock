/* ==========================================================================
   service-worker.js

   WHAT THIS FILE DOES (in plain terms):
   A service worker is a small script the browser keeps running quietly in
   the background, separate from your normal page. Its job here is simple:
   the FIRST time someone opens the app (while online), it saves a copy of
   every file (HTML, CSS, JS, icons) into the browser's own storage. Every
   time AFTER that -- even with zero internet or WiFi -- the browser hands
   back those saved copies instead of trying to fetch them from a server.

   This is what makes a plain website behave like a real installed app that
   works offline, with NO separate server app needed running in the
   background (unlike the local-server approach we were fighting with).
   ========================================================================== */

const CACHE_NAME = "iykeson-tiles-stock-v2"; // bumped from v1 

// Every file needed for the app to run completely, listed so it can be
// saved to the cache in one go
const FILES_TO_CACHE = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Runs once, when the service worker is first installed (first visit)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // activate this service worker immediately, don't wait
});

// Cleans up old cache versions if we ever ship an updated CACHE_NAME later
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

// Runs for EVERY request the page makes (loading the HTML, CSS, JS, icons).
// Strategy: try the cache FIRST (works instantly, works offline). Only go to
// the network if that exact file isn't cached yet for some reason.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
