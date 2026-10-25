/* ==========================================================
   VOLT TRAINING
   service-worker.js — Offline PWA Support
   Version 1.5
   ========================================================== */

const CACHE_VERSION = "volt-v1.5.0";

const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_FILES = [
    "./",
    "./index.html",
    "./css/styles.css",
    "./css/workout.css",
    "./js/app.js",
    "./js/workouts.js",
    "./js/programs.js",
    "./js/storage.js",
    "./js/timers.js",
    "./data/default-program.json",
    "./manifest.json"
];

/* ==========================================================
   INSTALL — CACHE APP FOR OFFLINE USE
========================================================== */

self.addEventListener("install", event => {

    event.waitUntil(
        (async () => {

            const cache = await caches.open(STATIC_CACHE);

            await cache.addAll(APP_FILES);

            await self.skipWaiting();

            console.log("[VOLT] New version installed.");

        })()
    );

});

/* ==========================================================
   ACTIVATE — REMOVE OLD CACHES
========================================================== */

self.addEventListener("activate", event => {

    event.waitUntil(
        (async () => {

            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames
                    .filter(name =>
                        name.startsWith("volt-") &&
                        name !== STATIC_CACHE &&
                        name !== RUNTIME_CACHE
                    )
                    .map(name => caches.delete(name))
            );

            await self.clients.claim();

            console.log("[VOLT] New version activated.");

        })()
    );

});

/* ==========================================================
   FETCH — NETWORK FIRST, CACHE FALLBACK
========================================================== */

self.addEventListener("fetch", event => {

    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    if (!url.href.startsWith(self.registration.scope)) return;

    event.respondWith(
        networkFirst(request)
    );

});

/* ==========================================================
   NETWORK FIRST
========================================================== */

async function networkFirst(request) {

    const cache = await caches.open(RUNTIME_CACHE);

    try {

        // Always check for the newest version online.
        const response = await fetch(request, {
            cache: "no-cache"
        });

        if (response.ok) {

            await cache.put(
                request,
                response.clone()
            );

        }

        return response;

    } catch (error) {

        // No internet? Use the latest cached version.
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Offline navigation fallback.
        if (request.mode === "navigate") {

            const offlinePage =
                await caches.match("./index.html");

            if (offlinePage) return offlinePage;

        }

        return Response.error();

    }

});

/* ==========================================================
   MANUAL CACHE REFRESH
========================================================== */

self.addEventListener("message", event => {

    if (event.data?.type !== "REFRESH_CACHE") return;

    event.waitUntil(
        (async () => {

            const cache = await caches.open(STATIC_CACHE);

            await cache.addAll(APP_FILES);

            console.log("[VOLT] Offline cache refreshed.");

        })()
    );

});

console.log("[VOLT] Service worker v1.5 loaded.");