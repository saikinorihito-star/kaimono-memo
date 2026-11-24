// 買い物メモのホーム画面起動を高速化: 保存済み画面を先に返し、更新は裏で取得する。
// ローカルデータ(localStorage)には一切触れない。HTMLの更新は次回起動から反映される。
const CACHE='kaimono-memo-shell-v1-fast-start';
const SHELL=['./','./index.html','./apple-touch-icon-v2.png?v=2'];
const PATHS=new Set(['./','./index.html','./apple-touch-icon-v2.png'].map(path=>new URL(path,self.registration.scope).pathname));

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('kaimono-memo-shell-')&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!PATHS.has(url.pathname))return;
  const isPage=url.pathname===new URL('./',self.registration.scope).pathname||
               url.pathname===new URL('./index.html',self.registration.scope).pathname;
  const cacheReady=caches.open(CACHE);
  const cached=cacheReady.then(async cache=>await cache.match(event.request)||
    (isPage?cache.match('./index.html'):null));

  const update=async()=>{
    const response=await fetch(event.request,{cache:'no-cache'});
    if(response.ok){
      const cache=await cacheReady;
      await cache.put(event.request,response.clone()).catch(()=>{});
    }
    return response;
  };
  // 既に画面の保存版がある場合も、最新ページを裏で取得する。
  event.waitUntil(cached.then(response=>response?update().catch(()=>{}):null).catch(()=>{}));
  event.respondWith((async()=>{
    const saved=await cached;
    if(saved)return saved;
    try{return await update();}
    catch(err){const fallback=isPage?await (await cacheReady).match('./'):null;if(fallback)return fallback;throw err;}
  })());
});
