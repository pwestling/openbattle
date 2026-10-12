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
const VERSION = "2c3305942b9e";
const FILES = ["assets/Board-IgSn_fdw.js","assets/Branch-B_QvYcTc.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BQJNgpSl.js","assets/CommandPanel-C9gKFP_S.js","assets/CommandPanel-CNRVQF8l.js","assets/CoreAbilities-DlHDCqBS.js","assets/Editor-C6yLaFo_.js","assets/EventSeat-CIGOTxf9.js","assets/EventsUI-scOlTgvM.js","assets/FigureLibrary-C9MhUwZL.js","assets/Game-C7GxDW73.js","assets/GameScreen-DWYAN47S.js","assets/MailLobby-BSJ_3C9h.js","assets/Miniatures-BAMSEZMf.js","assets/NextApp-BK4p3kfN.js","assets/NextApp-wlNW31w1.css","assets/OpenTables-OsXU0Xh6.js","assets/Packages-zQZ6IrmU.js","assets/PhotoMatch-COG5G6JJ.js","assets/PlayerCard-qE_RmwGY.js","assets/Qd6Card-CVcbuGG7.js","assets/Qd6Card-CkzX_oFs.js","assets/Qd6Card-EIDdZWOQ.js","assets/RankedGame-WgfNo1ER.js","assets/RoundPanel-D-xNCcEC.js","assets/RoundPanel-PrPLJR7b.js","assets/RoundPanel-g6K_694U.js","assets/RulesPage-D3Jr9VoG.js","assets/StandeeMaker-CuGxDFTw.js","assets/TeachRule-FqKnleAp.js","assets/Workshop-C5dr6wrp.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-CkPmf__A.js","assets/actions-DBtSiIW9.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-0eVU7C1q.js","assets/book-DbBoehsd.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-C3Oha4kN.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BC5IUwtE.js","assets/de-DE55j9T_.js","assets/demo-BccaEfvm.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-Dnhpd5-j.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BUKcsX1v.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CX_jWacX.js","assets/hooks-CA1YyBwW.js","assets/hooks-CEmWEyGq.js","assets/hooks-DjwXnChZ.js","assets/http-ZEfuWqkW.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-MyDvcWQB.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-Copo2a5e.js","assets/lesson-CKDLBFUV.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-CPMs1mqS.js","assets/local-Yb8fAcR7.js","assets/mailbox-LftK4CQe.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DVjfsI1T.js","assets/nostr-C3vWkwtL.js","assets/open-BuSU8dAE.js","assets/open-Z0phF1iv.js","assets/pack-B__WbR4v.js","assets/packPins-DGmHVe41.js","assets/packageChange-Be729-6H.js","assets/page-hhypzqTF.js","assets/play-DZT5ymDF.js","assets/post-CmD3bn4H.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DM-fZVgI.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-paaQF08a.js","assets/report-C7HbcM5h.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-C57oO3eZ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Cku8Ax8-.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-BiJR_FAN.js","assets/store-ClppWJ3N.js","assets/store-Cm04HExW.js","assets/store-DacTMdIZ.js","assets/store-Dk1eYXn0.js","assets/store-ZCQCG-6I.js","assets/store-e7o6Jy50.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-BRSlxAfc.js","assets/systems-BgDVDuGI.js","assets/systems-CBdZc4CB.js","assets/systems-CEF5wSqS.js","assets/talk-ueRnKLul.js","assets/three.module-DD1TOtOx.js","assets/thumb-C6eHdgir.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BSLIldtH.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-gQwHdZvg.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
