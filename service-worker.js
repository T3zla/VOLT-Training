/* ==========================================================
   VOLT TRAINING
   service-worker.js — Offline PWA Support
   Version 1.2
   ========================================================== */


/* ==========================================================
   1. CACHE CONFIGURATION
========================================================== */

const CACHE_VERSION = "volt-v1.4.0";

const STATIC_CACHE = `${CACHE_VERSION}-static`;

const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;


/* ==========================================================
   2. APPLICATION FILES
========================================================== */

/*
   These files are required for VOLT to work offline.

   All paths are relative to the service worker location.

   This supports deployment in a GitHub Pages
   repository subdirectory.
*/

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
   3. INSTALL SERVICE WORKER
========================================================== */

self.addEventListener("install", event => {

    console.log(
        "[VOLT SW] Installing service worker..."
    );

    event.waitUntil(

        caches.open(STATIC_CACHE)

            .then(cache => {

                return cache.addAll(APP_FILES);

            })

            .then(() => {

                console.log(
                    "[VOLT SW] Application files cached."
                );

                return self.skipWaiting();

            })

    );

});


/* ==========================================================
   4. ACTIVATE SERVICE WORKER
========================================================== */

self.addEventListener("activate", event => {

    console.log(
        "[VOLT SW] Activating service worker..."
    );

    event.waitUntil(

        (async () => {

            const cacheNames =
                await caches.keys();

            const oldVoltCaches =
                cacheNames.filter(name => {

                    return (
                        name.startsWith("volt-") &&
                        name !== STATIC_CACHE &&
                        name !== RUNTIME_CACHE
                    );

                });

            await Promise.all(

                oldVoltCaches.map(name => {

                    console.log(
                        "[VOLT SW] Removing old cache:",
                        name
                    );

                    return caches.delete(name);

                })

            );

            await self.clients.claim();

            console.log(
                "[VOLT SW] Service worker active."
            );

        })()

    );

});


/* ==========================================================
   5. INTERCEPT NETWORK REQUESTS
========================================================== */

self.addEventListener("fetch", event => {

    const request = event.request;

    // Only cache GET requests.
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // Only handle requests from this origin.
    if (url.origin !== self.location.origin) {
        return;
    }

    // Only handle resources within this PWA's scope.
    if (!url.href.startsWith(self.registration.scope)) {
        return;
    }

    // Handle page navigation separately.
    if (request.mode === "navigate") {

        event.respondWith(
            handleNavigation(request)
        );

        return;

    }

    // Cache application resources.
    event.respondWith(
        handleStaticResource(request)
    );

});


/* ==========================================================
   6. HANDLE PAGE NAVIGATION
========================================================== */

async function handleNavigation(request) {

    const cache =
        await caches.open(STATIC_CACHE);

    const cachedPage =
        await cache.match("./index.html");

    if (cachedPage) {
        return cachedPage;
    }

    try {

        return await fetch(request);

    } catch (error) {

        return new Response(

            `
            <!DOCTYPE html>
            <html lang="en">

            <head>
                <meta charset="UTF-8">
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                >

                <title>VOLT Offline</title>

                <style>
                    body {
                        margin: 0;
                        padding: 40px 24px;
                        background: #101113;
                        color: #f4f5f6;
                        font-family:
                            -apple-system,
                            BlinkMacSystemFont,
                            "Segoe UI",
                            sans-serif;
                        text-align: center;
                    }

                    h1 {
                        color: #baff4c;
                        font-size: 32px;
                    }

                    p {
                        color: #a4a8ad;
                        line-height: 1.6;
                    }
                </style>
            </head>

            <body>

                <h1>VOLT</h1>

                <p>
                    The application is currently unavailable.
                    Reconnect to the internet and try again.
                </p>

            </body>

            </html>
            `,

            {
                status: 503,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                }
            }

        );

    }

}


/* ==========================================================
   7. HANDLE STATIC RESOURCES
========================================================== */

async function handleStaticResource(request) {

    const cachedResponse =
        await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {

        const response =
            await fetch(request);

        // Only cache successful responses.
        if (
            response &&
            response.ok &&
            response.type === "basic"
        ) {

            const cache =
                await caches.open(RUNTIME_CACHE);

            await cache.put(
                request,
                response.clone()
            );

        }

        return response;

    } catch (error) {

        console.warn(
            "[VOLT SW] Resource unavailable:",
            request.url
        );

        return Response.error();

    }

}


/* ==========================================================
   8. MANUAL CACHE REFRESH
========================================================== */

/*
   Allows the main application to request
   a cache refresh in a future update.
*/

self.addEventListener("message", event => {

    if (event.data?.type !== "REFRESH_CACHE") {
        return;
    }

    event.waitUntil(

        (async () => {

            const cache =
                await caches.open(STATIC_CACHE);

            await cache.addAll(APP_FILES);

            console.log(
                "[VOLT SW] Application cache refreshed."
            );

        })()

    );

});


/* ==========================================================
   9. SERVICE WORKER READY
========================================================== */

console.log(
    "[VOLT SW] Service worker script loaded."
);