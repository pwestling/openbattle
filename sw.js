// Open Battle's service worker (#34), built by the `serviceWorker` plugin in
// vite.config.ts, which fills in the build's files and version.
//
// - It keeps the app on the device, so hotseat, solo games, lessons, replays,
//   the shelves and the campaign book work without a network, and the app can
//   be installed. A new version waits until the player chooses to reload
//   (src/sw/register.ts says when: never mid-game).
// - It shows play-by-mail notifications (src/mail/mailbox.ts). A push from
//   the mailbox carries nothing about the game: it only says a file has come,
//   and the app fetches it from the mailbox when it opens.
const VERSION = "8276c16a08d3";
const FILES = ["assets/Board-CNquYK_i.js","assets/Branch-dKVshl45.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-C1imcDmj.js","assets/CommandPanel-CbLeU4aX.js","assets/CommandPanel-CzDlduo2.js","assets/Editor-DblfrIf1.js","assets/EventSeat-CxfqRB4W.js","assets/EventsUI-B26dsw0K.js","assets/FigureLibrary-9J-hkaCW.js","assets/Game-SHvU1XnO.js","assets/GameScreen-CKbw1YVp.js","assets/MailLobby-DGm8HMU8.js","assets/Miniatures-Tpq9S0To.js","assets/NextApp-BPiWdMFq.js","assets/NextApp-CTSOI19d.css","assets/OpenTables-o2qcI5Oi.js","assets/PhotoMatch-BRad_8RZ.js","assets/PlayerCard-Dwaxf3cB.js","assets/RankedGame-AyglAGG-.js","assets/RulesPage-DHuvHAnu.js","assets/StandeeMaker-Di9WEzuC.js","assets/TeachRule-BhiYEJ6M.js","assets/Workshop-DEGEntlu.js","assets/_virtual_sandbox-worker-cpXrvInP.js","assets/_virtual_soak-worker-CVArEYEz.js","assets/actions-CNtLuqwo.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Ccxvi5PG.js","assets/book-DiGCNtf3.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CXoHV0yd.js","assets/de-C3kUiwD1.js","assets/demo-CKHx0UKX.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-4khx8ilk.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-D4NyJHBn.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CIMzbItt.js","assets/help-1X-jZSqq.js","assets/hooks-mt-2t45-.js","assets/http-Csam14Lb.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-CEgm1Ya2.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-B1Wn0hIE.js","assets/lesson-Cg-QghGw.js","assets/levels-DlkUqTaf.js","assets/live-BzD12H2n.js","assets/local-CBmjpGZX.js","assets/mailbox-BPz2UvGm.js","assets/manifest-BRIPGYy3.js","assets/meshShape-B1CfPXF9.js","assets/nostr-Bs5yRBHE.js","assets/open-Z0phF1iv.js","assets/open-cKw3RdL2.js","assets/pack-Dw5Mz_tv.js","assets/packPins-CJnvp-7A.js","assets/packageChange-Be729-6H.js","assets/page-BLqNvy0Z.js","assets/play-DMQpcG-j.js","assets/post-3gMXHy2K.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DDKLVk5W.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Ccw9sM7c.js","assets/report-BJZVBDJ3.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-DG7kWjIe.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-_7mfRIJo.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-D2NNj98r.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BAkeqtKu.js","assets/store-Bh97qBiA.js","assets/store-CGNtd07b.js","assets/store-CTs8gaK4.js","assets/store-FnQ8_ep8.js","assets/store-SiSzAaD4.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DEixc4d3.js","assets/systems-B82Asli4.js","assets/systems-BEN7hdji.js","assets/systems-BuW_2IHO.js","assets/talk-BCUZTQxG.js","assets/three.module-DD1TOtOx.js","assets/thumb-BV06tDCx.js","assets/trystero--wk8Hu5G.js","assets/trystero-CQejBhJ5.js","assets/trystero-YDJFgQnm.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BLNaGdmZ.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DWaKz2kP.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
const CACHE = `open-battle-${VERSION}`;
const DEV = VERSION === "dev";
const at = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .open(CACHE)
      // Hashed build files never change, so the copies the page just loaded will do; the rest
      // (index.html, the manifest, icons) are fetched fresh.
      .then((cache) =>
        cache.addAll(
          FILES.map((f) => new Request(at(f), { cache: /-[\w-]{8}\.\w+$/.test(f) ? "default" : "reload" })),
        ),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith("open-battle-") && n !== CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The page asks for the waiting version once the player says reload.
self.addEventListener("message", (event) => {
  if (event.data?.t === "skip-waiting") self.skipWaiting();
});

/** Things that only make sense live: the server's config, signalling, the mailbox, health. */
const LIVE = /\/(config\.json|health\.json|health|relay|mailbox)(\/|$|\?)/;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || LIVE.test(url.pathname)) return;
  if (request.mode === "navigate") {
    // The page: the network when it answers (it may carry a newer version), else the copy kept here.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(at("index.html"), { cacheName: CACHE }).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }
  // The build's files never change under a name: the kept copy first.
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((kept) => kept ?? fetch(request)),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Your move · Open Battle", {
      body: "Your opponent sent their turn.",
      tag: "open-battle-mail",
      renotify: true,
      icon: at("icons/icon-192.png"),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
