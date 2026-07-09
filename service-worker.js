const CACHE_NAME = 'jos-program-v3-0-clean-build';
const APP_SHELL = ['./','index.html','styles.css','data.js','app.js','manifest.json','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if(e.request.method !== 'GET') return; e.respondWith(fetch(e.request).then(r=>{ const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html')))); });
