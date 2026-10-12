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
const VERSION = "d8382a87e3a2";
const FILES = ["assets/Board-B-yP_DSP.js","assets/Editor-BYV_PLNU.js","assets/EventSeat-Be9rLG2y.js","assets/EventsUI-BXeSFamv.js","assets/FigureLibrary-Dnb-xtWT.js","assets/Game-BHpfzz55.js","assets/GameScreen-Cx1CQLS2.js","assets/MailLobby-Z0oeyBbz.js","assets/Miniatures-DpE9ls0_.js","assets/NextApp-BU0Ls4gK.js","assets/NextApp-C6C3HxyA.css","assets/OpenTables-Do5ZW3CF.js","assets/Packages-C3ZfXVSB.js","assets/PhotoMatch-C9ltmB9S.js","assets/PlayerCard-D1h50bfK.js","assets/RankedGame-CRoixN44.js","assets/StandeeMaker-DGJP4BVj.js","assets/TeachRule-CqJFzTNB.js","assets/TextSizePicker-DTWVQd1p.js","assets/Workshop-_Suuh-9X.js","assets/_virtual_sandbox-worker-C_CbNidg.js","assets/_virtual_soak-worker-BeeDPAGq.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B_oq8m7T.js","assets/book-TkP_eCfY.js","assets/browser-bopAeLbn.js","assets/bucket-DPXrfPLu.js","assets/codec-DOkRM3Zs.js","assets/core-Dss9INsC.js","assets/de-D610tZY6.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-C3Jjzerp.js","assets/faction-89tJyISj.js","assets/files-CdfAAl3C.js","assets/fr-BsRxYpYV.js","assets/fxp-CNHNYw_7.js","assets/http-CSskXEzf.js","assets/idb-OWIpJU7O.js","assets/index-DHOLF9AB.js","assets/index-x6bMcWA5.css","assets/jsx-runtime-BtH0gOTJ.js","assets/levels-DlkUqTaf.js","assets/lit-Ds3M94pd.js","assets/manifest-BRIPGYy3.js","assets/meshShape-cV-PtFA9.js","assets/nostr-CZhRG5v7.js","assets/open-BzTM4sFW.js","assets/pack-BVJ5m_mC.js","assets/page-CKyGeUoC.js","assets/post-Cfh_08lz.js","assets/preload-helper-BaNbYf_w.js","assets/react-DB-4Zxce.js","assets/react-Dh-dCZWT.js","assets/react-dom-6cEjSHVw.js","assets/relayBusy-DNpuI-Lc.js","assets/replayFile-4Q9EL14h.js","assets/report-Ck3zGwjn.js","assets/roster-bandJpzc.js","assets/route-cx4ZtQtv.js","assets/scheduler-pDGbHDo7.js","assets/secp256k1-yVjC_Axf.js","assets/showcase-CEFini-e.js","assets/store-B6WcOIiK.js","assets/store-B_rqV9ta.js","assets/store-Bj-4cSRF.js","assets/store-CeTRh1Cp.js","assets/store-DP2JQLmG.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DSZcmFWV.js","assets/systems-DJ0ywDu3.js","assets/talk-ArSxAqji.js","assets/thumb-D2EKPbvs.js","assets/torrent-Wcoh5lhO.js","assets/trystero-B6_0Ifew.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BCbPAPLR.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DW8rRco9.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
