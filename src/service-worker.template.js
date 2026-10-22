const CACHE = "openrang-__BUILD_ID__";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const response = await fetch("/precache.json", { cache: "no-store" });
      if (!response.ok) throw Error("Offline assets could not be prepared.");
      const assets = await response.json();
      const cache = await caches.open(CACHE);
      await cache.addAll([
        "/",
        "/favicon.svg",
        "/manifest.webmanifest",
        ...assets,
      ]);
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("openrang-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Authentication routes and other platform requests must retain their normal network behavior.
  const navigation =
    request.mode === "navigate" && ["/", "/index.html"].includes(url.pathname);
  const asset =
    url.pathname.startsWith("/assets/") ||
    ["/favicon.svg", "/manifest.webmanifest"].includes(url.pathname);
  if (!navigation && !asset) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (navigation) {
        try {
          const response = await fetch(request);
          if (response.ok && !response.redirected)
            await cache.put("/", response.clone());
          return response;
        } catch {
          return (
            (await cache.match("/")) ||
            new Response(
              "Open OpenRang online once to enable offline editing.",
              { status: 503 },
            )
          );
        }
      }
      const saved = await cache.match(request, { ignoreVary: true });
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
