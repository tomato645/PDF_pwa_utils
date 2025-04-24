const cacheName = 'pdf2img-cache-v1';
const assets = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(cacheName).then((cache) => cache.addAll(assets))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
