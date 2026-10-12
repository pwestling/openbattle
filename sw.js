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
const VERSION = "afa0425c8a98";
const FILES = ["assets/Board-VxhiDvC5.js","assets/Branch-DDdY-gp0.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BKaFEKYj.js","assets/CommandPanel-Cr6-Pwkm.js","assets/CommandPanel-SoIoyL-T.js","assets/Editor-KpSU2aY7.js","assets/EventSeat-BZHLcXBQ.js","assets/EventsUI-CrwXPrea.js","assets/FigureLibrary-B5K5eYAJ.js","assets/Game-C5IPe29B.js","assets/GameScreen-BnMAwZOe.js","assets/MailLobby-bd4N2H1s.js","assets/Miniatures-5oZnWdZg.js","assets/NextApp-BCotvsBe.js","assets/NextApp-CZfGknj9.css","assets/OpenTables-CXMnMXY-.js","assets/PhotoMatch-zXGZwkI8.js","assets/PlayerCard-BVI4lof8.js","assets/RankedGame-B1Ns8y_y.js","assets/RulesPage-Cw9l6yas.js","assets/StandeeMaker-Dz3eB67T.js","assets/TeachRule-MAeOErLg.js","assets/Workshop-Dp83j6VF.js","assets/_virtual_sandbox-worker-CUfTD_8X.js","assets/_virtual_soak-worker-B9KZ_maf.js","assets/actions-CV2I7riu.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Cr0niti4.js","assets/book-YjfHsnih.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CDVfSaF_.js","assets/de-CqqE4-5s.js","assets/demo-BQXqzeQ1.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-D-VdJjv-.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-dDsFYJF6.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Dcuv0wFk.js","assets/help-CW7bxIyd.js","assets/hooks-Dt0T3Hxe.js","assets/http-BxRw_Dmk.js","assets/idb-OWIpJU7O.js","assets/index-B9Jkh8mj.js","assets/index-BH23y70G.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-I3ajEBfc.js","assets/lesson-Catno18B.js","assets/levels-DlkUqTaf.js","assets/live-DIPxdu4f.js","assets/local-B6jeH7Sa.js","assets/mailbox-CuilV1i-.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DPbh2ibF.js","assets/nostr-CuwW-5oA.js","assets/open-Z0phF1iv.js","assets/open-vIgjewy7.js","assets/pack-59dcQjtH.js","assets/packPins-B4O93d3t.js","assets/packageChange-Be729-6H.js","assets/page-DaZLH0Ta.js","assets/play-BQeRozyl.js","assets/post-nzO2cjQr.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DyuOF0HR.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BRUlLrQb.js","assets/report-CIwWo1dJ.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-DCu2TBXD.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-DlHYvnWP.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CgTeUsY2.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-CC3UDEMC.js","assets/store-CFo1nPFr.js","assets/store-CdVbVdOa.js","assets/store-Cem_Bmlh.js","assets/store-VIJwUJAy.js","assets/store-gEgY6dZg.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-NfLPf78q.js","assets/systems-Be0iuaS9.js","assets/systems-D-SuiuIj.js","assets/systems-nCTFs7za.js","assets/talk-tk1ViG8P.js","assets/three.module-DD1TOtOx.js","assets/thumb-Dcjrx91M.js","assets/trystero-CQejBhJ5.js","assets/trystero-DRuyt_bC.js","assets/trystero-DSPl-JFO.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BlWNgmcu.js","assets/worker-Cmz_bTNj.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
