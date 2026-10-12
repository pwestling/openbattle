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
const VERSION = "7fecdcf118d8";
const FILES = ["assets/Board-DVvU7mr6.js","assets/Branch-Jd7jpV5C.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-DnzG9iBm.js","assets/CommandPanel-gfzgT_68.js","assets/CommandPanel-ya0k0uEs.js","assets/Editor-DVSq7daK.js","assets/EventSeat-DqiNPR6J.js","assets/EventsUI-COw8mX0l.js","assets/FigureLibrary-D3f9zYUI.js","assets/Game-xZ8tdN1u.js","assets/GameScreen-BUeaEmIe.js","assets/MailLobby-BSYmR1c4.js","assets/Miniatures-BuNdtH5T.js","assets/NextApp-CCakTO39.js","assets/NextApp-CZfGknj9.css","assets/OpenTables-D94CaSDm.js","assets/PhotoMatch-BkS0yFq2.js","assets/PlayerCard-C4racfke.js","assets/RankedGame-baEVusKw.js","assets/RulesPage-anf_x910.js","assets/StandeeMaker-owurEk7H.js","assets/TeachRule-BF51mfNR.js","assets/Workshop-YYJXi21G.js","assets/_virtual_sandbox-worker-CUfTD_8X.js","assets/_virtual_soak-worker-CK5sGgzu.js","assets/actions-mzjiTQQ9.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CgF5w8iE.js","assets/book-D_RnO8Y7.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CQSK2e6g.js","assets/de-CDeGKTrG.js","assets/demo-C-POBbHO.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-a66aZzIH.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-CHtpDbSc.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Ceqmwb2G.js","assets/help-CBzKrO9e.js","assets/hooks-Bn-LaVAX.js","assets/http-CLJAwRQS.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-DYNpyMNv.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DwcMiaGR.js","assets/lesson-CwO6qRio.js","assets/levels-DlkUqTaf.js","assets/live-Cn3bbgpB.js","assets/local-Z_kIHopK.js","assets/mailbox-LT8LqiFP.js","assets/manifest-BRIPGYy3.js","assets/meshShape-BY1aFD1D.js","assets/nostr-DOgpWMax.js","assets/open-COT7NmRS.js","assets/open-Z0phF1iv.js","assets/pack-CCEkrxiT.js","assets/packPins-DlZ_1B2w.js","assets/packageChange-Be729-6H.js","assets/page-CvWpt-x7.js","assets/play-DWypGepT.js","assets/post-tWV99rDH.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DwqASdxf.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DkuOLOPx.js","assets/report-DOSL0ApC.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-h7nvHi0W.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-C_3xtB0x.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Bazepdq3.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-B1BT6cnR.js","assets/store-B6ReFAwc.js","assets/store-CXQTsFfo.js","assets/store-McOdbBDG.js","assets/store-sc7yYPZA.js","assets/store-uA9gm846.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CaXeGy4S.js","assets/systems-BuGMAKe1.js","assets/systems-C6Bj-JfO.js","assets/systems-D5Z-SRdH.js","assets/talk-0dGRA4KH.js","assets/three.module-DD1TOtOx.js","assets/thumb-B20vP1Xm.js","assets/trystero-C1CN7n9U.js","assets/trystero-C1jBV_eE.js","assets/trystero-CQejBhJ5.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BvngeUIN.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-D_eBi1Q2.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
