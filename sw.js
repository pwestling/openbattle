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
const VERSION = "caeaba53f1ef";
const FILES = ["assets/Board-BHKaKyMs.js","assets/Branch-DbXx0_qw.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BxQGLVYT.js","assets/CommandPanel-C6TVGBVA.js","assets/CommandPanel-CMthc5t9.js","assets/CoreAbilities-DjEjfGxw.js","assets/Editor-CUKMmMFC.js","assets/EventSeat-fYHvE6AJ.js","assets/EventsUI-CfwekTHg.js","assets/FigureLibrary-1iqpia-B.js","assets/Game-BMP3Hkqa.js","assets/GameScreen-BjjVa9vx.js","assets/MailLobby-L2NwwG5N.js","assets/Miniatures-CeWknsaf.js","assets/NextApp-CPH938MZ.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-BhfFWpWx.js","assets/Packages-BROgmV2S.js","assets/PhotoMatch-CBhhJEj-.js","assets/PlayerCard-cKdodoMu.js","assets/Qd6Card-BzKANqzl.js","assets/Qd6Card-DaZOpMHe.js","assets/Qd6Card-GzQhFevZ.js","assets/RankedGame-CIF80AvZ.js","assets/RoundPanel-BeVS7ogw.js","assets/RoundPanel-CFnZN-5h.js","assets/RoundPanel-OmuLkQmA.js","assets/RulesPage-DE_bo-6v.js","assets/StandeeMaker-K32-CoEg.js","assets/TeachRule-zx--k28j.js","assets/Workshop-Dvx2IyMV.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-CYUJgJ5q.js","assets/actions-CEltPHv_.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-BbKvo2qZ.js","assets/book-CmS1uFGu.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CzDcZRod.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-WuuK-D22.js","assets/de-MUnUCfSn.js","assets/demo-ITrd124O.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-fVhTKTGt.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bx74U8B5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CQMPn4yX.js","assets/hooks-B4M83X9F.js","assets/hooks-Ch0_BOdX.js","assets/hooks-DHtBzMTV.js","assets/http-CpVzz9r4.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-DJsNFaS1.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CLnbA7ze.js","assets/lesson-DtdsMD-1.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live--QhsWkIx.js","assets/local-BAvt5eBj.js","assets/mailbox-BleIqrzz.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Ur1bd0vz.js","assets/nostr-Ez9YF5-7.js","assets/open-CD6VopiB.js","assets/open-Z0phF1iv.js","assets/pack-H-Prr4nX.js","assets/packPins-1e_E6AIp.js","assets/packageChange-Be729-6H.js","assets/page-CH16slOr.js","assets/play-Bxz5k9bE.js","assets/post-DZTCqcHW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DSAsQnsC.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CafU7hN3.js","assets/report-CDdzsf-b.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-Cm3u58J8.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DC8L9qW6.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-CVI-dJVx.js","assets/store-BHbNZ4mD.js","assets/store-BJ0N0NSk.js","assets/store-BOok60em.js","assets/store-BebfufTM.js","assets/store-C1hHsFQR.js","assets/store-DiHkgMvD.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cm2MtFoT.js","assets/systems-BiCZld0i.js","assets/systems-DyqPyNOU.js","assets/systems-ZN5VewBZ.js","assets/talk-B8hbKc5M.js","assets/three.module-DD1TOtOx.js","assets/thumb-DF5IOBCH.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-A2bSDBi9.js","assets/worker-CmqMVyGn.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
