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
const VERSION = "e0fa59a99a0f";
const FILES = ["assets/Board-isbguQKL.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-7eqGTFgB.js","assets/CommandPanel-BRTAlEJY.js","assets/CommandPanel-btSjmOOI.js","assets/Editor-BkBlbX_x.js","assets/EventSeat-C3WQ5oos.js","assets/EventsUI-BJ3jKsc2.js","assets/FigureLibrary-Bq6oEKl5.js","assets/GameScreen-CmPRF4ia.js","assets/MailLobby-D_y0cYOU.js","assets/Miniatures-vJB6vcDw.js","assets/OpenTables-BExqHGlf.js","assets/PhotoMatch-C7117uHM.js","assets/PlayerCard-CqSqdQiM.js","assets/RankedGame-Bujt1bQb.js","assets/RulesPage-DSrl8Xzq.js","assets/StandeeMaker-bH7XkmUM.js","assets/TeachRule-QmcTzb4D.js","assets/Workshop-BhqX19LV.js","assets/_virtual_sandbox-worker-Cr07ZzyT.js","assets/_virtual_soak-worker-BvsqOUIL.js","assets/actions-DsfpKEnE.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Bl9HGaMT.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BTPqFEWT.js","assets/de-LUPWLMZ7.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CRAso3MP.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CRLBRruF.js","assets/help-X3FcOY2e.js","assets/http-CRma7qjg.js","assets/idb-OWIpJU7O.js","assets/index-B6tjavDa.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CPL-IDB4.js","assets/lesson-D_EjaHrn.js","assets/levels-DlkUqTaf.js","assets/local-By3grld9.js","assets/mailbox-2lEQBXc3.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CImDu3BV.js","assets/nostr-HCvy0oPS.js","assets/pack-Ct1vCQOv.js","assets/packageChange-Be729-6H.js","assets/page-D3u2AMlV.js","assets/play-VSdg_GWV.js","assets/post-E-8sNOns.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BTmfw4R2.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-8N-IS0p7.js","assets/report-DSy1VOHf.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DI56fnUZ.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-0BRH1suL.js","assets/store-BQKF2ihS.js","assets/store-DF0I3qiQ.js","assets/store-Z65b4mPV.js","assets/store-oausLpHf.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CRxgalaP.js","assets/systems-BhGUXHZD.js","assets/systems-C1tD-1lu.js","assets/systems-qgeRQL2g.js","assets/talk-DL_WJXMX.js","assets/three.module-BnHMTVNq.js","assets/thumb-DSpKMTMl.js","assets/trystero-BH8X4okc.js","assets/trystero-CQejBhJ5.js","assets/trystero-Wg0MsQ20.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-C2j3Vhh3.js","assets/worker-CeEeEMU4.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
