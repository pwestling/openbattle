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
const VERSION = "e57e6f416940";
const FILES = ["assets/Board-EWzjDd6_.js","assets/Branch-CZuC1kun.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-CzYMIKnK.js","assets/CommandPanel-SUGbMtOy.js","assets/CommandPanel-cjjy9hJo.js","assets/CoreAbilities-DwV0Bnuk.js","assets/Editor-DPD1Yitb.js","assets/EventSeat-bKv1QnJk.js","assets/EventsUI-CRKYjlHU.js","assets/FigureLibrary-DKkV57xN.js","assets/Game-BCyEApbd.js","assets/GameScreen-DwuMl9ou.js","assets/MailLobby-ekR86Lgg.js","assets/Miniatures-Pd68puzC.js","assets/NextApp-BGxh6ut0.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-6VcUhufE.js","assets/Packages-B4HeWQru.js","assets/PhotoMatch-Dir4UcAO.js","assets/PlayerCard-DoFUDCev.js","assets/Qd6Card-BRAO-pDo.js","assets/Qd6Card-DVvKurW7.js","assets/Qd6Card-lL-M6Bh7.js","assets/RankedGame-D8wVUa0Y.js","assets/RoundPanel-BDDZZpiN.js","assets/RoundPanel-BGcDSEZN.js","assets/RoundPanel-COfl3Yhi.js","assets/RulesPage-DE_bo-6v.js","assets/StandeeMaker-BUsR7q3t.js","assets/TeachRule-Bf7PDi-k.js","assets/Workshop-B8Z1g2Co.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-B1RxYDPJ.js","assets/actions-CAQ86b48.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-7zDhFJyK.js","assets/book-CmS1uFGu.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CzDcZRod.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-WuuK-D22.js","assets/de-MUnUCfSn.js","assets/demo-BWZZNd9D.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-D1DszIDA.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bx74U8B5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-wuDIqhxE.js","assets/hooks-OAWI_zcQ.js","assets/hooks-agekjrb_.js","assets/hooks-z3zdLyIb.js","assets/http-CpVzz9r4.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-gDet6aGU.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CLnbA7ze.js","assets/lesson-BJEuQyjq.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-utF9nsis.js","assets/local-BAvt5eBj.js","assets/mailbox-BleIqrzz.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CZ5AE73j.js","assets/nostr-Ez9YF5-7.js","assets/open-CYMlDFOs.js","assets/open-Z0phF1iv.js","assets/pack-CxYMEun1.js","assets/packPins-BcxzsDMb.js","assets/packageChange-Be729-6H.js","assets/page-DlPzahFL.js","assets/play-CurwWIQP.js","assets/post-DZTCqcHW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DSAsQnsC.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DbUaQ5M0.js","assets/report-D-aLKXct.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-DA6hjKcq.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BzXAL_CS.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-C-0UppcM.js","assets/store-BebfufTM.js","assets/store-Ccugkag1.js","assets/store-DVYs-te8.js","assets/store-DwzysAY1.js","assets/store-TY4-XX2K.js","assets/store-hG4lucFj.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cm2MtFoT.js","assets/systems-BcF4Kaup.js","assets/systems-BjNsypVe.js","assets/systems-C8rZTVka.js","assets/talk-SfgYj4jx.js","assets/three.module-DD1TOtOx.js","assets/thumb-C1P_hBOd.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CkQ-FGle.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-b8Uu-Sls.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
