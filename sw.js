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
const VERSION = "fe7c1c72e00b";
const FILES = ["assets/Board-B4GIRhsG.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-CYlRUBLf.js","assets/CommandPanel-D71KGSZe.js","assets/CommandPanel-DY2YWMpS.js","assets/Editor-CW2HEMZL.js","assets/EventSeat-ClUD9D4G.js","assets/EventsUI-BQSBM2m0.js","assets/FigureLibrary-XnPTw7D4.js","assets/GameScreen-CI2r_wYe.js","assets/MailLobby-Cu9zYNxj.js","assets/Miniatures-BUK4TCtm.js","assets/OpenTables-CB4-Wnwp.js","assets/PhotoMatch-CFUd1Dzk.js","assets/PlayerCard-U1NqfWsr.js","assets/RankedGame-BY-Zj83n.js","assets/RulesPage-Cwxgn-58.js","assets/StandeeMaker-YGmvPUsQ.js","assets/TeachRule-CfsTpSyQ.js","assets/Workshop-BZ5ik-AQ.js","assets/_virtual_sandbox-worker-CJOrGCtB.js","assets/_virtual_soak-worker-SRLKtVTK.js","assets/actions-DKU2Yb_Q.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-DpmrTMLZ.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-CZky51Uj.js","assets/core-BrlsGzNt.js","assets/de-r_jtXtpO.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-IdlU4wPl.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CqNSdkw2.js","assets/help-C-LHCqA5.js","assets/http-Co6TqxXc.js","assets/idb-OWIpJU7O.js","assets/index-DTNQ2tpM.js","assets/index-qKMv44Qs.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BWSw1OJK.js","assets/lesson-CGq39Zrm.js","assets/levels-DlkUqTaf.js","assets/local-B4KDSYPb.js","assets/mailbox-BQL7zGWC.js","assets/manifest-BRIPGYy3.js","assets/meshShape-BT9iwfTL.js","assets/nostr-BGTCJA8a.js","assets/pack-DdCiuq07.js","assets/packageChange-Be729-6H.js","assets/page-C_iOBDiy.js","assets/play-nIti-H88.js","assets/post-CDI2qPCi.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DwmpwLLw.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/replayFile-DY9r4biB.js","assets/report-Cmp9qq8p.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-CbXtAM7H.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-JbJJynid.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BJP4pGC9.js","assets/standIns-BHeYT5qd.js","assets/store-BSliBOCc.js","assets/store-BX2tynhv.js","assets/store-Bj97UUqM.js","assets/store-CkSbtpN7.js","assets/store-D5wfcYmj.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DDpclYNB.js","assets/talk-Ieib_u0o.js","assets/three.module-BnHMTVNq.js","assets/thumb-C9H71sGR.js","assets/trystero-BCb9sVAd.js","assets/trystero-DD3kLYLU.js","assets/trystero-dNljToKp.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CI0Ra4rh.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-Da0c4ap8.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
