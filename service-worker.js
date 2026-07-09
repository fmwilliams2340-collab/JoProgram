const CACHE_NAME = 'jos-program-v3-complete-001';
const APP_SHELL = [
  './','./index.html','./css/styles.css','./js/app.js','./data/data.json','./manifest.json',
  './icon-180.png','./icon-192.png','./icon-512.png','./assets/jo/jo-portrait.png'
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(resp => resp || caches.match('./index.html'))));
});
