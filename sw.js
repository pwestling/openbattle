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
const VERSION = "25f6372b98c9";
const FILES = ["assets/Board-nR4AQpyx.js","assets/Branch-COLqQv33.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-Cqoi3KFO.js","assets/CommandPanel-DxWEdA8y.js","assets/CommandPanel-qg-rOwnk.js","assets/Editor-Bje_Ta7A.js","assets/EventSeat-CH7INu_6.js","assets/EventsUI-BlKa-keI.js","assets/FigureLibrary-ALSv3x9v.js","assets/Game-BE_A8oXa.js","assets/GameScreen-COYwMTmb.js","assets/MailLobby-wp85cwy1.js","assets/Miniatures-Cbe3A3Kx.js","assets/NextApp-BF6S2Q8Y.css","assets/NextApp-CBUupDQq.js","assets/OpenTables-DS9WJ6F3.js","assets/PhotoMatch-BEf-Jx4N.js","assets/PlayerCard-FVl9NwJ3.js","assets/RankedGame-FdNJ1Pdk.js","assets/RulesPage-CXNOQc6v.js","assets/StandeeMaker-DGVM31yW.js","assets/TeachRule-B9azeSu8.js","assets/Workshop-Db9uxOOU.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-C2ojcOYw.js","assets/actions-Dz9WQcmO.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DTOnNMa_.js","assets/book-XwCBCfHQ.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BzjICDm1.js","assets/de-CdQHsbIe.js","assets/demo-CkENPf_f.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-998FIrG5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-OPhBP3NY.js","assets/help-047wccFA.js","assets/http-DaH81P_5.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-DJ7M4Rd1.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-C8eeFcdj.js","assets/lesson-D45bT9MW.js","assets/levels-DlkUqTaf.js","assets/live-M5xey22Y.js","assets/local-DQS3J-Jk.js","assets/mailbox-BW-i7JDm.js","assets/manifest-BRIPGYy3.js","assets/meshShape-B3z-BkRr.js","assets/nostr-DE7iWFG8.js","assets/open-BOnsza60.js","assets/open-Z0phF1iv.js","assets/pack-DQwwwpSn.js","assets/packageChange-Be729-6H.js","assets/page-BfWlbRBS.js","assets/play-DzaL97bd.js","assets/post-Dvt6qEYL.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-2nC6d4K3.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DrKTkHdz.js","assets/report-D-r9UQYX.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BR3Oae8V.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-n1NZNshJ.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-1Df-2G3T.js","assets/store-Bp7ht_X9.js","assets/store-ChvSw7ap.js","assets/store-D0RhlCaT.js","assets/store-DgnuJy4m.js","assets/store-DmO5q7w8.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DyTgCpK2.js","assets/systems-B-w7QKAW.js","assets/systems-Cj4LPF9P.js","assets/systems-jsJYm4Ay.js","assets/talk-CYA_D1g-.js","assets/three.module-DD1TOtOx.js","assets/thumb-Eqao7TQm.js","assets/trystero-CQejBhJ5.js","assets/trystero-gwJR7lzN.js","assets/trystero-nIIO4DWS.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BkjkLUfk.js","assets/worker-BsM9oM0i.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
