const CACHE_NAME = "uno-pwa-cache-v3";
const urlsToCache = [
    "/",
    "/index.html",
    "/styles.css",
    "/client.js",
    "/manifest.json"
];

async function cacheFilesSafely(cache) {
    for (const url of urlsToCache) {
        try {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`File ${url} not found or failed to fetch.`);
            }
            await cache.put(url, response);
            console.log(`Cached: ${url}`);
        } catch (error) {
            console.warn(`Skipping ${url}: ${error.message}`);
        }
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log("Caching files...");
            await cacheFilesSafely(cache);
            console.log("All available files cached successfully!");
        }).catch((err) => console.error("Cache installation failed:", err))
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        }).catch(() => {
            console.warn(`Failed to fetch ${event.request.url}`);
            return fetch(event.request);
        })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
});
