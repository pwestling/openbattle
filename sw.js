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
const VERSION = "c49cac105db3";
const FILES = ["assets/Board-Drj8Xeze.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BfEn43fO.js","assets/CommandPanel-C_nVUBRP.js","assets/CommandPanel-DD1xFCun.js","assets/Editor-zvjwyBXL.js","assets/EventSeat-CRAf6IS5.js","assets/EventsUI-C4xI23yr.js","assets/FigureLibrary-DOnjxJup.js","assets/GameScreen-BHSVTDj7.js","assets/MailLobby-DEjkIf_E.js","assets/Miniatures-CU1ZhPx3.js","assets/OpenTables-BRN7bspv.js","assets/PhotoMatch-593XQDMn.js","assets/PlayerCard-B1bp_eXO.js","assets/RankedGame-BH0i8DYc.js","assets/RulesPage-DV3okymX.js","assets/StandeeMaker-B-BwilYQ.js","assets/TeachRule-DGjCq0t2.js","assets/Workshop-BHpwLyav.js","assets/_virtual_sandbox-worker-BeBMaQy2.js","assets/_virtual_soak-worker-CAq0-iUN.js","assets/actions-BtPRfCJ4.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-CIjonCSV.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BYG8SHuW.js","assets/de-D0d4S7Tv.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-DFy5l7Im.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BxY1_8To.js","assets/help-BJlGVXP1.js","assets/http-BkI1tlMN.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-IfzjXayA.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-F22XjKHJ.js","assets/lesson-mceCLMbA.js","assets/levels-DlkUqTaf.js","assets/local-C5gthp3L.js","assets/mailbox-BzctpPPp.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Cy6K7hGf.js","assets/nostr-Ce6b2W7g.js","assets/open-Z0phF1iv.js","assets/pack-CWgOO7Fp.js","assets/packageChange-Be729-6H.js","assets/page-Ds1rLLMm.js","assets/play-CggAASzA.js","assets/post-q0kTTiN0.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BWsKWfcH.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BX0--m7J.js","assets/report-DzG4tg9o.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-DINwkI0Q.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BJUR2qLj.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-B0nOAuCI.js","assets/store-CB5luEa9.js","assets/store-CCk3zvy2.js","assets/store-Dm0cmCmF.js","assets/store-ikuR2pvX.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-D18BfCBD.js","assets/systems-DCkDCSD-.js","assets/systems-DnopdYgY.js","assets/systems-hRKi0iPC.js","assets/talk-CZODwDas.js","assets/three.module-DD1TOtOx.js","assets/thumb-BDUI2roT.js","assets/trystero-BBuk82U2.js","assets/trystero-BV4DT2H4.js","assets/trystero-CQejBhJ5.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BdlbWHwG.js","assets/worker-CtrB5Iye.js","assets/worker-DNbiF9mD.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
