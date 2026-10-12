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
const VERSION = "1993d367464e";
const FILES = ["assets/Board-9Hzse1J4.js","assets/Branch-ClkW-EOe.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-Bw-Bms-3.js","assets/CommandPanel-C1lQjxUN.js","assets/CommandPanel-DVABhJHC.js","assets/CoreAbilities-Bq8swmhB.js","assets/Editor-BZaQkMea.js","assets/EventSeat-DMkDnX72.js","assets/EventsUI-AjV6tkRZ.js","assets/FigureLibrary-BmEiNk96.js","assets/Game-BY4ctRkK.js","assets/GameScreen-CcmMT-8v.js","assets/MailLobby-D-1kHCOQ.js","assets/Miniatures-C_XNC3jp.js","assets/NextApp-BrjWCX1E.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-Bvb1UE00.js","assets/Packages-DZHxoUyR.js","assets/PhotoMatch-X8rV5zoZ.js","assets/PlayerCard-DApBJ-pE.js","assets/Qd6Card-5iljue-6.js","assets/Qd6Card-BK369CF9.js","assets/Qd6Card-DDVJ-lLr.js","assets/RankedGame-tn-n8t7Z.js","assets/RoundPanel-CwuYQh5R.js","assets/RoundPanel-caigMM1C.js","assets/RoundPanel-ueJ7qAgu.js","assets/RulesPage-DE_bo-6v.js","assets/StandeeMaker-CS8oT3ay.js","assets/TeachRule-BTI_Hli5.js","assets/Workshop-BPQ4cbS4.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-6E1Dlw3M.js","assets/actions-D_wec86w.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DXN-gFv_.js","assets/book-CmS1uFGu.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CzDcZRod.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-WuuK-D22.js","assets/de-MUnUCfSn.js","assets/demo-ATtpvYgG.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BKbTbWgO.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bx74U8B5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DQqtiXln.js","assets/hooks-BBLRtd5n.js","assets/hooks-BftgeLFS.js","assets/hooks-DyIlD8_y.js","assets/http-CpVzz9r4.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-YClZoWX6.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CLnbA7ze.js","assets/lesson-CWmVeKT3.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-BO1SKKUx.js","assets/local-BAvt5eBj.js","assets/mailbox-BleIqrzz.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CjsEjDT2.js","assets/nostr-Ez9YF5-7.js","assets/open-CNY0KI44.js","assets/open-Z0phF1iv.js","assets/pack-D_MNtp3p.js","assets/packPins-CdOcri5Y.js","assets/packageChange-Be729-6H.js","assets/page-Bp3emcLq.js","assets/play-CskhwmVp.js","assets/post-DZTCqcHW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DSAsQnsC.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-HSYuxvbF.js","assets/report-B87WKKV9.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-guGp7OpO.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DGVTVfvK.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-Cd4CZSYG.js","assets/store-BbEb_aQR.js","assets/store-BebfufTM.js","assets/store-CKtBavUg.js","assets/store-CL3_HZoq.js","assets/store-Cg9uGohU.js","assets/store-__Wgt-FA.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cm2MtFoT.js","assets/systems-93WteNrx.js","assets/systems-BjYNkUMq.js","assets/systems-CPbCMx9k.js","assets/talk-DB3OF3zN.js","assets/three.module-DD1TOtOx.js","assets/thumb-LSe_H0te.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DEmtlU9I.js","assets/worker-DV1DuzPc.js","assets/worker-on7Eo4sD.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
