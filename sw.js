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
const VERSION = "204e65135c92";
const FILES = ["assets/Board-DNMhycNt.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-0gFDHTIP.js","assets/CommandPanel-B973FOm2.js","assets/CommandPanel-C2UUi89C.js","assets/Editor-DY2Mnzd8.js","assets/EventSeat-ChT_d-uH.js","assets/EventsUI-DPoxn0hw.js","assets/FigureLibrary-7LC1KD5_.js","assets/GameScreen-Bc_8leaY.js","assets/MailLobby-aNOQs50s.js","assets/Miniatures-BiwVqdOa.js","assets/OpenTables-CfEWZgLU.js","assets/PhotoMatch-CUcDPLg_.js","assets/PlayerCard-Ba1y3pz7.js","assets/RankedGame-bXx0SAOh.js","assets/RulesPage-wnTUQ9a2.js","assets/StandeeMaker-NWhavbEH.js","assets/TeachRule-BAGFu72_.js","assets/Workshop-cik7zsRr.js","assets/_virtual_sandbox-worker-uERafCpR.js","assets/_virtual_soak-worker-BJ1kx2Sx.js","assets/actions-D5ugJP9M.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Dfjpe8_Y.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DjyUJGQF.js","assets/de-LUPWLMZ7.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CRAso3MP.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Dbm7zrlO.js","assets/help-D-gBIi0L.js","assets/http-fFLjfH-S.js","assets/idb-OWIpJU7O.js","assets/index-C-PwDpxG.css","assets/index-CH_qwjd9.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-D69yh6ew.js","assets/lesson-DrszeSAE.js","assets/levels-DlkUqTaf.js","assets/local-BGQ2Tnoy.js","assets/mailbox-XvYSlpPl.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CYyVLWNW.js","assets/nostr-B4VBdWn5.js","assets/open-Z0phF1iv.js","assets/pack-B97SUsOD.js","assets/packageChange-Be729-6H.js","assets/page-CC8mSvAv.js","assets/play-B2s5pWlf.js","assets/post-DPtCorM7.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-COmppdcn.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BZqLRvUh.js","assets/report-BWD7V5PQ.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BRP_Hwu3.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CT93q2CD.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BoshvO1O.js","assets/store-D7d2cJiH.js","assets/store-DFimGF_8.js","assets/store-QZvl2Ngm.js","assets/store-y9-8N6DT.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-B2uJpm2G.js","assets/systems-BvuDBRLS.js","assets/systems-DAXzp0jC.js","assets/systems-Jf2qPDk7.js","assets/talk-qfIWvgyD.js","assets/three.module-DD1TOtOx.js","assets/thumb-BbfK5nF2.js","assets/trystero-ByBA2y0t.js","assets/trystero-CQejBhJ5.js","assets/trystero-CxcIyc9y.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BLrwpbxE.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DgB0rgy-.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
