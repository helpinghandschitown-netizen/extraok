const CACHE='extraok-v1.1';
const ASSETS=['./','./index.html','./styles.css','./src/app.mjs','./src/core.mjs','./src/crypto.mjs','./src/store.mjs','./src/license.mjs','./manifest.webmanifest','./assets/icon.svg','./privacy.html','./terms.html','./change-order-approval-checklist.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match('./index.html'))))});
