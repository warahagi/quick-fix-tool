const CACHE_NAME = 'quick-snippets-v2';
const ASSETS = [
  'index.html',
  'flashcard.html',
  'snippets.json',
  'icon-512.png'
];

// Install Event (キャッシュの初期登録)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  // 新しいService Workerがインストールされたらすぐにアクティブにする
  self.skipWaiting();
});

// Activate Event (古いキャッシュの削除)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => {
      // 制御しているすべてのクライアント(タブ)をすぐにコントロール下に置く
      return self.clients.claim();
    })
  );
});

// Fetch Event (リクエストに応じたキャッシュ戦略)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. snippets.json は Network First (ネットワーク優先)
  if (url.pathname.endsWith('snippets.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // オンラインで取得成功したらキャッシュを最新にする
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // オフラインなどでネットワークエラーが起きたらキャッシュから返す
          return caches.match(event.request);
        })
    );
  } else {
    // 2. その他の静的ファイルは Stale-While-Revalidate (キャッシュ優先＋裏で更新)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // オフライン時のエラーは無視（キャッシュが返されるため）
          });

        // キャッシュがあれば即座に返し、なければネットワークからの取得完了を待つ
        return cachedResponse || fetchPromise;
      })
    );
  }
});
